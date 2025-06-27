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
  Viewport,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TaskNode as TaskNodeComponent } from './components/TaskNode';
import { TaskNode } from './types/task';
import { TaskDetails } from './components/TaskDetails';
import { Settings } from './components/Settings';
import { SearchBar } from './components/SearchBar';
import { Legend } from './components/Legend';
import { FileBrowser } from './components/FileBrowser';
import { ContextMenu } from './components/ContextMenu';
import ErrorBoundary from './components/ErrorBoundary';
import { NoTasksFound } from './components/NoTasksFound';
import { useTaskStore } from './store/taskStore';
import { Settings as SettingsIcon, Grid3X3, Network, FolderOpen, Sun, Moon, Monitor, Edit3 } from 'lucide-react';

const nodeTypes = { task: TaskNodeComponent };

// Inner component that has access to ReactFlow instance
function Flow() {
  const reactFlowInstance = useReactFlow();
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
    focusOnActiveTask,
    // Viewport management system
    viewportManager,
    cameraController,
    taskStatusManager,
    autoFocusOnActiveTask,
    focusTransitionDuration,
    currentActiveTaskId,
    // Context menu
    showContextMenu,
    hideContextMenu,
    showGrid,
    // ReactFlow instance
    setReactFlowInstance
  } = useTaskStore();
  
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);
  const [showSettings, setShowSettings] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState('');

  // Set up viewport manager with ReactFlow instance
  useEffect(() => {
    if (reactFlowInstance) {
      cameraController.setReactFlowInstance(reactFlowInstance);
      setReactFlowInstance(reactFlowInstance);
    }
  }, [reactFlowInstance, cameraController, setReactFlowInstance]);

  // Active task detection and viewport management
  useEffect(() => {
    if (!autoFocusOnActiveTask || flowNodes.length === 0) return;

    // Find the currently active task
    const activeTask = tasks.find(task => task.status === 'in-progress');
    const activeTaskId = activeTask?.id || null;

    // Check if active task has changed
    if (activeTaskId !== currentActiveTaskId) {
      // Update the tracked active task
      useTaskStore.getState().setActiveTaskFocus(activeTaskId);
      
      // Notify task status manager about all tasks
      if (activeTaskId) {
        taskStatusManager.updateActiveTask(tasks);
      }

      // If there's an active task, focus the viewport on it
      if (activeTaskId && activeTask) {
        // Convert flowNodes to TaskNode[] format
        const taskNodes: TaskNode[] = flowNodes
          .filter(node => node.type === 'task')
          .map(node => ({
            id: node.id,
            type: 'task' as const,
            position: node.position,
            data: node.data
          }));
        
        const targetViewport = viewportManager.calculateOptimalViewport(
          taskNodes,
          activeTaskId,
          reactFlowInstance?.getViewport()
        );

        if (targetViewport) {
          cameraController.transitionToViewport(
            targetViewport,
            focusTransitionDuration
          );
        }
      }
    }
  }, [flowNodes, tasks, autoFocusOnActiveTask, currentActiveTaskId, focusTransitionDuration, 
      reactFlowInstance, viewportManager, cameraController, taskStatusManager]);

  // Subscribe to task status changes
  useEffect(() => {
    const unsubscribe = taskStatusManager.subscribe((activeTask, previousTask) => {
      console.log(`Active task changed from ${previousTask?.id} to: ${activeTask?.id}`);
      // Additional logic for task change events can be added here
    });

    return unsubscribe;
  }, [taskStatusManager]);

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
      
      const loadDefaultTasks = async () => {
        try {
          const res = await fetch('/tasks/tasks.json');
          console.log('Fetch response:', res.status, res.ok);
          
          if (!res.ok) {
            throw new Error(`Failed to fetch default tasks: ${res.status}`);
          }
          
          const data = await res.json();
          
          if (!data || typeof data !== 'object') {
            throw new Error('Invalid tasks data format');
          }
          
          console.log('Tasks data loaded:', data);
          console.log('Number of tasks:', data.tasks?.length);
          
          const tasks = Array.isArray(data.tasks) ? data.tasks : [];
          loadTasks(tasks);
        } catch (err) {
          console.error('Failed to load default tasks:', err);
          // Don't set error state for default tasks failing - just log it
        }
      };
      
      loadDefaultTasks();
    }
  }, [loadTasks, projectPath]);

  const handleSelectProjectPath = async (path: string) => {
    try {
      if (!path || typeof path !== 'string' || path.trim().length === 0) {
        console.error('Invalid project path provided');
        return;
      }
      
      await loadTasksFromPath(path.trim());
    } catch (error) {
      console.error('Failed to load tasks from selected path:', error);
      // Error handling is done in the store, just log here
    }
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

  // Handle node drag prevention for locked nodes
  const onNodeDragStart = useCallback((event: React.MouseEvent, node: any) => {
    const task = node.data.task;
    if (task.isLocked) {
      event.preventDefault();
      return false;
    }
  }, []);

  // Context menu handlers
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
    event.preventDefault();
    showContextMenu(
      { x: event.clientX, y: event.clientY },
      node.id
    );
  }, [showContextMenu]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    showContextMenu(
      { x: event.clientX, y: event.clientY }
    );
  }, [showContextMenu]);

  const onPaneClick = useCallback(() => {
    hideContextMenu();
  }, [hideContextMenu]);

  // Show NoTasksFound component when appropriate
  const showNoTasksFound = !isLoading && !error && tasks.length === 0;
  const handleRefreshTasks = useCallback(async () => {
    if (projectPath) {
      await loadTasksFromPath(projectPath);
    }
  }, [projectPath, loadTasksFromPath]);

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
        <div className={`absolute top-20 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg z-40 max-w-lg ${
          isDarkMode 
            ? 'bg-red-900 border border-red-700 text-red-200'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <div className="text-sm">
            <div className="font-medium mb-1">Unable to load tasks</div>
            <div className="mb-2">{error}</div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFileBrowser(true)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  isDarkMode
                    ? 'bg-red-800 hover:bg-red-700 text-red-200'
                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                }`}
              >
                Select Different Folder
              </button>
              {projectPath && (
                <button
                  onClick={handleRefreshTasks}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    isDarkMode
                      ? 'bg-red-800 hover:bg-red-700 text-red-200'
                      : 'bg-red-100 hover:bg-red-200 text-red-700'
                  }`}
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No Tasks Found State */}
      {showNoTasksFound && (
        <div className="absolute inset-0 z-30">
          <NoTasksFound 
            onSelectFolder={() => setShowFileBrowser(true)}
            onRefresh={handleRefreshTasks}
            projectPath={projectPath}
          />
        </div>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}        
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMove={handleMove}
        onNodeDragStart={onNodeDragStart}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
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
          variant={showGrid ? BackgroundVariant.Dots : BackgroundVariant.Lines}
          gap={showGrid ? 12 : 20} 
          size={showGrid ? 1 : 0.5} 
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

      {/* Context Menu */}
      <ContextMenu />
      
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
                <Network className="w-4 h-4" />
                Graph
              </button>
              <button
                onClick={() => setLayoutMode('force')}
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 transition-colors ${
                  layoutMode === 'force' 
                    ? (isDarkMode ? 'bg-gray-600 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm')
                    : (isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800')
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="2"/>
                  <path d="M12 1v6m0 6v6"/>
                  <path d="m5.93 5.93 4.24 4.24m5.66 5.66 4.24 4.24"/>
                  <path d="M1 12h6m6 0h6"/>
                  <path d="m5.93 18.07 4.24-4.24m5.66-5.66 4.24-4.24"/>
                </svg>
                Force
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
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log error with enhanced detail for debugging
    console.error('Application Error Boundary triggered:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
    
    // Could integrate with error reporting service here
    // e.g., Sentry, LogRocket, etc.
  };

  return (
    <ErrorBoundary onError={handleError}>
      <ReactFlowProvider>
        <ErrorBoundary 
          onError={handleError}
          fallback={() => (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
              <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    ReactFlow Component Error
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    There was an error with the task visualization component. 
                    This might be due to invalid task data or a layout issue.
                  </p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
                  >
                    Reload Application
                  </button>
                </div>
              </div>
            </div>
          )}
        >
          <Flow />
        </ErrorBoundary>
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}

export default App;