import path from 'path';
import fs from 'fs';

export function resolveTaskmasterPaths(projectRoot) {
  const newRoot = path.join(projectRoot, '.taskmaster');
  const legacyRoot = path.join(projectRoot, 'tasks');        // legacy only has tasks
  const hasNew = fs.existsSync(path.join(newRoot, 'tasks', 'tasks.json'));
  const hasLegacy = fs.existsSync(path.join(legacyRoot, 'tasks.json'));
  return {
    mode: hasNew ? 'v2' : 'legacy',
    root: hasNew ? newRoot : legacyRoot,
    tasksDir: hasNew ? path.join(newRoot, 'tasks') : legacyRoot,
    tasksJson: hasNew ? path.join(newRoot, 'tasks', 'tasks.json')
                      : path.join(legacyRoot, 'tasks.json'),
    configJson: hasNew ? path.join(newRoot, 'config.json') : null,
    reportsDir: hasNew ? path.join(newRoot, 'reports') : null
  };
}
