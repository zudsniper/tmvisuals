import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

// Path validation utility to prevent directory traversal attacks
class PathValidator {
  static validatePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('Path must be a non-empty string');
    }

    const trimmedPath = inputPath.trim();
    if (trimmedPath.length === 0) {
      throw new Error('Path cannot be empty');
    }

    // Check for directory traversal attempts
    if (trimmedPath.includes('..')) {
      throw new Error('Path contains directory traversal attempts');
    }

    // Check for invalid characters
    if (/[<>:"|?*]/.test(trimmedPath)) {
      throw new Error('Path contains invalid characters');
    }

    // Resolve and normalize the path
    try {
      const resolvedPath = path.resolve(trimmedPath);
      
      // Additional safety check
      if (resolvedPath.includes('..')) {
        throw new Error('Resolved path contains directory traversal');
      }
      
      return resolvedPath;
    } catch (error) {
      throw new Error(`Failed to resolve path: ${error.message}`);
    }
  }

  static validateTasksDirectory(projectPath) {
    const safeProjectPath = this.validatePath(projectPath);
    const tasksPath = path.join(safeProjectPath, 'tasks');
    
    // Validate the tasks path as well
    const safeTasksPath = this.validatePath(tasksPath);
    
    return { projectPath: safeProjectPath, tasksPath: safeTasksPath };
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Store active SSE connections
const sseConnections = new Map();
let connectionId = 0;

// Store file watchers
const fileWatchers = new Map();

// Store retry counts and backoff timers per project path
const watchRetries = new Map();
const backoffTimers = new Map();

// Maximum number of retry attempts
const MAX_RETRY_ATTEMPTS = 3;
// Initial backoff delay in milliseconds
const INITIAL_BACKOFF_DELAY = 1000;
// Maximum backoff delay in milliseconds
const MAX_BACKOFF_DELAY = 30000;

// Serve static files from the dist directory when built
const distPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log('✅ Serving built application from dist/');
} else {
  console.warn('⚠️  No dist/ directory found. Run "npm run build" first.');
}

// Always serve public assets (favicons, etc.) even in development
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log('✅ Serving public assets from public/');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Server-Sent Events endpoint for live updates
app.get('/api/live-updates', (req, res) => {
  const currentConnectionId = ++connectionId;
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Store the connection
  sseConnections.set(currentConnectionId, res);
  
  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', id: currentConnectionId })}\n\n`);
  
  // Handle client disconnect
  req.on('close', () => {
    sseConnections.delete(currentConnectionId);
    console.log(`SSE connection ${currentConnectionId} closed`);
  });
  
  req.on('error', () => {
    sseConnections.delete(currentConnectionId);
  });
});

