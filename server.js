import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

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
app.post('/api/watch-project', (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    const safeProjectPath = path.resolve(projectPath);
    const tasksPath = path.join(safeProjectPath, 'tasks');
    
    // Stop existing watcher for this path if any
    if (fileWatchers.has(safeProjectPath)) {
      fileWatchers.get(safeProjectPath).close();
    }
    
    // Check if tasks directory exists
    if (!fs.existsSync(tasksPath)) {
      return res.json({ 
        message: 'No tasks directory found to watch',
        watching: false
      });
    }
    
    // Start watching the tasks directory
    const watcher = chokidar.watch(tasksPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 1
    });
    
    watcher.on('change', async (filePath) => {
      console.log(`File changed: ${filePath}`);
      
      try {
        // Load updated tasks
        const updatedTasks = await loadTasksFromPath(safeProjectPath);
        
        // Broadcast to all SSE connections
        const updateEvent = {
          type: 'tasks-updated',
          data: updatedTasks,
          timestamp: new Date().toISOString(),
          changedFile: path.basename(filePath)
        };
        
        broadcastToSSE(updateEvent);
      } catch (error) {
        console.error('Error loading updated tasks:', error);
        broadcastToSSE({
          type: 'error',
          message: 'Failed to load updated tasks',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    watcher.on('add', async (filePath) => {
      console.log(`File added: ${filePath}`);
      try {
        const updatedTasks = await loadTasksFromPath(safeProjectPath);
        broadcastToSSE({
          type: 'tasks-updated',
          data: updatedTasks,
          timestamp: new Date().toISOString(),
          changedFile: path.basename(filePath),
          action: 'added'
        });
      } catch (error) {
        console.error('Error loading tasks after file add:', error);
      }
    });
    
    watcher.on('unlink', async (filePath) => {
      console.log(`File removed: ${filePath}`);
      try {
        const updatedTasks = await loadTasksFromPath(safeProjectPath);
        broadcastToSSE({
          type: 'tasks-updated',
          data: updatedTasks,
          timestamp: new Date().toISOString(),
          changedFile: path.basename(filePath),
          action: 'removed'
        });
      } catch (error) {
        console.error('Error loading tasks after file removal:', error);
      }
    });
    
    fileWatchers.set(safeProjectPath, watcher);
    
    res.json({
      message: 'Started watching project for changes',
      projectPath: safeProjectPath,
      tasksPath: tasksPath,
      watching: true
    });
    
  } catch (error) {
    console.error('Watch project error:', error);
    res.status(500).json({ error: 'Failed to start watching project' });
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
  const safeProjectPath = path.resolve(projectPath);
  const tasksPath = path.join(safeProjectPath, 'tasks');
  
  // Check if tasks directory exists
  if (!fs.existsSync(tasksPath)) {
    return { 
      tasks: [], 
      projectPath: safeProjectPath,
      tasksPath: tasksPath,
      message: 'No tasks directory found in project'
    };
  }
  
  // Look for tasks.json file first
  const tasksJsonPath = path.join(tasksPath, 'tasks.json');
  try {
    const tasksJsonData = await fs.readFile(tasksJsonPath, 'utf8');
    const parsedData = JSON.parse(tasksJsonData);
    return { 
      tasks: parsedData.tasks || parsedData || [],
      projectPath: safeProjectPath,
      tasksPath: tasksPath,
      source: 'tasks.json'
    };
  } catch (error) {
    // tasks.json doesn't exist or is invalid, fall back to scanning .txt files
  }
  
  // Scan for individual task files (.txt, .md, etc.)
  const taskFiles = await fs.readdir(tasksPath);
  const tasks = [];
  let taskId = 1;
  
  for (const file of taskFiles) {
    if (file.startsWith('task_') && (file.endsWith('.txt') || file.endsWith('.md'))) {
      try {
        const filePath = path.join(tasksPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        
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
          filePath: filePath,
          fileName: file
        });
      } catch (fileError) {
        console.warn(`Failed to read task file ${file}:`, fileError.message);
      }
    }
  }
  
  return { 
    tasks,
    projectPath: safeProjectPath,
    tasksPath: tasksPath,
    source: 'individual_files',
    filesFound: tasks.length
  };
}

// Get directory contents
app.get('/api/browse', async (req, res) => {
  try {
    const { dir = '/' } = req.query;
    
    // Security: Prevent directory traversal attacks
    const safePath = path.resolve(dir);
    
    // Check if directory exists and is accessible
    const stats = await fs.stat(safePath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
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
    
    const result = await loadTasksFromPath(projectPath);
    res.json(result);
    
  } catch (error) {
    console.error('Tasks loading error:', error);
    res.status(500).json({ error: 'Failed to load tasks from project directory' });
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
