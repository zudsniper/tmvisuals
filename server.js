import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { resolveTaskmasterPaths } from './utils/paths.js';

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
    const { tasksDir, mode } = resolveTaskmasterPaths(safeProjectPath);

    // Stop existing watcher for this path if any
    if (fileWatchers.has(safeProjectPath)) {
      fileWatchers.get(safeProjectPath).close();
    }

    // Watch the resolved tasks directory
    let directoriesToWatch = [tasksDir];
    if (mode === 'legacy') {
      // Also watch legacy directory for backward compatibility
      directoriesToWatch.push(path.join(safeProjectPath, 'tasks'));
    }

    directoriesToWatch.forEach(dir => {
      if (!fs.existsSync(dir)) {
        return res.json({ 
          message: `No tasks directory found to watch at ${dir}`,
          watching: false
        });
      }
    });

    // Start watching the tasks directory
    const watcher = chokidar.watch(directoriesToWatch, {
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
          changedFile: path.basename(filePath),
          mode: mode
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

// Helper function to load tasks from a project path using the resolver utility
async function loadTasksFromPath(projectPath) {
  const safeProjectPath = path.resolve(projectPath);
  
  // Use the resolver utility to determine paths and mode
  const paths = resolveTaskmasterPaths(safeProjectPath);
  
  // Check if tasks directory/file exists
  if (!fs.existsSync(paths.tasksJson)) {
    return { 
      tasks: [], 
      projectPath: safeProjectPath,
      mode: paths.mode,
      message: `No tasks file found at ${paths.tasksJson}`
    };
  }
  
  let tasks = [];
  let config = null;
  let report = null;
  
  // Load tasks.json
  try {
    const tasksJsonData = await fs.readFile(paths.tasksJson, 'utf8');
    const parsedData = JSON.parse(tasksJsonData);
    tasks = parsedData.tasks || parsedData || [];
  } catch (error) {
    console.warn(`Failed to read tasks.json: ${error.message}`);
    
    // Fallback: scan for individual task files (legacy behavior)
    if (fs.existsSync(paths.tasksDir)) {
      const taskFiles = await fs.readdir(paths.tasksDir);
      let taskId = 1;
      
      for (const file of taskFiles) {
        if (file.startsWith('task_') && (file.endsWith('.txt') || file.endsWith('.md'))) {
          try {
            const filePath = path.join(paths.tasksDir, file);
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
    }
  }
  
  // For v2 mode, load additional files
  if (paths.mode === 'v2') {
    // Load config.json if it exists
    if (paths.configJson && fs.existsSync(paths.configJson)) {
      try {
        const configData = await fs.readFile(paths.configJson, 'utf8');
        config = JSON.parse(configData);
      } catch (error) {
        console.warn(`Failed to read config.json: ${error.message}`);
      }
    }
    
    // Load the latest report from reports/ directory if it exists
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
  }
  
  return { 
    tasks,
    projectPath: safeProjectPath,
    mode: paths.mode,
    ...(config && { config }),
    ...(report && { report })
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
    const homeDir = require('os').homedir();
    
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