// Start watching a project directory for changes
app.post('/api/watch-project', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    // Validate and sanitize paths
    let safeProjectPath, tasksPath;
    try {
      const validatedPaths = PathValidator.validateTasksDirectory(projectPath);
      safeProjectPath = validatedPaths.projectPath;
      tasksPath = validatedPaths.tasksPath;
    } catch (validationError) {
      console.warn(`Path validation failed for ${projectPath}:`, validationError.message);
      return res.status(400).json({ 
        error: 'Invalid project path', 
        details: validationError.message,
        watching: false 
      });
    }
    
    // Stop existing watcher for this path if any
    if (fileWatchers.has(safeProjectPath)) {
      fileWatchers.get(safeProjectPath).close();
      fileWatchers.delete(safeProjectPath);
    }
    
    // Clear any existing backoff timer for this path
    if (backoffTimers.has(safeProjectPath)) {
      clearTimeout(backoffTimers.get(safeProjectPath));
      backoffTimers.delete(safeProjectPath);
    }
    
    // Check if tasks directory exists with enhanced error handling
    let tasksDirectoryStats;
    try {
      tasksDirectoryStats = await fs.stat(tasksPath);
      if (!tasksDirectoryStats.isDirectory()) {
        throw new Error('Tasks path exists but is not a directory');
      }
    } catch (error) {
      // Check retry count for this project
      const retryCount = watchRetries.get(safeProjectPath) || 0;
      
      const errorMessage = error.code === 'ENOENT' 
        ? `No tasks directory found at ${tasksPath}`
        : `Cannot access tasks directory: ${error.message}`;
      
      console.warn(`⚠️  ${errorMessage}`);
      
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        console.error(`❌ Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded for project: ${safeProjectPath}`);
        console.error(`   Please create a 'tasks' directory in your project or select a different project.`);
        
        // Clear retry count after max attempts reached
        watchRetries.delete(safeProjectPath);
        
        return res.status(400).json({ 
          error: 'Tasks directory not accessible',
          message: `${errorMessage}. Maximum retry attempts exceeded.`,
          watching: false,
          maxRetriesExceeded: true,
          suggestion: error.code === 'ENOENT' 
            ? 'Please create a \'tasks\' directory in your project or select a different project.'
            : 'Please check file permissions and ensure the tasks directory is accessible.',
          errorCode: error.code
        });
      }
      
      // Increment retry count
      watchRetries.set(safeProjectPath, retryCount + 1);
      
      return res.status(404).json({ 
        error: 'Tasks directory not accessible',
        message: errorMessage,
        watching: false,
        retryCount: retryCount + 1,
        maxRetries: MAX_RETRY_ATTEMPTS,
        suggestion: error.code === 'ENOENT'
          ? 'Create a \'tasks\' directory in your project root to enable file watching.'
          : 'Check file permissions and ensure the directory is accessible.',
        errorCode: error.code
      });
    }
    
    // Reset retry count on successful directory found
    watchRetries.delete(safeProjectPath);
    
    // Start watching the tasks directory with enhanced error handling
    let watcher;
    try {
      watcher = chokidar.watch(tasksPath, {
        persistent: true,
        ignoreInitial: true,
        depth: 1,
        // Add error handling options
        ignorePermissionErrors: true,
        usePolling: false, // Use native events when possible
        interval: 1000,    // Polling interval if usePolling is true
        binaryInterval: 5000 // Polling interval for binary files
      });
    } catch (watcherError) {
      console.error(`❌ Failed to create file watcher for ${tasksPath}:`, watcherError);
      return res.status(500).json({
        error: 'Failed to create file watcher',
        details: watcherError.message,
        watching: false
      });
    }
    
    watcher.on('change', async (filePath) => {
      console.log(`📄 File changed: ${filePath}`);
      
      try {
        // Validate the changed file path for security
        const safeFilePath = PathValidator.validatePath(filePath);
        
        // Ensure the changed file is within the expected tasks directory
        if (!safeFilePath.startsWith(tasksPath)) {
          console.warn(`⚠️  File change detected outside tasks directory: ${filePath}`);
          return;
        }
        
        // Load updated tasks
        const updatedTasks = await loadTasksFromPath(safeProjectPath);
        
        // Broadcast to all SSE connections
        const updateEvent = {
          type: 'tasks-updated',
          data: updatedTasks,
          timestamp: new Date().toISOString(),
          changedFile: path.basename(safeFilePath)
        };
        
        broadcastToSSE(updateEvent);
        console.log(`✅ Successfully updated tasks after file change: ${path.basename(safeFilePath)}`);
      } catch (error) {
        console.error('❌ Error loading updated tasks:', error);
        broadcastToSSE({
          type: 'error',
          message: 'Failed to load updated tasks',
          timestamp: new Date().toISOString(),
          details: error.message,
          errorType: error.name || 'UnknownError'
        });
      }
    });
    
    watcher.on('add', async (filePath) => {
      console.log(`➕ File added: ${filePath}`);
      try {
        const updatedTasks = await loadTasksFromPath(safeProjectPath);
        broadcastToSSE({
          type: 'tasks-updated',
          data: updatedTasks,
          timestamp: new Date().toISOString(),
          changedFile: path.basename(filePath),
          action: 'added'
        });
        console.log(`✅ Successfully updated tasks after file add: ${path.basename(filePath)}`);
      } catch (error) {
        console.error('❌ Error loading tasks after file add:', error);
        broadcastToSSE({
          type: 'error',
          message: 'Failed to load tasks after file addition',
          timestamp: new Date().toISOString(),
          details: error.message
        });
      }
    });
    
    watcher.on('unlink', async (filePath) => {
      console.log(`➖ File removed: ${filePath}`);
      try {
        const updatedTasks = await loadTasksFromPath(safeProjectPath);
        broadcastToSSE({
          type: 'tasks-updated',
          data: updatedTasks,
          timestamp: new Date().toISOString(),
          changedFile: path.basename(filePath),
          action: 'removed'
        });
        console.log(`✅ Successfully updated tasks after file removal: ${path.basename(filePath)}`);
      } catch (error) {
        console.error('❌ Error loading tasks after file removal:', error);
        broadcastToSSE({
          type: 'error',
          message: 'Failed to load tasks after file removal',
          timestamp: new Date().toISOString(),
          details: error.message
        });
      }
    });
    
    // Add error handler for the watcher itself
    watcher.on('error', (error) => {
      console.error(`❌ File watcher error for ${safeProjectPath}:`, error);
      
      // Clean up failed watcher
      if (fileWatchers.has(safeProjectPath)) {
        try {
          fileWatchers.get(safeProjectPath).close();
        } catch (closeError) {
          console.error('Error closing failed watcher:', closeError);
        }
        fileWatchers.delete(safeProjectPath);
      }
      
      // Broadcast error to clients
      broadcastToSSE({
        type: 'watcher-error',
        message: 'File watcher encountered an error',
        projectPath: safeProjectPath,
        timestamp: new Date().toISOString(),
        details: error.message
      });
    });
    
    fileWatchers.set(safeProjectPath, watcher);
    
    console.log(`✅ Started watching project: ${safeProjectPath}`);
    console.log(`📂 Watching tasks directory: ${tasksPath}`);
    
    res.json({
      message: 'Started watching project for changes',
      projectPath: safeProjectPath,
      tasksPath: tasksPath,
      watching: true
    });
    
  } catch (error) {
    console.error('❌ Watch project error:', error);
    
    // Clean up any partial state
    const safeProjectPath = req.body.projectPath ? path.resolve(req.body.projectPath) : null;
    if (safeProjectPath) {
      if (fileWatchers.has(safeProjectPath)) {
        try {
          fileWatchers.get(safeProjectPath).close();
        } catch (closeError) {
          console.error('Error cleaning up watcher after error:', closeError);
        }
        fileWatchers.delete(safeProjectPath);
      }
      
      if (backoffTimers.has(safeProjectPath)) {
        clearTimeout(backoffTimers.get(safeProjectPath));
        backoffTimers.delete(safeProjectPath);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to start watching project',
      details: error.message,
      watching: false
    });
  }
});

