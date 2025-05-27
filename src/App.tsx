import React, { useEffect, useCallback } from 'react';
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
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TaskNode } from './components/TaskNode';
import { TaskDetails } from './components/TaskDetails';
import { Settings } from './components/Settings';
import { SearchBar } from './components/SearchBar';
import { Legend } from './components/Legend';
import { FileBrowser } from './components/FileBrowser';
import { useTaskStore } from './store/taskStore';
import { Settings as SettingsIcon, Grid3X3, GitBranch, FolderOpen } from 'lucide-react';

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
    error
  } = useTaskStore();
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showFileBrowser, setShowFileBrowser] = React.useState(false);

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
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

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
    <div className="h-full w-full relative">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div>Loading tasks...</div>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg z-40">
          <div className="flex items-center gap-2">
            <span className="font-medium">Error:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}        
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        maxZoom={2}
        minZoom={0.1}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false}
        selectNodesOnDrag={false}
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
      
      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left side - Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowFileBrowser(true)}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              title="Select project root directory (tasks will be loaded from /tasks subdirectory)"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
            
            {/* Layout Mode Buttons */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setLayoutMode('grid')}
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 transition-colors ${
                  layoutMode === 'grid' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                Grid
              </button>
              <button
                onClick={() => setLayoutMode('graph')}
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 transition-colors ${
                  layoutMode === 'graph' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                Graph
              </button>
            </div>
          </div>
          
          {/* Center - Project Info */}
          <div className="flex-1 max-w-md mx-4">
            <h1 className="text-lg font-bold text-center">TaskMaster Visualizer</h1>
            {projectPath ? (
              <div className="text-xs text-gray-500 text-center">
                <div className="font-mono truncate">{projectPath}</div>
                <div>{tasks.length} tasks loaded</div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 text-center">No project selected</div>
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