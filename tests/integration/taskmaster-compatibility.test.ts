import fs from 'fs-extra';
import path from 'path';
import { resolveTaskmasterPaths } from '../../utils/paths';

// Note: We'll test the actual function rather than mocking for integration tests
describe('TaskMaster Compatibility Integration Tests', () => {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');
  const v2ProjectPath = path.join(fixturesDir, 'v2-project');
  const legacyProjectPath = path.join(fixturesDir, 'legacy-project');

  beforeAll(async () => {
    // Ensure test fixtures exist
    expect(await fs.pathExists(v2ProjectPath)).toBe(true);
    expect(await fs.pathExists(legacyProjectPath)).toBe(true);
  });

  describe('Path Resolution', () => {
    test('should correctly identify v2 project structure', () => {
      const result = resolveTaskmasterPaths(v2ProjectPath);
      
      expect(result.mode).toBe('v2');
      expect(result.root).toBe(path.join(v2ProjectPath, '.taskmaster'));
      expect(result.tasksDir).toBe(path.join(v2ProjectPath, '.taskmaster', 'tasks'));
      expect(result.tasksJson).toBe(path.join(v2ProjectPath, '.taskmaster', 'tasks', 'tasks.json'));
      expect(result.configJson).toBe(path.join(v2ProjectPath, '.taskmaster', 'config.json'));
      expect(result.reportsDir).toBe(path.join(v2ProjectPath, '.taskmaster', 'reports'));
    });

    test('should correctly identify legacy project structure', () => {
      const result = resolveTaskmasterPaths(legacyProjectPath);
      
      expect(result.mode).toBe('legacy');
      expect(result.root).toBe(path.join(legacyProjectPath, 'tasks'));
      expect(result.tasksDir).toBe(path.join(legacyProjectPath, 'tasks'));
      expect(result.tasksJson).toBe(path.join(legacyProjectPath, 'tasks', 'tasks.json'));
      expect(result.configJson).toBeNull();
      expect(result.reportsDir).toBeNull();
    });

    test('should return correct paths for v2 with all components', async () => {
      const result = resolveTaskmasterPaths(v2ProjectPath);
      
      // Verify all paths exist
      expect(await fs.pathExists(result.tasksJson)).toBe(true);
      expect(await fs.pathExists(result.configJson!)).toBe(true);
      expect(await fs.pathExists(result.reportsDir!)).toBe(true);
    });

    test('should return correct paths for legacy without v2 components', async () => {
      const result = resolveTaskmasterPaths(legacyProjectPath);
      
      // Verify tasks.json exists but v2 components don't
      expect(await fs.pathExists(result.tasksJson)).toBe(true);
      expect(result.configJson).toBeNull();
      expect(result.reportsDir).toBeNull();
    });
  });

  describe('Task Loading', () => {
    test('should load v2 project tasks with complete structure', async () => {
      const result = resolveTaskmasterPaths(v2ProjectPath);
      
      // Load and verify tasks.json
      const tasksData = await fs.readJson(result.tasksJson);
      expect(tasksData).toHaveValidTaskStructure();
      expect(tasksData.tasks).toHaveLength(3);
      
      // Verify task IDs and statuses
      const taskIds = tasksData.tasks.map((t: any) => t.id);
      expect(taskIds).toEqual([1, 2, 3]);
      
      const statuses = tasksData.tasks.map((t: any) => t.status);
      expect(statuses).toEqual(['done', 'in-progress', 'pending']);
    });

    test('should load legacy project tasks', async () => {
      const result = resolveTaskmasterPaths(legacyProjectPath);
      
      // Load and verify tasks.json
      const tasksData = await fs.readJson(result.tasksJson);
      expect(tasksData).toHaveValidTaskStructure();
      expect(tasksData.tasks).toHaveLength(3);
      
      // Verify task IDs and statuses 
      const taskIds = tasksData.tasks.map((t: any) => t.id);
      expect(taskIds).toEqual([1, 2, 3]);
    });

    test('should load v2 config when available', async () => {
      const result = resolveTaskmasterPaths(v2ProjectPath);
      
      if (result.configJson) {
        const configData = await fs.readJson(result.configJson);
        expect(configData.version).toBe('2.0');
        expect(configData.projectName).toBe('V2 Test Project');
        expect(configData.features).toBeDefined();
        expect(configData.settings).toBeDefined();
      }
    });

    test('should load v2 reports when available', async () => {
      const result = resolveTaskmasterPaths(v2ProjectPath);
      
      if (result.reportsDir) {
        const reportFiles = await fs.readdir(result.reportsDir);
        expect(reportFiles.length).toBeGreaterThan(0);
        
        // Load the first report file
        const reportFile = reportFiles.find(f => f.endsWith('.json'));
        if (reportFile) {
          const reportPath = path.join(result.reportsDir, reportFile);
          const reportData = await fs.readJson(reportPath);
          expect(reportData.timestamp).toBeDefined();
          expect(reportData.summary).toBeDefined();
          expect(reportData.taskDetails).toBeDefined();
        }
      }
    });
  });

  describe('Task Structure Validation', () => {
    test('should validate v2 task has required fields', async () => {
      const result = resolveTaskmasterPaths(v2ProjectPath);
      const tasksData = await fs.readJson(result.tasksJson);
      
      tasksData.tasks.forEach((task: any) => {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('description');
        expect(task).toHaveProperty('details');
        expect(task).toHaveProperty('testStrategy');
        expect(task).toHaveProperty('priority');
        expect(task).toHaveProperty('dependencies');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('subtasks');
        
        // Validate subtasks structure
        if (task.subtasks && task.subtasks.length > 0) {
          task.subtasks.forEach((subtask: any) => {
            expect(subtask).toHaveProperty('id');
            expect(subtask).toHaveProperty('title');
            expect(subtask).toHaveProperty('description');
            expect(subtask).toHaveProperty('status');
          });
        }
      });
    });

    test('should validate legacy task has required fields', async () => {
      const result = resolveTaskmasterPaths(legacyProjectPath);
      const tasksData = await fs.readJson(result.tasksJson);
      
      tasksData.tasks.forEach((task: any) => {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('description');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('dependencies');
        
        // Legacy should still support these fields
        expect(task).toHaveProperty('subtasks');
        
        // Check status values are valid
        expect(['pending', 'in-progress', 'done']).toContain(task.status);
      });
    });
  });

  describe('Mode Detection', () => {
    test('should detect v2 mode when .taskmaster directory exists', () => {
      const result = resolveTaskmasterPaths(v2ProjectPath);
      expect(result.mode).toBe('v2');
    });

    test('should detect legacy mode when only tasks directory exists', () => {
      const result = resolveTaskmasterPaths(legacyProjectPath);
      expect(result.mode).toBe('legacy');
    });

    test('should prefer v2 over legacy when both exist', async () => {
      // Create a temporary directory with both structures
      const tempDir = path.join(fixturesDir, 'mixed-project');
      await fs.ensureDir(path.join(tempDir, '.taskmaster', 'tasks'));
      await fs.ensureDir(path.join(tempDir, 'tasks'));
      
      // Create minimal tasks.json in both locations
      const minimalTasks = { tasks: [] };
      await fs.writeJson(path.join(tempDir, '.taskmaster', 'tasks', 'tasks.json'), minimalTasks);
      await fs.writeJson(path.join(tempDir, 'tasks', 'tasks.json'), minimalTasks);
      
      try {
        const result = resolveTaskmasterPaths(tempDir);
        expect(result.mode).toBe('v2');
      } finally {
        // Cleanup
        await fs.remove(tempDir);
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle non-existent project path gracefully', () => {
      const nonExistentPath = path.join(fixturesDir, 'non-existent-project');
      const result = resolveTaskmasterPaths(nonExistentPath);
      
      // Should return paths but mode will be determined by existence checks
      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('tasksJson');
    });

    test('should handle empty project directory', async () => {
      const emptyDir = path.join(fixturesDir, 'empty-project');
      await fs.ensureDir(emptyDir);
      
      try {
        const result = resolveTaskmasterPaths(emptyDir);
        expect(result.mode).toBe('legacy'); // defaults to legacy when no tasks found
      } finally {
        await fs.remove(emptyDir);
      }
    });
  });
});
