import path from 'path';
import fs from 'fs';

export function resolveTaskmasterPaths(projectRoot) {
  const taskmasterRoot = path.join(projectRoot, '.taskmaster');
  
  // Always use .taskmaster structure (no legacy support)
  const tasksDir = path.join(taskmasterRoot, 'tasks');
  const tasksJson = path.join(taskmasterRoot, 'tasks', 'tasks.json');
  const configJson = path.join(taskmasterRoot, 'config.json');
  const stateJson = path.join(taskmasterRoot, 'state.json');
  const reportsDir = path.join(taskmasterRoot, 'reports');
  
  // Check if .taskmaster exists
  const exists = fs.existsSync(taskmasterRoot);
  
  return {
    mode: 'taskmaster', // Single mode now
    root: taskmasterRoot,
    tasksDir: tasksDir,
    tasksJson: tasksJson,
    configJson: configJson,
    stateJson: stateJson,
    reportsDir: reportsDir,
    exists: exists
  };
}
