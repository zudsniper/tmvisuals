#!/usr/bin/env node

import { exec, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🚀 Starting TaskMaster Visualizer...\n');

// Check if dist directory exists (built assets)
const distPath = path.join(projectRoot, 'dist');
const packageJsonPath = path.join(projectRoot, 'package.json');

function checkBuildStatus() {
  const isDevelopmentEnv = fs.existsSync(path.join(projectRoot, '.git'));

  if (!fs.existsSync(distPath) || !fs.existsSync(path.join(distPath, 'index.html'))) {
    if (isDevelopmentEnv) {
      console.log('📦 Building application (dist missing or incomplete in development mode)...');
      return false; // Needs build
    } else {
      // In a packaged environment, missing dist is a critical issue.
      // Return a specific marker to indicate this critical state.
      console.error('❌ Critical: Application distribution is missing or corrupted.');
      return 'critical_error';
    }
  }
  
  // For development environments, check if package.json is newer than the build.
  // For packaged environments, assume the build is fine if it exists.
  if (isDevelopmentEnv) {
    const distStat = fs.statSync(path.join(distPath, 'index.html')); // Known to exist from check above
    const packageStat = fs.statSync(packageJsonPath);

    if (packageStat.mtime > distStat.mtime) {
      console.log('📦 Rebuilding application (package.json updated in development mode)...');
      return false; // Needs build
    }
  }
  
  return true; // Build is okay or assumed okay in packaged mode
}

function buildApp() {
  return new Promise((resolve, reject) => {
    console.log('Building application...');
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true
    });
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Build complete!\n');
        resolve();
      } else {
        console.error('❌ Build failed');
        reject(new Error(`Build process exited with code ${code}`));
      }
    });
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    // Find an available port
    const port = process.env.PORT || 3001;
    
    console.log(`🌐 Starting server on port ${port}...`);
    
    const serverProcess = spawn('node', ['server.js'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PORT: port }
    });
    
    // Give the server a moment to start
    setTimeout(() => {
      console.log(`\n✅ TaskMaster Visualizer is running!`);
      console.log(`\n🔗 Open your browser to: http://localhost:${port}`);
      console.log('\n📋 Instructions:');
      console.log('   1. Use the file browser to navigate to your project directory');
      console.log('   2. Select a directory containing a "tasks/" folder');
      console.log('   3. Your TaskMaster tasks will be visualized automatically');
      console.log('\n⚡ Press Ctrl+C to stop the server\n');
      
      resolve();
    }, 2000);
    
    serverProcess.on('error', (error) => {
      console.error('❌ Failed to start server:', error.message);
      reject(error);
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n\n👋 Shutting down TaskMaster Visualizer...');
      serverProcess.kill('SIGINT');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      serverProcess.kill('SIGTERM');
      process.exit(0);
    });
  });
}

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const helpFlag = args.includes('--help') || args.includes('-h');
    const versionFlag = args.includes('--version') || args.includes('-v');
    const portFlag = args.findIndex(arg => arg === '--port' || arg === '-p');
    
    if (helpFlag) {
      console.log(`
TaskMaster Visualizer - Interactive mind map for TaskMaster tasks

Usage:
  npx tmvisuals                 Start the visualizer
  npx tmvisuals --port 3002     Start on a specific port
  npx tmvisuals --help          Show this help message
  npx tmvisuals --version       Show version information

Features:
  • Interactive mind map visualization
  • Hierarchical task display with dependencies
  • Status management and progress tracking
  • Editor integration (VSCode/Cursor)
  • Real-time task updates
  • Multiple layout modes (grid/graph)

The visualizer will start a web server and open a file browser to help you
navigate to your TaskMaster project directory.
      `);
      process.exit(0);
    }
    
    if (versionFlag) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      console.log(`TaskMaster Visualizer v${packageJson.version}`);
      process.exit(0);
    }
    
    if (portFlag !== -1 && args[portFlag + 1]) {
      process.env.PORT = args[portFlag + 1];
    }
    
    // Check if build is needed
    const buildStatus = checkBuildStatus();

    if (buildStatus === 'critical_error') {
      console.error('❌ Error starting TaskMaster Visualizer: Application files are missing. Please try reinstalling tmvisuals.');
      process.exit(1);
    }

    if (buildStatus === false) { // Explicitly false, meaning needs build in dev
      await buildApp();
    } else { // True, meaning build is okay or assumed okay in packaged mode
      console.log('✅ Application already built or in packaged mode (no build check needed).\n');
    }
    
    // Start the server
    await startServer();
    
  } catch (error) {
    console.error('❌ Error starting TaskMaster Visualizer:', error.message);
    console.log('\n💡 Try running with --help for usage information');
    process.exit(1);
  }
}

main();
