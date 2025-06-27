# Tasks References Inventory

This document provides an exhaustive list of all hard-coded occurrences of `/tasks` or `tasksPath` in the TMVisuals repository that need to be updated to support configurable task directory paths.

## Backend Files (server.js)

### server.js
**Critical backend logic that constructs task paths**

- **Line 90**: `const tasksPath = path.join(safeProjectPath, 'tasks');`
  - **Context**: `/api/watch-project` endpoint - constructs task directory path for file watching
  - **Impact**: High - Controls where backend looks for tasks when setting up file watchers

- **Line 98**: `if (!fs.existsSync(tasksPath)) {`
  - **Context**: Check if tasks directory exists before watching
  - **Impact**: High - Directory existence validation

- **Line 106**: `const watcher = chokidar.watch(tasksPath, {`
  - **Context**: File watcher setup for tasks directory
  - **Impact**: High - File system monitoring for live updates

- **Line 175**: `tasksPath: tasksPath,`
  - **Context**: API response returning tasks path to client
  - **Impact**: Medium - Client receives path information

- **Line 236**: `const tasksPath = path.join(safeProjectPath, 'tasks');`
  - **Context**: `loadTasksFromPath()` helper function - main task loading logic
  - **Impact**: High - Core task loading functionality

- **Line 239**: `if (!fs.existsSync(tasksPath)) {`
  - **Context**: Check if tasks directory exists in task loading
  - **Impact**: High - Prevents errors when directory doesn't exist

- **Line 243**: `tasksPath: tasksPath,`
  - **Context**: Return object when no tasks directory found
  - **Impact**: Medium - Error response structure

- **Line 249**: `const tasksJsonPath = path.join(tasksPath, 'tasks.json');`
  - **Context**: Construct path to tasks.json file
  - **Impact**: High - Primary tasks file loading

- **Line 256**: `tasksPath: tasksPath,`
  - **Context**: Success response for tasks.json loading
  - **Impact**: Medium - API response structure

- **Line 264**: `const taskFiles = await fs.readdir(tasksPath);`
  - **Context**: Fallback to scanning individual task files
  - **Impact**: High - Alternative task loading method

- **Line 271**: `const filePath = path.join(tasksPath, file);`
  - **Context**: Individual task file path construction
  - **Impact**: High - File reading for individual tasks

- **Line 297**: `tasksPath: tasksPath,`
  - **Context**: Response for individual files scanning
  - **Impact**: Medium - API response structure

## Frontend Files

### src/App.tsx
**Main React component with task loading**

- **Line 188**: `fetch('/tasks/tasks.json')`
  - **Context**: Loading default/fallback tasks when no project path is set
  - **Impact**: Medium - Fallback task loading for demo/default state

- **Line 382**: `title="Select project root directory (tasks will be loaded from /tasks subdirectory)"`
  - **Context**: User interface tooltip explaining task directory location
  - **Impact**: Low - User documentation in UI

### src/store/taskStore.ts
**State management store with task loading logic**

- **Line 880**: `const response = await fetch(\`/api/tasks?projectPath=${encodeURIComponent(projectPath)}\`);`
  - **Context**: API call to load tasks from project path
  - **Impact**: High - Main task loading API call

- **Line 1063**: `fileToOpen = \`${projectPath}/tasks/tasks.json\`;`
  - **Context**: Editor integration - opens tasks.json file in VSCode/Cursor
  - **Impact**: Medium - External editor file opening

### src/components/FileBrowser.tsx
**File browser component for project selection**

- **Line 206**: `<code>/Users/john/myproject/tasks/</code>`
  - **Context**: User documentation example in file browser interface
  - **Impact**: Low - UI documentation/examples

## Static/Distribution Files

### public/tasks.json & dist/tasks.json
**Default task files for demo/fallback**

- These files themselves contain demo task data
- **Impact**: Low - Demo/default data, not part of core logic

### dist/assets/index-B0ffS_Ek.js
**Compiled frontend JavaScript bundle**

- **Line 250**: `fetch("/tasks/tasks.json")`
- **Line 266**: `"tasks will be loaded from /tasks subdirectory"`
- **Impact**: Low - Compiled version of frontend code, will be regenerated

## Documentation Files

### README.md
**Project documentation**

- **Line 158**: `- \`GET /api/tasks?projectPath=path\` - Load TaskMaster tasks`
  - **Context**: API documentation
  - **Impact**: Low - Documentation only

## Binary/CLI Files

### bin/tmvisuals.js
**Command-line interface**

- **Line 89**: `console.log('   2. Select a directory containing a "tasks/" folder');`
  - **Context**: CLI help text explaining usage
  - **Impact**: Low - User documentation in CLI

## Configuration/Rule Files
**Various configuration and rule files contain references but are not part of runtime logic**

- Multiple `.cursor/`, `.roo/`, and `.windsurfrules` files contain task references
- **Impact**: Very Low - Development configuration files

## Summary by Priority

### HIGH PRIORITY (Core Functionality)
1. **server.js lines 90, 98, 106, 236, 239, 249, 264, 271** - Backend task path construction and file operations
2. **src/store/taskStore.ts line 880** - Main API call for task loading  
3. **src/store/taskStore.ts line 1063** - Editor integration path construction

### MEDIUM PRIORITY (User Experience)
1. **server.js lines 175, 243, 256, 297** - API response structures
2. **src/App.tsx line 188** - Fallback task loading
3. **src/store/taskStore.ts line 1063** - Editor file opening

### LOW PRIORITY (Documentation/UI)
1. **src/App.tsx line 382** - UI tooltip
2. **src/components/FileBrowser.tsx line 206** - UI documentation
3. **bin/tmvisuals.js line 89** - CLI help text
4. **README.md line 158** - API documentation

## Recommended Implementation Strategy

1. **Phase 1**: Update high-priority backend logic in `server.js` and main frontend API calls
2. **Phase 2**: Update user-facing configuration and API responses  
3. **Phase 3**: Update documentation, UI text, and CLI help

The solution should introduce a configurable `taskDirectoryName` parameter (defaulting to "tasks") that can be passed through the API chain from frontend → backend → file system operations.
