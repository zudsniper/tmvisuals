import { resolveTaskmasterPaths } from '../../utils/paths';
import { loadTasksFromPath } from '../../server';

const sampleProjectPathV2 = 'tests/fixtures/v2-project';
const sampleProjectPathLegacy = 'tests/fixtures/legacy-project';

jest.mock('fs-extra', () => ({
  ...jest.requireActual('fs-extra'),
  existsSync: jest.fn().mockImplementation((path) => {
    if (path.includes('.taskmaster/tasks/tasks.json')) return true;
    if (path.includes('legacy-project/tasks.json')) return true;
    return false;
  }),
  readFileSync: jest.fn().mockImplementation((path) => {
    if (path.includes('tasks.json')) {
      return JSON.stringify({ tasks: [{ id: 1, title: 'Sample Task', status: 'pending' }] });
    }
    return '';
  }),
}));

jest.mock('../../server', () => ({
  ...jest.requireActual('../../server'),
  loadTasksFromPath: jest.fn().mockResolvedValue({
    tasks: [{ id: 1, title: 'Sample Task', status: 'pending' }],
    mode: 'v2',
  }),
}));


describe('Task Resolver and Loader', () => {
  test('should resolve paths for a v2 sample project', () => {
    const result = resolveTaskmasterPaths(sampleProjectPathV2);
    expect(result).toHaveMode('v2');
    expect(result.tasksJson).toContain('.taskmaster/tasks/tasks.json');
  });

  test('should load tasks with valid structure from a v2 project', async () => {
    const tasksData = await loadTasksFromPath(sampleProjectPathV2);
    expect(tasksData).toHaveValidTaskStructure();
  });

  test('should resolve paths for a legacy project', () => {
    const result = resolveTaskmasterPaths(sampleProjectPathLegacy);
    expect(result).toHaveMode('legacy');
    expect(result.tasksJson).toContain('legacy-project/tasks.json');
  });

  test('should load tasks with valid structure from a legacy project', async () => {
    const tasksData = await loadTasksFromPath(sampleProjectPathLegacy);
    expect(tasksData).toHaveValidTaskStructure();
  });
});
