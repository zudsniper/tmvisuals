// Global test setup
import fs from 'fs-extra';
import path from 'path';

// Extend Jest matchers for better testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveValidTaskStructure(): R;
      toHaveMode(mode: string): R;
    }
  }
}

// Custom matchers
expect.extend({
  toHaveValidTaskStructure(received: any) {
    const pass = received &&
      Array.isArray(received.tasks) &&
      received.tasks.every((task: any) => 
        typeof task.id === 'number' &&
        typeof task.title === 'string' &&
        typeof task.status === 'string' &&
        ['pending', 'in-progress', 'done'].includes(task.status)
      );

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to have valid task structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have valid task structure`,
        pass: false,
      };
    }
  },

  toHaveMode(received: any, expectedMode: string) {
    const pass = received && received.mode === expectedMode;

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to have mode ${expectedMode}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have mode ${expectedMode}, but got ${received?.mode}`,
        pass: false,
      };
    }
  },
});

// Test timeout setup
jest.setTimeout(10000);

// Console output control for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress console output during tests unless explicitly testing it
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore console output
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});
