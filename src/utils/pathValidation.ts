import path from 'path-browserify';

/**
 * Validates and sanitizes project paths to prevent security issues
 */
export class PathValidator {
  private static readonly BLOCKED_PATTERNS = [
    /\.\.[\/\\]/g,  // Directory traversal attempts
    /^[\/\\]/,       // Absolute paths starting with / or \
    /[<>:"|?*]/g,    // Invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
  ];

  private static readonly MAX_PATH_LENGTH = 260; // Windows MAX_PATH limit
  private static readonly MAX_DEPTH = 10; // Maximum directory depth

  /**
   * Validates if a path is safe to access
   */
  static validatePath(inputPath: string): { isValid: boolean; error?: string; sanitizedPath?: string } {
    if (!inputPath || typeof inputPath !== 'string') {
      return { isValid: false, error: 'Path must be a non-empty string' };
    }

    // Trim whitespace
    const trimmedPath = inputPath.trim();
    
    if (trimmedPath.length === 0) {
      return { isValid: false, error: 'Path cannot be empty' };
    }

    // Check path length
    if (trimmedPath.length > this.MAX_PATH_LENGTH) {
      return { isValid: false, error: `Path too long (max ${this.MAX_PATH_LENGTH} characters)` };
    }

    // Check for blocked patterns
    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(trimmedPath)) {
        return { isValid: false, error: 'Path contains invalid or potentially dangerous characters' };
      }
    }

    // Check directory depth
    const pathParts = trimmedPath.split(/[\/\\]/).filter(part => part.length > 0);
    if (pathParts.length > this.MAX_DEPTH) {
      return { isValid: false, error: `Path too deep (max ${this.MAX_DEPTH} levels)` };
    }

    // Normalize path separators and resolve any remaining relative components
    let sanitizedPath: string;
    try {
      // Use path.resolve to handle relative components safely
      sanitizedPath = path.resolve(trimmedPath);
      
      // Additional check: ensure resolved path doesn't go above intended root
      if (sanitizedPath.includes('..')) {
        return { isValid: false, error: 'Path resolution resulted in directory traversal' };
      }
    } catch (error) {
      return { isValid: false, error: 'Failed to normalize path' };
    }

    return { isValid: true, sanitizedPath };
  }

  /**
   * Validates if a tasks directory structure is valid
   */
  static validateTasksDirectory(projectPath: string): { isValid: boolean; error?: string; tasksPath?: string } {
    const pathValidation = this.validatePath(projectPath);
    if (!pathValidation.isValid) {
      return { isValid: false, error: pathValidation.error };
    }

    const sanitizedProjectPath = pathValidation.sanitizedPath!;
    const tasksPath = path.join(sanitizedProjectPath, 'tasks');

    // Validate the tasks subdirectory path
    const tasksValidation = this.validatePath(tasksPath);
    if (!tasksValidation.isValid) {
      return { isValid: false, error: `Invalid tasks directory: ${tasksValidation.error}` };
    }

    return { isValid: true, tasksPath: tasksValidation.sanitizedPath };
  }

  /**
   * Extracts a safe project name from a path
   */
  static extractProjectName(projectPath: string): string {
    const pathValidation = this.validatePath(projectPath);
    if (!pathValidation.isValid) {
      return 'TaskMaster Visualizer';
    }

    try {
      const sanitizedPath = pathValidation.sanitizedPath!;
      const pathParts = sanitizedPath.split(path.sep).filter(part => part.length > 0);
      const folderName = pathParts[pathParts.length - 1];
      
      if (folderName && folderName !== 'tasks') {
        // Convert folder names to more readable format
        return folderName
          .replace(/[-_]/g, ' ')  // Replace hyphens and underscores with spaces
          .replace(/\b\w/g, l => l.toUpperCase())  // Capitalize first letter of each word
          .trim();
      }
    } catch (error) {
      console.warn('Failed to extract project name:', error);
    }
    
    return 'TaskMaster Visualizer';
  }

  /**
   * Checks if a path appears to be accessible (basic heuristics)
   */
  static isPathAccessible(inputPath: string): boolean {
    const validation = this.validatePath(inputPath);
    if (!validation.isValid) {
      return false;
    }

    // Additional accessibility checks could be added here
    // For now, we rely on the backend to perform actual filesystem checks
    return true;
  }
}

/**
 * Error class for path validation failures
 */
export class PathValidationError extends Error {
  constructor(message: string, public readonly path?: string) {
    super(message);
    this.name = 'PathValidationError';
  }
}

/**
 * Utility function for safe path operations
 */
export function safePathResolve(basePath: string, ...paths: string[]): string {
  try {
    const resolvedPath = path.resolve(basePath, ...paths);
    
    // Ensure the resolved path is still within the base path
    const normalizedBase = path.resolve(basePath);
    const relativePath = path.relative(normalizedBase, resolvedPath);
    
    if (relativePath.startsWith('..')) {
      throw new PathValidationError('Resolved path is outside the base directory', resolvedPath);
    }
    
    return resolvedPath;
  } catch (error) {
    if (error instanceof PathValidationError) {
      throw error;
    }
    throw new PathValidationError('Failed to resolve path safely', `${basePath} + [${paths.join(', ')}]`);
  }
}

