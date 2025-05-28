# TaskMaster Visualizer 🎯

> **Interactive mind map visualization for Claude Task Master tasks with hierarchical dependencies, status tracking, and editor integration.**

[![npm version](https://badge.fury.io/js/tmvisuals.svg)](https://www.npmjs.com/package/tmvisuals)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

### One-Command Launch (Recommended)

```bash
npx tmvisuals
```

That's it! This will:
1. ✅ Download and install the visualizer
2. ✅ Build the application automatically 
3. ✅ Start the web server
4. ✅ Open the visualization interface at `http://localhost:3001`

### Custom Port

```bash
npx tmvisuals --port 8080
```

### Help & Version

```bash
npx tmvisuals --help     # Show usage information
npx tmvisuals --version  # Show version
```

## 📋 Prerequisites

- **Node.js 16+** (Download from [nodejs.org](https://nodejs.org/))
- **TaskMaster project** with a `tasks/` directory containing:
  - `tasks.json` file (preferred), OR
  - Individual `task_*.txt` files

## 🎯 Features

### Core Visualization
- **📊 Mind Map**: ReactFlow-based interactive task graph
- **🏗️ Hierarchical Display**: Parent tasks with subtask progress tracking  
- **🔗 Dependencies**: Animated edges showing task relationships
- **📈 Status Tracking**: Visual indicators for pending/in-progress/done
- **🎨 Priority Colors**: Visual borders for high/medium/low priority tasks

### Layout Modes
- **📐 Grid Layout**: Clean, organized grid view
- **🌐 Graph Layout**: Timeline-based dependency flow
- **🔄 Dynamic Switching**: Toggle between layouts instantly

### Interaction & Integration
- **📝 Editor Integration**: Open tasks in VSCode or Cursor
- **🔍 Search & Filter**: Find tasks quickly
- **📱 Responsive Design**: Works on desktop and mobile
- **🌙 Dark/Light Theme**: System preference or manual toggle
- **💾 State Persistence**: Remembers your layout and preferences

### File Browser
- **📂 Cross-Platform**: Browse directories on Windows, macOS, Linux
- **🎯 Project Detection**: Automatically find TaskMaster projects
- **🔒 Secure**: Built-in path traversal protection

## 📁 Project Structure Requirements

Your TaskMaster project should have this structure:

```
your-project/
├── tasks/
│   ├── tasks.json           # ← Primary format (recommended)
│   ├── task_001.txt         # ← Alternative: individual files
│   ├── task_002.txt
│   └── ...
└── other-project-files...
```

### tasks.json Format

```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Setup Project Structure",
      "description": "Create the basic project layout...",
      "details": "Implementation details...",
      "testStrategy": "Testing approach...",
      "priority": "high",
      "status": "done",
      "dependencies": [],
      "subtasks": [
        {
          "id": "1.1",
          "title": "Create directories",
          "description": "...",
          "status": "done"
        }
      ]
    }
  ]
}
```

## 🛠️ Installation Methods

### Method 1: NPX (Recommended)
```bash
# Run directly without installation
npx tmvisuals

# Always get latest version
npx tmvisuals@latest
```

### Method 2: Global Installation
```bash
# Install globally
npm install -g tmvisuals

# Run from anywhere
tmvisuals
```

### Method 3: Local Development
```bash
# Clone repository
git clone https://github.com/yourusername/tmvisuals.git
cd tmvisuals

# Install dependencies
npm install

# Development mode (hot reload)
npm run dev:full

# Production build + serve
npm start
```

## 🎮 Usage Guide

### 1. **Launch the Visualizer**
```bash
npx tmvisuals
```

### 2. **Navigate to Your Project**
- Use the built-in file browser
- Navigate to your TaskMaster project directory
- Look for the folder containing your `tasks/` directory

### 3. **Load Your Tasks**
- Click "Load Tasks" when you find your project
- The visualizer will automatically detect and parse your tasks
- Switch between Grid and Graph layouts as needed

### 4. **Interact with Tasks**
- **Click** any task node to view details
- **Drag** nodes to reposition them
- **Update status** in the details panel
- **Open in editor** using the external link icon

### 5. **Customize Your View**
- Toggle between light/dark themes
- Switch layout modes (Grid vs Graph)
- Use search to filter tasks
- Adjust editor preference (VSCode/Cursor)

## ⚙️ Configuration

### Environment Variables

```bash
PORT=3001                    # Server port (default: 3001)
NODE_ENV=production         # Environment mode
```

### Command Line Options

```bash
tmvisuals --port 8080       # Custom port
tmvisuals --help            # Show help
tmvisuals --version         # Show version
```

## 🔧 Advanced Usage

### Custom Build

```bash
# Clone and modify
git clone https://github.com/yourusername/tmvisuals.git
cd tmvisuals

# Install dependencies  
npm install

# Build for production
npm run build

# Start production server
npm run server
```

### Development Mode

```bash
# Run with hot reload
npm run dev:full

# Frontend only (port 5173)
npm run dev

# Backend only (port 3001) 
npm run dev:server
```

## 🌐 API Endpoints

The visualizer provides these API endpoints:

```
GET  /api/health            # Health check
GET  /api/browse?dir=path   # Browse directories  
GET  /api/tasks?projectPath # Load tasks from project
GET  /api/drives            # Get system drives
```

## 🔒 Security Features

- **Path Traversal Protection**: Prevents access outside allowed directories
- **Input Sanitization**: All user inputs are validated
- **CORS Enabled**: Secure cross-origin requests
- **No External Dependencies**: Self-contained application

## 🐛 Troubleshooting

### Common Issues

**"Application not built" error:**
```bash
npm run build  # Rebuild the application
```

**Port already in use:**
```bash
npx tmvisuals --port 8080  # Use different port
```

**Tasks not loading:**
- Ensure your project has a `tasks/` directory
- Check that `tasks.json` exists and is valid JSON
- Verify file permissions

**Editor integration not working:**
- Install VSCode or Cursor
- Check that the editor is in your system PATH
- Update editor preference in Settings

### Debug Mode

```bash
DEBUG=1 npx tmvisuals  # Enable debug logging
```

### Clear Cache

```bash
# Clear npm cache
npm cache clean --force

# Reinstall
npx tmvisuals@latest
```

## 📦 Package Contents

When installed via npm, the package includes:

```
tmvisuals/
├── bin/tmvisuals.js        # Executable entry point
├── dist/                   # Built web application
├── server.js               # Express server
├── package.json            # Package metadata
└── README.md              # This documentation
```

## 🚀 Deployment Options

### 1. Local Development Server
```bash
npx tmvisuals  # Perfect for local use
```

### 2. Production Server
```bash
# Build and serve
npm run build
NODE_ENV=production npm run server
```

### 3. Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

### 4. Cloud Deployment
- **Heroku**: `git push heroku main`
- **Vercel**: Connect GitHub repository
- **Railway**: Deploy from GitHub
- **DigitalOcean**: Use App Platform

## 🔄 Updates

```bash
# Get latest version
npx tmvisuals@latest

# Check current version
npx tmvisuals --version
```

## 🤝 Contributing

```bash
# Development setup
git clone https://github.com/yourusername/tmvisuals.git
cd tmvisuals
npm install
npm run dev:full
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- **GitHub**: https://github.com/yourusername/tmvisuals
- **NPM**: https://www.npmjs.com/package/tmvisuals  
- **Issues**: https://github.com/yourusername/tmvisuals/issues
- **TaskMaster**: https://github.com/taskmaster-ai/taskmaster

---

**Made with ❤️ for the TaskMaster community**