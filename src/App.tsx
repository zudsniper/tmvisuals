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
import { useTaskStore } from './store/taskStore';
import { Settings as SettingsIcon } from 'lucide-react';

const nodeTypes = { task: TaskNode };

function Flow() {
  const { nodes, edges, loadTasks, selectedTaskId, selectTask, setSearchQuery, searchQuery } = useTaskStore();
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);
  const [showSettings, setShowSettings] = React.useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectTask(null);
        setShowSettings(false);
      }
      if (e.key === '/' && e.target === document.body) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectTask]);

  useEffect(() => {
    fetch('/tasks/tasks.json')
      .then(res => res.json())
      .then(data => loadTasks(data.tasks))
      .catch(err => console.error('Failed to load tasks:', err));
  }, [loadTasks]);

  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  // Filter nodes based on search
  useEffect(() => {
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
  }, [nodes, edges, searchQuery, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
      
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-4 left-4 p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
      >
        <SettingsIcon className="w-5 h-5" />
      </button>
      
      <div className="absolute top-4 left-16 bg-white rounded-lg shadow-md px-4 py-2">
        <h1 className="text-lg font-bold">TaskMaster Visualizer</h1>
      </div>
      
      <SearchBar onSearch={setSearchQuery} />
      <Legend />
      
      {selectedTaskId && <TaskDetails />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
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