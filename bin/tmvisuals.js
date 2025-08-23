#!/usr/bin/env node

import { exec, spawn, spawnSync } from 'child_process';
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
    // Prefer pnpm when available; fallback to npm
    const hasPnpm = (() => {
      try {
        const res = spawnSync('pnpm', ['-v'], { stdio: 'ignore' });
        return res.status === 0;
      } catch {
        return false;
      }
    })();
    const pm = hasPnpm ? 'pnpm' : 'npm';
    const args = hasPnpm ? ['build'] : ['run', 'build'];

    console.log(`Using ${pm} to build...`);
    const buildProcess = spawn(pm, args, {
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

function startServer(defaultProjectPath) {
  return new Promise((resolve, reject) => {
    // Find an available port
    const port = process.env.PORT || 3001;
    
    console.log(`🌐 Starting server on port ${port}...`);
    
    const serverProcess = spawn('node', ['server.js'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PORT: port, DEFAULT_PROJECT_PATH: defaultProjectPath || process.cwd() }
    });
    
    // Give the server a moment to start
    setTimeout(() => {
      console.log(`\n✅ TaskMaster Visualizer is running!`);
      console.log(`\n🔗 Open your browser to: http://localhost:${port}`);
  console.log('\n📋 Startup:');
  console.log(`   • Assuming project at: ${defaultProjectPath || process.cwd()}`);
  console.log('   • Change folders any time via the folder button in the top bar');
  console.log('   • .taskmaster/tasks is preferred; legacy tasks/ is supported');
  console.log('   • Config is read from .taskmaster/config.json when present');
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
  npx tmvisuals                 Start the visualizer (assumes current directory as project)
  npx tmvisuals [path]          Start and assume [path] as the project directory
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

Tasks are now stored in .taskmaster/tasks/tasks.json; legacy tasks/tasks.json
projects are still supported but will be migrated in a future release.
AI model configuration is loaded from .taskmaster/config.json.
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
  // Positional project path (first non-flag arg), but skip values for known flags like --port/-p
  let providedPath = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port' || arg === '-p') {
      i++; // skip the port value
      continue;
    }
    if (!arg.startsWith('-')) {
      providedPath = path.resolve(arg);
      break;
    }
  }
  if (!providedPath) providedPath = process.cwd();
    
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
  await startServer(providedPath);
    
  } catch (error) {
    console.error('❌ Error starting TaskMaster Visualizer:', error.message);
    console.log('\n💡 Try running with --help for usage information');
    process.exit(1);
  }
}

main();
