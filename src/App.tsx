import React, { useEffect, useCallback, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
  ReactFlowProvider,
  Viewport
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TaskNode } from './components/TaskNode';
import { TaskDetails } from './components/TaskDetails';
import { Settings } from './components/Settings';
import { SearchBar } from './components/SearchBar';
import { Legend } from './components/Legend';
import { FileBrowser } from './components/FileBrowser';
import { useTaskStore } from './store/taskStore';
import { Settings as SettingsIcon, Grid3X3, GitBranch, FolderOpen, Sun, Moon, Monitor, Edit3 } from 'lucide-react';

const nodeTypes = { task: TaskNode };

function Flow() {
  const { 
    tasks,
    nodes, 
    edges, 
    loadTasks, 
    loadTasksFromPath,
    selectedTaskId, 
    selectTask, 
    setSearchQuery, 
    searchQuery, 
    layoutMode, 
    setLayoutMode,
    projectPath,
    isLoading,
    error,
    // New dark mode and position features
    theme,
    isDarkMode,
    setTheme,
    updateNodePosition,
    lastViewport,
    setLastViewport,
    // Project name features
    projectName,
    setProjectName,
    // Live updates
    isLiveUpdateEnabled,
    lastUpdateTime,
    enableLiveUpdates,
    disableLiveUpdates,
    // Auto-focus setting
    focusOnActiveTask
  } = useTaskStore();
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);
  const [showSettings, setShowSettings] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState('');

  // Enhanced visual highlighting for active tasks - NO viewport manipulation
  useEffect(() => {
    if (!focusOnActiveTask || flowNodes.length === 0) return;

    // Find all active tasks for enhanced visual highlighting
    const activeTasks = flowNodes.filter(node => {
      const task = node.data.task;
      return task.status === 'in-progress' || 
             task.subtasks.some(subtask => subtask.status === 'in-progress');
    });

    // The visual highlighting is handled entirely in TaskNode.tsx
    // This effect just ensures the setting is properly connected
    console.log(`Enhanced highlighting enabled for ${activeTasks.length} active tasks`);
  }, [flowNodes, focusOnActiveTask]);

  // Auto-load tasks from saved project path on startup
  useEffect(() => {
    if (projectPath && tasks.length === 0 && !isLoading) {
      loadTasksFromPath(projectPath);
    }
  }, [projectPath, tasks.length, isLoading, loadTasksFromPath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectTask(null);
        setShowSettings(false);
        setShowFileBrowser(false);
      }
      if (e.key === '/' && e.target === document.body) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectTask]);

  // Load default tasks if no project path is set
  useEffect(() => {
    if (!projectPath) {
      console.log('Attempting to load default tasks...');
      fetch('/tasks/tasks.json')
        .then(res => {
          console.log('Fetch response:', res.status, res.ok);
          return res.json();
        })
        .then(data => {
          console.log('Tasks data loaded:', data);
          console.log('Number of tasks:', data.tasks?.length);
          loadTasks(data.tasks);
        })
        .catch(err => console.error('Failed to load default tasks:', err));
    }
  }, [loadTasks, projectPath]);

  const handleSelectProjectPath = async (path: string) => {
    await loadTasksFromPath(path);
  };

  useEffect(() => {
    console.log('Syncing nodes from store:', nodes.length, 'layout mode:', layoutMode);
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges, layoutMode]);

  // Handle node position changes to persist custom positions
  const handleNodesChange = useCallback((changes: any[]) => {
    onNodesChange(changes);
    
    // Save position changes
    changes.forEach(change => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        updateNodePosition(change.id, change.position);
      }
    });
  }, [onNodesChange, updateNodePosition]);

  // Handle viewport changes to persist zoom/pan state
  const handleMove = useCallback((_: any, viewport: Viewport) => {
    setLastViewport(viewport);
  }, [setLastViewport]);

  // Project name editing handlers
  const handleStartEditingProjectName = () => {
    setEditingProjectName(projectName || 'TaskMaster Visualizer');
    setIsEditingProjectName(true);
  };

  const handleSaveProjectName = () => {
    const trimmedName = editingProjectName.trim();
    if (trimmedName) {
      setProjectName(trimmedName);
    }
    setIsEditingProjectName(false);
  };

  const handleCancelEditingProjectName = () => {
    setIsEditingProjectName(false);
    setEditingProjectName('');
  };

  const handleProjectNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveProjectName();
    } else if (e.key === 'Escape') {
      handleCancelEditingProjectName();
    }
  };

  // Filter nodes based on search - debounced for performance
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!searchQuery) {
        setNodes(nodes);
        setEdges(edges);
        return;
      }

      const query = searchQuery.toLowerCase();
      const filteredNodes = nodes.filter(node => 
        node.data.task.title.toLowerCase().includes(query) ||
        node.data.task.description.toLowerCase().includes(query) ||
        node.data.task.id.toString().includes(query)
      );
      
      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
      const filteredEdges = edges.filter(edge => 
        filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
      );
      
      setNodes(filteredNodes);
      setEdges(filteredEdges);
    }, 200); // 200ms debounce

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, searchQuery, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className={`h-full w-full relative ${isDarkMode ? 'dark bg-gray-900' : 'bg-white'}`}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg shadow-lg ${
            isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
          }`}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div>Loading tasks...</div>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className={`absolute top-20 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg z-40 ${
          isDarkMode 
            ? 'bg-red-900 border border-red-700 text-red-200'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            <span className="font-medium">Error:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}        
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMove={handleMove}
        nodeTypes={nodeTypes}
        fitView={!lastViewport}
        defaultViewport={lastViewport || { x: 0, y: 0, zoom: 0.8 }}
        attributionPosition="bottom-left"
        maxZoom={2}
        minZoom={0.1}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false}
        selectNodesOnDrag={false}
        zoomOnDoubleClick={false}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={12} 
          size={1} 
          color={isDarkMode ? '#374151' : '#e5e7eb'}
        />
        <Controls />
        <MiniMap 
          style={{
            backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
            border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`
          }}
          maskColor={isDarkMode ? '#111827' : '#f3f4f6'}
        />
      </ReactFlow>
      
      {/* Top Navigation Bar */}
      <div className={`absolute top-0 left-0 right-0 border-b shadow-sm z-10 ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left side - Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowFileBrowser(true)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              title="Select project root directory (tasks will be loaded from /tasks subdirectory)"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
            
            {/* Theme Toggle */}
            <div className={`flex items-center gap-1 rounded-lg p-1 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded ${
                  theme === 'light' 
                    ? (isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900 shadow-sm')
                    : (isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')
                }`}
                title="Light mode"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded ${
                  theme === 'dark' 
                    ? (isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900 shadow-sm')
                    : (isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')
                }`}
                title="Dark mode"
              >
                <Moon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded ${
                  theme === 'system' 
                    ? (isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900 shadow-sm')
                    : (isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')
                }`}
                title="System preference"
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>
            
            {/* Layout Mode Buttons */}
            <div className={`flex items-center gap-1 rounded-lg p-1 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <button
                onClick={() => setLayoutMode('grid')}
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 transition-colors ${
                  layoutMode === 'grid' 
                    ? (isDarkMode ? 'bg-gray-600 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm')
                    : (isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800')
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                Grid
              </button>
              <button
                onClick={() => setLayoutMode('graph')}
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 transition-colors ${
                  layoutMode === 'graph' 
                    ? (isDarkMode ? 'bg-gray-600 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm')
                    : (isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800')
                }`}
              >
                <GitBranch className="w-4 h-4" />
                Graph
              </button>
            </div>
          </div>
          
          {/* Center - Project Info */}
          <div className="flex-1 max-w-md mx-4">
            {isEditingProjectName ? (
              <div className="flex items-center gap-2 justify-center">
                <input
                  type="text"
                  value={editingProjectName}
                  onChange={(e) => setEditingProjectName(e.target.value)}
                  onKeyDown={handleProjectNameKeyDown}
                  onBlur={handleSaveProjectName}
                  className={`text-lg font-bold text-center border rounded px-2 py-1 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  autoFocus
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 justify-center">
                <h1 className={`text-lg font-bold text-center ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {projectName || 'TaskMaster Visualizer'}
                </h1>
                <button
                  onClick={handleStartEditingProjectName}
                  className={`p-1 rounded transition-colors ${
                    isDarkMode 
                      ? 'text-gray-400 hover:text-gray-300' 
                      : 'text-gray-500 hover:text-gray-600'
                  }`}
                  title="Edit project name"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            )}
            {projectPath ? (
              <div className={`text-xs text-center ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {projectPath}
              </div>
            ) : (
              <div className={`text-xs text-center ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <button 
                  onClick={() => setShowFileBrowser(true)}
                  className="hover:underline"
                >
                  Click to open a project folder
                </button>
              </div>
            )}
            
            {/* Live Update Indicator */}
            {projectPath && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <button
                  onClick={isLiveUpdateEnabled ? disableLiveUpdates : enableLiveUpdates}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                    isLiveUpdateEnabled
                      ? (isDarkMode ? 'bg-green-900 text-green-300 border border-green-700' : 'bg-green-50 text-green-700 border border-green-200')
                      : (isDarkMode ? 'bg-gray-700 text-gray-400 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-200')
                  }`}
                  title={isLiveUpdateEnabled ? 'Live updates enabled - click to disable' : 'Live updates disabled - click to enable'}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    isLiveUpdateEnabled 
                      ? 'bg-green-500 animate-pulse' 
                      : 'bg-gray-400'
                  }`} />
                  <span>{isLiveUpdateEnabled ? 'Live' : 'Static'}</span>
                </button>
                
                {lastUpdateTime && (
                  <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Updated: {new Date(lastUpdateTime).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Right side - Search */}
          <div className="w-64">
            <SearchBar onSearch={setSearchQuery} />
          </div>
        </div>
      </div>
      
      {/* Legend positioned separately */}
      <div className="absolute top-20 right-4">
        <Legend />
      </div>
      
      {selectedTaskId && <TaskDetails />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      <FileBrowser
        isOpen={showFileBrowser}
        onClose={() => setShowFileBrowser(false)}
        onSelectPath={handleSelectProjectPath}
      />
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}

export default App;