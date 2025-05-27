import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the dist directory when built
app.use(express.static(path.join(__dirname, 'dist')));

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
    
    // Security: Prevent directory traversal attacks
    const safeProjectPath = path.resolve(projectPath);
    const tasksPath = path.join(safeProjectPath, 'tasks');
    
    // Check if project directory exists
    try {
      const projectStats = await fs.stat(safeProjectPath);
      if (!projectStats.isDirectory()) {
        return res.status(400).json({ error: 'Project path is not a directory' });
      }
    } catch (error) {
      return res.status(404).json({ error: 'Project directory not found' });
    }
    
    // Check if tasks directory exists
    let tasksExist = false;
    try {
      const tasksStats = await fs.stat(tasksPath);
      tasksExist = tasksStats.isDirectory();
    } catch (error) {
      // Tasks directory doesn't exist - that's okay, return empty tasks
    }
    
    if (!tasksExist) {
      return res.json({ 
        tasks: [], 
        projectPath: safeProjectPath,
        tasksPath: tasksPath,
        message: 'No tasks directory found in project. Create a tasks/ directory to add tasks.'
      });
    }
    
    // Look for tasks.json file first
    const tasksJsonPath = path.join(tasksPath, 'tasks.json');
    try {
      const tasksJsonData = await fs.readFile(tasksJsonPath, 'utf8');
      const parsedData = JSON.parse(tasksJsonData);
      return res.json({ 
        tasks: parsedData.tasks || parsedData || [],
        projectPath: safeProjectPath,
        tasksPath: tasksPath,
        source: 'tasks.json'
      });
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
    
    res.json({ 
      tasks,
      projectPath: safeProjectPath,
      tasksPath: tasksPath,
      source: 'individual_files',
      filesFound: tasks.length
    });
    
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

// Fallback for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
