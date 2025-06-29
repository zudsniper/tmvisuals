import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { resolveTaskmasterPaths } from './utils/paths.js';

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

// Root route - show helpful message if someone visits the API directly
// This MUST be defined before static middleware to take precedence
app.get('/', (req, res) => {
  const PORT_UI = process.env.PORT_UI || 5551;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>⚠️ Wrong URL - This is the API Server</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: #0d1117;
          color: #c9d1d9;
          overflow: hidden;
        }
        .container {
          text-align: center;
          padding: 3rem;
          background: #161b22;
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          border: 1px solid #30363d;
          max-width: 600px;
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        h1 { 
          color: #f85149; 
          margin-bottom: 1.5rem;
          font-size: 3rem;
          font-weight: 700;
          text-shadow: 0 2px 4px rgba(248, 81, 73, 0.3);
        }
        .error-icon {
          font-size: 5rem;
          margin-bottom: 1rem;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        p { 
          color: #8b949e; 
          margin: 1rem 0;
          font-size: 1.1rem;
          line-height: 1.6;
        }
        .highlight {
          color: #58a6ff;
          font-weight: 600;
        }
        a {
          display: inline-block;
          margin-top: 2rem;
          padding: 1rem 3rem;
          background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1.2rem;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
        }
        a:hover { 
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(35, 134, 54, 0.4);
        }
        code {
          background: #0d1117;
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
          font-size: 1rem;
          border: 1px solid #30363d;
        }
        .api-info {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid #30363d;
          font-size: 0.9rem;
          color: #6e7681;
        }
        .warning-box {
          background: rgba(248, 81, 73, 0.1);
          border: 2px solid #f85149;
          border-radius: 8px;
          padding: 1.5rem;
          margin: 2rem 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon">🚫</div>
        <h1>WRONG URL!</h1>
        <div class="warning-box">
          <p><strong>You're on the API server!</strong></p>
          <p>This is <span class="highlight">NOT</span> where the TaskMaster Visualizer UI is located.</p>
        </div>
        <p>The API server is running on port <code>${PORT}</code></p>
        <p>To access the TaskMaster Visualizer UI, please go to:</p>
        <a href="http://localhost:${PORT_UI}">
          🚀 Open TaskMaster Visualizer
          <br>
          <small style="font-size: 0.8rem; opacity: 0.8;">http://localhost:${PORT_UI}</small>
        </a>
        <div class="api-info">
          <p>This server provides API endpoints for:</p>
          <p>📁 File operations • 🔄 Live updates • 📊 Task management</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Serve static files from the dist directory when built
const distPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');

if (fs.existsSync(distPath)) {
  // Use a custom static middleware that skips the root path
  app.use((req, res, next) => {
    if (req.path === '/') {
      // Skip static serving for root path
      return next();
    }
    express.static(distPath)(req, res, next);
  });
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
    let { tasksDir, mode } = resolveTaskmasterPaths(projectPath);
    let safeProjectPath = path.resolve(projectPath);

    // Validate project path
    try {
      const validatedPaths = PathValidator.validateTasksDirectory(projectPath);
      safeProjectPath = validatedPaths.projectPath;
      // Use validated paths as fallback
      tasksDir = tasksDir || validatedPaths.tasksPath;
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

    // Watch the resolved tasks directory
    let directoriesToWatch = [tasksDir];
    if (mode === 'legacy') {
      // Also watch legacy directory for backward compatibility
      directoriesToWatch.push(path.join(safeProjectPath, 'tasks'));
    }

    const existingDirs = directoriesToWatch.filter(dir => fs.existsSync(dir));

    if (existingDirs.length === 0) {
        const retryCount = watchRetries.get(safeProjectPath) || 0;

        if (retryCount >= MAX_RETRY_ATTEMPTS) {
            watchRetries.delete(safeProjectPath);
            return res.status(400).json({
                error: 'Tasks directory not accessible',
                message: `No tasks directory found in any of the expected locations. Maximum retry attempts exceeded.`,
                watching: false,
                suggestion: 'Please create a \'tasks\' or \'.taskmaster/tasks\' directory in your project.',
            });
        }

        watchRetries.set(safeProjectPath, retryCount + 1);

        return res.status(404).json({
            error: 'Tasks directory not accessible',
            message: `No tasks directory found in any of the expected locations.`,
            watching: false,
            retryCount: retryCount + 1,
            maxRetries: MAX_RETRY_ATTEMPTS,
            suggestion: 'Create a \'tasks\' or \'.taskmaster/tasks\' directory in your project root to enable file watching.',
        });
    }

    // Watch the existing directories
    directoriesToWatch = existingDirs;

    watchRetries.delete(safeProjectPath);

    const watcher = chokidar.watch(directoriesToWatch, {
      // Improved watching options merging previous logic
      persistent: true,
      ignoreInitial: true,
      depth: 1,
      ignorePermissionErrors: true,
      usePolling: false,
      interval: 1000,
      binaryInterval: 5000
    });

    watcher.on('change', async (filePath) => {
      console.log(`📄 File changed: ${filePath}`);
      
      try {
        // Validate the changed file path for security
        const safeFilePath = PathValidator.validatePath(filePath);
        
        // Ensure the changed file is within the expected tasks directory
        // Check if file is within any of the watched directories
        const isInWatchedDir = directoriesToWatch.some(dir => safeFilePath.startsWith(dir));
        if (!isInWatchedDir) {
          console.warn(`⚠️  File change detected outside watched directories: ${filePath}`);
          return;
        }
        
        // Load updated tasks
        const updatedTasks = await loadTasksFromPath(safeProjectPath);
        
        // Broadcast to all SSE connections
        const updateEvent = {
          type: 'tasks-updated',
          data: updatedTasks,
          timestamp: new Date().toISOString(),
          changedFile: path.basename(filePath),
          mode: mode
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
    console.log(`📂 Watching directories: ${directoriesToWatch.join(', ')}`);
    
    res.json({
      message: 'Started watching project for changes',
      projectPath: safeProjectPath,
      watchedDirectories: directoriesToWatch,
      mode: mode,
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

// Helper function to load tasks from a project path using the resolver utility
async function loadTasksFromPath(projectPath) {
  let safeProjectPath;
  
  try {
    // Validate paths
    const validatedPaths = PathValidator.validateTasksDirectory(projectPath);
    safeProjectPath = validatedPaths.projectPath;
  } catch (validationError) {
    throw new Error(`Path validation failed: ${validationError.message}`);
  }
  
  // Use the resolver utility to determine paths
  const paths = resolveTaskmasterPaths(safeProjectPath);
  
  // Check if .taskmaster exists
  if (!paths.exists) {
    return { 
      tasks: [], 
      projectPath: safeProjectPath,
      mode: paths.mode,
      message: `No .taskmaster directory found. Please ensure this is a valid TaskMaster project.`
    };
  }
  
  let tasks = [];
  let config = null;
  let state = null;
  let report = null;
  let currentTag = 'master'; // default tag
  
  // Load state.json to determine current tag
  if (paths.stateJson && fs.existsSync(paths.stateJson)) {
    try {
      const stateData = await fs.readFile(paths.stateJson, 'utf8');
      state = JSON.parse(stateData);
      currentTag = state.currentTag || 'master';
      console.log(`Current TaskMaster tag: ${currentTag}`);
    } catch (error) {
      console.warn(`Failed to read state.json: ${error.message}`);
    }
  }
  
  // Load tasks.json which contains multi-tag structure
  let parsedData = null;
  if (fs.existsSync(paths.tasksJson)) {
    try {
      console.log(`Loading tasks.json from: ${paths.tasksJson}`);
      const tasksJsonData = await fs.readFile(paths.tasksJson, 'utf8');
      parsedData = JSON.parse(tasksJsonData);
      
      // New multi-tag structure
      if (parsedData[currentTag]) {
        const tagData = parsedData[currentTag];
        tasks = tagData.tasks || [];
        console.log(`Loaded ${tasks.length} tasks for tag '${currentTag}'`);
      } else {
        console.warn(`No tasks found for tag '${currentTag}' in tasks.json`);
        // Try to fallback to 'master' tag
        if (parsedData.master) {
          tasks = parsedData.master.tasks || [];
          console.log(`Fallback: Loaded ${tasks.length} tasks from 'master' tag`);
        }
      }
    } catch (error) {
      console.error(`Failed to read or parse tasks.json: ${error.message}`);
      throw new Error(`Failed to load tasks: ${error.message}`);
    }
  } else {
    throw new Error(`No tasks.json found at ${paths.tasksJson}`);
  }
  
  // Process subtasks to ensure they have proper structure
  tasks = tasks.map(task => {
    // Process subtasks if they exist
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks = task.subtasks.map((subtask, index) => {
        // Ensure subtask has all required fields
        return {
          id: subtask.id || index + 1,
          title: subtask.title || 'Untitled Subtask',
          description: subtask.description || '',
          status: subtask.status || 'pending',
          dependencies: subtask.dependencies || [],
          details: subtask.details || '',
          priority: subtask.priority || task.priority || 'medium'
        };
      });
    }
    
    // Ensure task has all required properties
    return {
      ...task,
      subtasks: task.subtasks || [],
      dependencies: task.dependencies || [],
      status: task.status || 'pending',
      priority: task.priority || 'medium',
      description: task.description || 'No description available',
      details: task.details || '',
      testStrategy: task.testStrategy || ''
    };
  });
  
  // Load config.json
  if (paths.configJson && fs.existsSync(paths.configJson)) {
    try {
      const configData = await fs.readFile(paths.configJson, 'utf8');
      config = JSON.parse(configData);
      
      // Transform config to match expected format for UI
      // Extract model names from the models object
      if (config.models) {
        const modelNames = [];
        for (const [role, modelConfig] of Object.entries(config.models)) {
          if (modelConfig && modelConfig.modelId) {
            modelNames.push(`${role}: ${modelConfig.modelId}`);
          }
        }
        config.modelNames = modelNames; // For UI display
      }
    } catch (error) {
      console.warn(`Failed to read config.json: ${error.message}`);
    }
  }
  
  // Load the latest report from reports/ directory
  if (paths.reportsDir && fs.existsSync(paths.reportsDir)) {
    try {
      const reportFiles = await fs.readdir(paths.reportsDir);
      const jsonReports = reportFiles
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(paths.reportsDir, file),
          stats: fs.statSync(path.join(paths.reportsDir, file))
        }))
        .sort((a, b) => b.stats.mtime - a.stats.mtime); // Sort by modification time, newest first
      
      if (jsonReports.length > 0) {
        const latestReport = jsonReports[0];
        const reportData = await fs.readFile(latestReport.path, 'utf8');
        report = JSON.parse(reportData);
      }
    } catch (error) {
      console.warn(`Failed to read reports: ${error.message}`);
    }
  }
  
  return {
    tasks: tasks,
    projectPath: safeProjectPath,
    mode: paths.mode,
    currentTag: currentTag,
    availableTags: parsedData ? Object.keys(parsedData) : ['master'],
    ...(config && { config }),
    ...(state && { state }),
    ...(report && { report })
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
    const os = await import('os');
    const homeDir = os.homedir();
    
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
      // Add user home directory
      if (homeDir) {
        drives.unshift({
          name: 'Home',
          path: homeDir,
          isDirectory: true
        });
      }
      res.json({ drives, homeDirectory: homeDir });
    } else {
      // Unix-like systems: Start from root and user home
      const drives = [
        { name: '/', path: '/', isDirectory: true },
        { name: 'home', path: '/home', isDirectory: true }
      ];
      
      // Add user home directory at the beginning for easy access
      if (homeDir) {
        drives.unshift({
          name: 'Home',
          path: homeDir,
          isDirectory: true
        });
      }
      
      res.json({
        drives,
        homeDirectory: homeDir
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
  console.log(`\n🚀 TaskMaster Visualizer API Server`);
  console.log(`📡 API running on: http://localhost:${PORT}`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Serving from: ${distPath}`);
  console.log(`\n⚠️  This is the API server. To view the app:`);
  console.log(`🔗 Open http://localhost:5551 in your browser (Vite dev server)\n`);
});