// Stop watching a project directory
app.post('/api/unwatch-project', (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    const safeProjectPath = path.resolve(projectPath);
    
    if (fileWatchers.has(safeProjectPath)) {
      fileWatchers.get(safeProjectPath).close();
      fileWatchers.delete(safeProjectPath);
      
      res.json({
        message: 'Stopped watching project',
        projectPath: safeProjectPath,
        watching: false
      });
    } else {
      res.json({
        message: 'Project was not being watched',
        projectPath: safeProjectPath,
        watching: false
      });
    }
    
  } catch (error) {
    console.error('Unwatch project error:', error);
    res.status(500).json({ error: 'Failed to stop watching project' });
  }
});

// Helper function to broadcast to all SSE connections
function broadcastToSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  
  for (const [connectionId, res] of sseConnections) {
    try {
      res.write(message);
    } catch (error) {
      console.error(`Failed to send SSE message to connection ${connectionId}:`, error);
      sseConnections.delete(connectionId);
    }
  }
}

// Helper function to load tasks from a project path (extracted from existing endpoint)
async function loadTasksFromPath(projectPath) {
  let safeProjectPath, tasksPath;
  
  try {
    // Validate paths
    const validatedPaths = PathValidator.validateTasksDirectory(projectPath);
    safeProjectPath = validatedPaths.projectPath;
    tasksPath = validatedPaths.tasksPath;
  } catch (validationError) {
    throw new Error(`Path validation failed: ${validationError.message}`);
  }
  
  // Check if tasks directory exists and is accessible
  try {
    const stats = await fs.stat(tasksPath);
    if (!stats.isDirectory()) {
      return { 
        tasks: [], 
        projectPath: safeProjectPath,
        tasksPath: tasksPath,
        message: 'Tasks path exists but is not a directory'
      };
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { 
        tasks: [], 
        projectPath: safeProjectPath,
        tasksPath: tasksPath,
        message: 'No tasks directory found in project'
      };
    }
    throw new Error(`Cannot access tasks directory: ${error.message}`);
  }
  
  // Look for tasks.json file first
  const tasksJsonPath = path.join(tasksPath, 'tasks.json');
  try {
    // Validate the tasks.json path
    const safeTasksJsonPath = PathValidator.validatePath(tasksJsonPath);
    
    const tasksJsonData = await fs.readFile(safeTasksJsonPath, 'utf8');
    
    let parsedData;
    try {
      parsedData = JSON.parse(tasksJsonData);
    } catch (parseError) {
      console.warn(`Invalid JSON in tasks.json: ${parseError.message}`);
      throw new Error(`Invalid JSON format in tasks.json: ${parseError.message}`);
    }
    
    return { 
      tasks: parsedData.tasks || parsedData || [],
      projectPath: safeProjectPath,
      tasksPath: tasksPath,
      source: 'tasks.json'
    };
  } catch (error) {
    // tasks.json doesn't exist or is invalid, fall back to scanning .txt files
    if (error.code !== 'ENOENT') {
      console.warn(`Error reading tasks.json: ${error.message}`);
    }
  }
  
  // Scan for individual task files (.txt, .md, etc.)
  let taskFiles;
  try {
    taskFiles = await fs.readdir(tasksPath);
  } catch (error) {
    throw new Error(`Cannot read tasks directory: ${error.message}`);
  }
  
  const tasks = [];
  let taskId = 1;
  
  for (const file of taskFiles) {
    // Validate file name to prevent path traversal
    if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) {
      console.warn(`Skipping potentially unsafe file name: ${file}`);
      continue;
    }
    
    if (file.startsWith('task_') && (file.endsWith('.txt') || file.endsWith('.md'))) {
      try {
        const filePath = path.join(tasksPath, file);
        // Validate the full file path
        const safeFilePath = PathValidator.validatePath(filePath);
        
        // Ensure the file is still within the tasks directory after validation
        if (!safeFilePath.startsWith(tasksPath)) {
          console.warn(`File path validation failed - outside tasks directory: ${file}`);
          continue;
        }
        
        const content = await fs.readFile(safeFilePath, 'utf8');
        
        // Parse task content - look for basic structure
        const lines = content.split('\n').filter(line => line.trim());
        const title = lines[0] || file.replace(/\.(txt|md)$/, '');
        const description = lines.slice(1).join('\n').trim() || 'No description available';
        
        tasks.push({
          id: taskId++,
          title: title.replace(/^#*\s*/, ''), // Remove markdown headers
          description: description,
          status: 'pending',
          dependencies: [], // Could be parsed from content later
          filePath: safeFilePath,
          fileName: file
        });
      } catch (fileError) {
        console.warn(`Failed to read task file ${file}:`, fileError.message);
        // Continue processing other files even if one fails
      }
    }
  }
  
  // Additional validation on the final task list
  const validatedTasks = tasks.filter(task => {
    if (!task.title || !task.description) {
      console.warn(`Skipping invalid task: ${task.fileName}`);
      return false;
    }
    return true;
  });
  
  return {
    tasks: validatedTasks,
    projectPath: safeProjectPath,
    tasksPath: tasksPath,
    source: 'individual_files',
    filesFound: validatedTasks.length,
    filesScanned: taskFiles.length
  };
}

