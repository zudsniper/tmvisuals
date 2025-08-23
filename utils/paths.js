import path from 'path';
import fs from 'fs';

// Resolve Taskmaster paths supporting both v2 (.taskmaster) and legacy (tasks/) structures
export function resolveTaskmasterPaths(projectRoot) {
  const taskmasterRoot = path.join(projectRoot, '.taskmaster');
  const v2Exists = fs.existsSync(taskmasterRoot);

  if (v2Exists) {
    const tasksDir = path.join(taskmasterRoot, 'tasks');
    const tasksJson = path.join(tasksDir, 'tasks.json');
    const configJson = path.join(taskmasterRoot, 'config.json');
    const stateJson = path.join(taskmasterRoot, 'state.json');
    const reportsDir = path.join(taskmasterRoot, 'reports');

    return {
      mode: 'v2',
      root: taskmasterRoot,
      tasksDir,
      tasksJson,
      configJson,
      stateJson,
      reportsDir,
      exists: true
    };
  }

  // Legacy support: tasks/tasks.json at project root
  const legacyTasksDir = path.join(projectRoot, 'tasks');
  const legacyTasksJson = path.join(legacyTasksDir, 'tasks.json');
  const legacyExists = fs.existsSync(legacyTasksJson);

  if (legacyExists) {
    return {
      mode: 'legacy',
      root: projectRoot,
      tasksDir: legacyTasksDir,
      tasksJson: legacyTasksJson,
      configJson: path.join(projectRoot, 'config.json'), // legacy may not have this
      stateJson: null,
      reportsDir: null,
      exists: true
    };
  }

  // Not found
  return {
    mode: 'unknown',
    root: taskmasterRoot,
    tasksDir: path.join(taskmasterRoot, 'tasks'),
    tasksJson: path.join(taskmasterRoot, 'tasks', 'tasks.json'),
    configJson: path.join(taskmasterRoot, 'config.json'),
    stateJson: path.join(taskmasterRoot, 'state.json'),
    reportsDir: path.join(taskmasterRoot, 'reports'),
    exists: false
  };
}
