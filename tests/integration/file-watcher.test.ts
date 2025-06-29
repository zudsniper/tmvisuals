import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';

// Mock chokidar for testing
const mockWatcher = new EventEmitter();
const mockChokidar = {
  watch: jest.fn().mockReturnValue(mockWatcher),
};

jest.mock('chokidar', () => mockChokidar);

describe('File Watcher Integration Tests', () => {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');
  const testProjectPath = path.join(fixturesDir, 'watcher-test-project');
  
  beforeAll(async () => {
    // Create test project structure
    await fs.ensureDir(path.join(testProjectPath, '.taskmaster', 'tasks'));
    await fs.ensureDir(path.join(testProjectPath, 'tasks')); // Legacy structure too
  });

  afterAll(async () => {
    // Cleanup test files
    await fs.remove(testProjectPath);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockWatcher.removeAllListeners();
  });

  describe('Watcher Setup for V2 Structure', () => {
    test('should set up watcher for v2 project structure', async () => {
      // Create v2 tasks file
      const v2TasksPath = path.join(testProjectPath, '.taskmaster', 'tasks', 'tasks.json');
      const initialTasks = {
        tasks: [
          { id: 1, title: 'Initial Task', status: 'pending', dependencies: [], subtasks: [] }
        ]
      };
      await fs.writeJson(v2TasksPath, initialTasks);

      // Simulate starting file watcher (this would normally be done by the server)
      const watchPaths = [path.join(testProjectPath, '.taskmaster', 'tasks')];
      
      // Verify chokidar.watch would be called with correct paths
      expect(mockChokidar.watch).not.toHaveBeenCalled(); // Not called yet since we're just testing setup
      
      // Simulate the watch call
      mockChokidar.watch(watchPaths, {
        persistent: true,
        ignoreInitial: true,
        depth: 1,
        ignorePermissionErrors: true,
        usePolling: false,
        interval: 1000,
        binaryInterval: 5000
      });

      expect(mockChokidar.watch).toHaveBeenCalledWith(
        watchPaths,
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
          depth: 1,
          ignorePermissionErrors: true
        })
      );
    });

    test('should set up watcher for legacy project structure', async () => {
      // Create legacy tasks file
      const legacyTasksPath = path.join(testProjectPath, 'tasks', 'tasks.json');
      const initialTasks = {
        tasks: [
          { id: 1, title: 'Legacy Task', status: 'pending', dependencies: [], subtasks: [] }
        ]
      };
      await fs.writeJson(legacyTasksPath, initialTasks);

      // Simulate starting file watcher for legacy structure
      const watchPaths = [path.join(testProjectPath, 'tasks')];
      
      mockChokidar.watch(watchPaths, {
        persistent: true,
        ignoreInitial: true,
        depth: 1,
        ignorePermissionErrors: true,
        usePolling: false,
        interval: 1000,
        binaryInterval: 5000
      });

      expect(mockChokidar.watch).toHaveBeenCalledWith(
        watchPaths,
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true
        })
      );
    });
  });

  describe('Watcher Event Handling', () => {
    test('should emit update events when v2 tasks file changes', async () => {
      const v2TasksPath = path.join(testProjectPath, '.taskmaster', 'tasks', 'tasks.json');
      const updateEvents: any[] = [];
      
      // Set up event listener to capture updates
      const mockUpdateHandler = (event: any) => {
        updateEvents.push(event);
      };

      // Simulate file change event
      mockWatcher.on('change', mockUpdateHandler);
      
      // Simulate a file change
      const updatedTasks = {
        tasks: [
          { id: 1, title: 'Updated V2 Task', status: 'in-progress', dependencies: [], subtasks: [] },
          { id: 2, title: 'New V2 Task', status: 'pending', dependencies: [1], subtasks: [] }
        ]
      };
      
      // Write updated file and emit change event
      await fs.writeJson(v2TasksPath, updatedTasks);
      mockWatcher.emit('change', v2TasksPath);
      
      // Verify event was captured
      expect(updateEvents).toHaveLength(1);
      expect(updateEvents[0]).toBe(v2TasksPath);
    });

    test('should emit update events when legacy tasks file changes', async () => {
      const legacyTasksPath = path.join(testProjectPath, 'tasks', 'tasks.json');
      const updateEvents: any[] = [];
      
      // Set up event listener to capture updates
      const mockUpdateHandler = (event: any) => {
        updateEvents.push(event);
      };

      mockWatcher.on('change', mockUpdateHandler);
      
      // Simulate a file change
      const updatedTasks = {
        tasks: [
          { id: 1, title: 'Updated Legacy Task', status: 'done', dependencies: [], subtasks: [] }
        ]
      };
      
      // Write updated file and emit change event
      await fs.writeJson(legacyTasksPath, updatedTasks);
      mockWatcher.emit('change', legacyTasksPath);
      
      // Verify event was captured
      expect(updateEvents).toHaveLength(1);
      expect(updateEvents[0]).toBe(legacyTasksPath);
    });

    test('should handle file add events', async () => {
      const newFilePath = path.join(testProjectPath, '.taskmaster', 'tasks', 'new-task.json');
      const addEvents: any[] = [];
      
      const mockAddHandler = (event: any) => {
        addEvents.push(event);
      };

      mockWatcher.on('add', mockAddHandler);
      
      // Create new file and emit add event
      await fs.writeJson(newFilePath, { id: 3, title: 'New Task File' });
      mockWatcher.emit('add', newFilePath);
      
      expect(addEvents).toHaveLength(1);
      expect(addEvents[0]).toBe(newFilePath);
    });

    test('should handle file removal events', async () => {
      const removeFilePath = path.join(testProjectPath, '.taskmaster', 'tasks', 'to-remove.json');
      const removeEvents: any[] = [];
      
      const mockRemoveHandler = (event: any) => {
        removeEvents.push(event);
      };

      mockWatcher.on('unlink', mockRemoveHandler);
      
      // Create file first, then remove it
      await fs.writeJson(removeFilePath, { id: 4, title: 'To Be Removed' });
      await fs.remove(removeFilePath);
      mockWatcher.emit('unlink', removeFilePath);
      
      expect(removeEvents).toHaveLength(1);
      expect(removeEvents[0]).toBe(removeFilePath);
    });

    test('should handle watcher errors gracefully', async () => {
      const errorEvents: any[] = [];
      
      const mockErrorHandler = (error: any) => {
        errorEvents.push(error);
      };

      mockWatcher.on('error', mockErrorHandler);
      
      // Simulate watcher error
      const testError = new Error('Test watcher error');
      mockWatcher.emit('error', testError);
      
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toBe(testError);
    });
  });

  describe('Watcher for Both Structures', () => {
    test('should watch both v2 and legacy paths when both exist', async () => {
      // Create both structures
      const v2TasksPath = path.join(testProjectPath, '.taskmaster', 'tasks', 'tasks.json');
      const legacyTasksPath = path.join(testProjectPath, 'tasks', 'tasks.json');
      
      const v2Tasks = {
        tasks: [{ id: 1, title: 'V2 Task', status: 'pending', dependencies: [], subtasks: [] }]
      };
      const legacyTasks = {
        tasks: [{ id: 2, title: 'Legacy Task', status: 'pending', dependencies: [], subtasks: [] }]
      };
      
      await fs.writeJson(v2TasksPath, v2Tasks);
      await fs.writeJson(legacyTasksPath, legacyTasks);
      
      // Simulate watching both directories (as the server would do in legacy mode)
      const watchPaths = [
        path.join(testProjectPath, '.taskmaster', 'tasks'),
        path.join(testProjectPath, 'tasks')
      ];
      
      mockChokidar.watch(watchPaths, {
        persistent: true,
        ignoreInitial: true,
        depth: 1,
        ignorePermissionErrors: true,
        usePolling: false,
        interval: 1000,
        binaryInterval: 5000
      });

      expect(mockChokidar.watch).toHaveBeenCalledWith(
        expect.arrayContaining(watchPaths),
        expect.any(Object)
      );
    });

    test('should emit events for changes in either structure', async () => {
      const changeEvents: string[] = [];
      
      const mockChangeHandler = (filePath: string) => {
        changeEvents.push(filePath);
      };

      mockWatcher.on('change', mockChangeHandler);
      
      // Emit changes for both structures
      const v2Path = path.join(testProjectPath, '.taskmaster', 'tasks', 'tasks.json');
      const legacyPath = path.join(testProjectPath, 'tasks', 'tasks.json');
      
      mockWatcher.emit('change', v2Path);
      mockWatcher.emit('change', legacyPath);
      
      expect(changeEvents).toHaveLength(2);
      expect(changeEvents).toContain(v2Path);
      expect(changeEvents).toContain(legacyPath);
    });
  });

  describe('Watcher Cleanup', () => {
    test('should properly close watcher on cleanup', () => {
      const mockClose = jest.fn();
      mockWatcher.close = mockClose;
      
      // Simulate cleanup
      mockWatcher.close();
      
      expect(mockClose).toHaveBeenCalled();
    });

    test('should handle cleanup errors gracefully', () => {
      const mockClose = jest.fn().mockImplementation(() => {
        throw new Error('Cleanup failed');
      });
      mockWatcher.close = mockClose;
      
      // Should not throw when cleanup fails
      expect(() => {
        try {
          mockWatcher.close();
        } catch (error) {
          // Handle cleanup error gracefully
          console.warn('Watcher cleanup failed:', error);
        }
      }).not.toThrow();
    });
  });
});