// Get directory contents
app.get('/api/browse', async (req, res) => {
  try {
    const { dir = '/' } = req.query;
    
    // Validate and sanitize the directory path
    let safePath;
    try {
      safePath = PathValidator.validatePath(dir);
    } catch (validationError) {
      console.warn(`Path validation failed for browse request: ${dir}`, validationError.message);
      return res.status(400).json({ 
        error: 'Invalid directory path', 
        details: validationError.message 
      });
    }
    
    // Check if directory exists and is accessible
    let stats;
    try {
      stats = await fs.stat(safePath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }
    } catch (error) {
      console.warn(`Directory access failed: ${safePath}`, error.message);
      return res.status(404).json({ 
        error: 'Directory not accessible', 
        details: error.code === 'ENOENT' ? 'Directory does not exist' : 'Permission denied or other access error',
        errorCode: error.code
      });
    }

    const items = await fs.readdir(safePath);
    const result = [];

    for (const item of items) {
      try {
        const itemPath = path.join(safePath, item);
        const itemStats = await fs.stat(itemPath);
        
        // Skip hidden files and system files
        if (item.startsWith('.')) continue;
        
        result.push({
          name: item,
          path: itemPath,
          isDirectory: itemStats.isDirectory(),
          size: itemStats.isDirectory() ? null : itemStats.size,
          modified: itemStats.mtime
        });
      } catch (error) {
        // Skip files we can't access
        continue;
      }
    }

    // Sort directories first, then files
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    res.json({
      currentPath: safePath,
      parent: path.dirname(safePath),
      items: result
    });
  } catch (error) {
    console.error('Browse error:', error);
    res.status(500).json({ error: 'Failed to browse directory' });
  }
});

