# Changelog

All notable changes to TaskMaster Visualizer will be documented in this file.

## [2.3.0] - 2025-08-23

### Added
- Compatibility badge showing TaskMaster version from `package.json.taskmasterCompatibility` (bottom-right of UI)
- Progressive node batching and conditional MiniMap for large projects to improve responsiveness

### Changed
- CLI now assumes the current working directory as the project when run via `npx tmvisuals` (positional path optional)
- Build prefers `pnpm` (falls back to `npm`) when the CLI needs to build
- Simplified header UI; removed verbose model/report text in favor of minimal indicators
- Cleaned modes to just `grid` and `graph`; removed leftover force-mode references

### Fixed
- Argument parsing so `--port/-p` values are not treated as project paths

## [2.2.2] - 2025-08-12

### Changed
- 🔗 **Single server port**: API and frontend now served from the same port for simpler `npx tmvisuals` usage

## [1.0.0] - 2025-05-28

### Added
- 🚀 **One-command deployment**: Run with `npx tmvisuals`
- 📦 **Automatic building**: Self-building npm package
- 🌐 **Production server**: Express server with built-in file browser
- 📊 **Interactive visualization**: ReactFlow-based mind maps
- 🔗 **Dependency tracking**: Visual dependency relationships
- 📝 **Editor integration**: VSCode and Cursor support
- 🎨 **Dual layouts**: Grid and Graph layout modes
- 🌙 **Theme support**: Light/dark/system themes
- 📱 **Responsive design**: Works on all screen sizes
- 🔍 **Search functionality**: Filter tasks by title/description
- 💾 **State persistence**: Remembers layout and preferences
- 🔒 **Security features**: Path traversal protection
- 📂 **Cross-platform**: File browser for Windows/macOS/Linux
- ⚡ **Hot reload**: Development mode with live updates
- 📋 **Task status management**: Update task progress
- 🎯 **Priority indicators**: Visual priority levels
- 📄 **Comprehensive docs**: Detailed README and examples

### Technical Features
- React 18 + TypeScript
- ReactFlow 11 for visualization
- Zustand state management
- Tailwind CSS styling
- Vite build system
- Express.js backend
- Cross-platform file system access
- Real-time task updates

### Package Features
- Executable bin script
- Automatic build process
- NPM distribution ready
- Docker support
- Cloud deployment ready