// Load tasks from a project directory
app.get('/api/tasks', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    // Validate the project path
    let safeProjectPath;
    try {
      const validatedPaths = PathValidator.validateTasksDirectory(projectPath);
      safeProjectPath = validatedPaths.projectPath;
    } catch (validationError) {
      console.warn(`Path validation failed for tasks request: ${projectPath}`, validationError.message);
      return res.status(400).json({ 
        error: 'Invalid project path', 
        details: validationError.message 
      });
    }
    
    const result = await loadTasksFromPath(safeProjectPath);
    res.json(result);
    
  } catch (error) {
    console.error('Tasks loading error:', error);
    res.status(500).json({ 
      error: 'Failed to load tasks from project directory',
      details: error.message,
      errorType: error.name || 'UnknownError'
    });
  }
});

// Get system drives/roots (for cross-platform support)
app.get('/api/drives', async (req, res) => {
  try {
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows: Get available drives
      const drives = [];
      for (let i = 65; i <= 90; i++) {
        const drive = `${String.fromCharCode(i)}:\\`;
        try {
          await fs.access(drive);
          drives.push({
            name: drive,
            path: drive,
            isDirectory: true
          });
        } catch {
          // Drive not available
        }
      }
      res.json({ drives });
    } else {
      // Unix-like systems: Start from root
      res.json({
        drives: [
          { name: '/', path: '/', isDirectory: true },
          { name: 'Users', path: '/Users', isDirectory: true },
          { name: 'home', path: '/home', isDirectory: true }
        ]
      });
    }
  } catch (error) {
    console.error('Drives error:', error);
    res.status(500).json({ error: 'Failed to get system drives' });
  }
});

// Create sample tasks for a project
app.post('/api/create-sample-tasks', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    // Validate the project path
    let safeProjectPath;
    try {
      safeProjectPath = path.resolve(projectPath);
      if (!safeProjectPath.startsWith('/') && !safeProjectPath.match(/^[A-Z]:/)) {
        throw new Error('Invalid project path');
      }
    } catch (validationError) {
      return res.status(400).json({ 
        error: 'Invalid project path', 
        details: validationError.message 
      });
    }
    
    // Ensure the project directory exists
    try {
      await fs.access(safeProjectPath);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Project directory does not exist',
        path: safeProjectPath
      });
    }
    
    // Create tasks directory if it doesn't exist
    const tasksDir = path.join(safeProjectPath, 'tasks');
    await fs.mkdir(tasksDir, { recursive: true });
    
    // Sample tasks data
    const sampleTasks = {
      tasks: [
        {
          id: 1,
          title: "Project Setup",
          description: "Set up the basic project structure and development environment",
          status: "done",
          priority: "high",
          dependencies: [],
          subtasks: [
            { id: 1, title: "Initialize repository", status: "done" },
            { id: 2, title: "Install dependencies", status: "done" },
            { id: 3, title: "Configure build tools", status: "done" }
          ]
        },
        {
          id: 2,
          title: "User Interface Development",
          description: "Design and implement the main user interface components",
          status: "in-progress",
          priority: "high",
          dependencies: [1],
          subtasks: [
            { id: 1, title: "Create wireframes", status: "done" },
            { id: 2, title: "Implement layout components", status: "in-progress" },
            { id: 3, title: "Add styling and themes", status: "pending" }
          ]
        },
        {
          id: 3,
          title: "Backend API Development",
          description: "Develop the server-side API endpoints and database integration",
          status: "pending",
          priority: "medium",
          dependencies: [1],
          subtasks: [
            { id: 1, title: "Design database schema", status: "pending" },
            { id: 2, title: "Implement API routes", status: "pending" },
            { id: 3, title: "Add authentication", status: "pending" }
          ]
        },
        {
          id: 4,
          title: "Testing and Quality Assurance",
          description: "Comprehensive testing of all application features",
          status: "pending",
          priority: "medium",
          dependencies: [2, 3],
          subtasks: [
            { id: 1, title: "Unit tests", status: "pending" },
            { id: 2, title: "Integration tests", status: "pending" },
            { id: 3, title: "User acceptance testing", status: "pending" }
          ]
        },
        {
          id: 5,
          title: "Documentation",
          description: "Create comprehensive documentation for users and developers",
          status: "pending",
          priority: "low",
          dependencies: [4],
          subtasks: [
            { id: 1, title: "User guide", status: "pending" },
            { id: 2, title: "API documentation", status: "pending" },
            { id: 3, title: "Developer setup guide", status: "pending" }
          ]
        }
      ]
    };
    
    // Write the sample tasks file
    const tasksFilePath = path.join(tasksDir, 'tasks.json');
    await fs.writeFile(tasksFilePath, JSON.stringify(sampleTasks, null, 2));
    
    res.json({ 
      success: true,
      message: 'Sample tasks created successfully',
      tasksPath: tasksFilePath,
      taskCount: sampleTasks.tasks.length
    });
    
  } catch (error) {
    console.error('Create sample tasks error:', error);
    res.status(500).json({ 
      error: 'Failed to create sample tasks',
      details: error.message
    });
  }
});

// Handle user feedback
app.post('/api/feedback', async (req, res) => {
  try {
    const { feedback, context, projectPath, timestamp } = req.body;
    
    if (!feedback || !feedback.trim()) {
      return res.status(400).json({ error: 'Feedback content is required' });
    }
    
    // Create feedback entry
    const feedbackEntry = {
      id: Date.now().toString(),
      feedback: feedback.trim(),
      context: context || 'general',
      projectPath: projectPath || null,
      timestamp: timestamp || new Date().toISOString(),
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.ip || req.connection.remoteAddress || 'unknown'
    };
    
    // Log feedback to console (in a real app, you'd save to a database)
    console.log('📝 User Feedback Received:', {
      ...feedbackEntry,
      ip: '[REDACTED]' // Don't log IP for privacy
    });
    
    // You could save to a file or database here
    // For now, we'll just acknowledge receipt
    
    res.json({ 
      success: true,
      message: 'Feedback received successfully',
      id: feedbackEntry.id
    });
    
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ 
      error: 'Failed to submit feedback',
      details: error.message
    });
  }
});

// Fallback for SPA routing - must have dist directory
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).json({ 
      error: 'Application not built. Please run "npm run build" first.',
      hint: 'If you installed via npx, this should have been done automatically.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 TaskMaster Visualizer Server`);
  console.log(`📡 Running on: http://localhost:${PORT}`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Serving from: ${distPath}`);
  console.log(`\n🔗 Open http://localhost:${PORT} in your browser\n`);
});
