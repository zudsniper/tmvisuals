import { create } from 'zustand';
import { Task, TaskNode, TaskEdge } from '../types/task';

interface TaskStore {
  tasks: Task[];
  nodes: TaskNode[];
  edges: TaskEdge[];
  selectedTaskId: number | null;
  editorPreference: 'vscode' | 'cursor';
  searchQuery: string;
  
  // Actions
  loadTasks: (tasks: Task[]) => void;
  selectTask: (taskId: number | null) => void;
  updateTaskStatus: (taskId: number, status: 'pending' | 'in-progress' | 'done') => void;
  toggleTaskCollapse: (taskId: number) => void;
  setEditorPreference: (editor: 'vscode' | 'cursor') => void;
  openInEditor: (taskId: number) => void;
  setSearchQuery: (query: string) => void;
}

// Calculate positions for nodes in a hierarchical layout
function calculateNodePositions(tasks: Task[]): TaskNode[] {
  const nodes: TaskNode[] = [];
  const levelMap = new Map<number, number>();
  const levelCounts = new Map<number, number>();
  
  // First pass: determine levels based on dependencies
  const calculateLevel = (taskId: number): number => {
    if (levelMap.has(taskId)) return levelMap.get(taskId)!;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return 0;
    
    let maxDepLevel = -1;
    for (const depId of task.dependencies) {
      maxDepLevel = Math.max(maxDepLevel, calculateLevel(depId));
    }
    
    const level = maxDepLevel + 1;
    levelMap.set(taskId, level);
    levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
    return level;
  };
  
  // Calculate all levels
  tasks.forEach(task => calculateLevel(task.id));
  
  // Second pass: position nodes
  const levelOffsets = new Map<number, number>();
  const horizontalSpacing = 300;
  const verticalSpacing = 150;  
  tasks.forEach(task => {
    const level = levelMap.get(task.id) || 0;
    const offset = levelOffsets.get(level) || 0;
    
    nodes.push({
      id: `task-${task.id}`,
      type: 'task',
      position: {
        x: level * horizontalSpacing,
        y: offset * verticalSpacing
      },
      data: {
        task,
        isCollapsed: false
      }
    });
    
    levelOffsets.set(level, offset + 1);
  });
  
  return nodes;
}

// Create edges from task dependencies
function createEdges(tasks: Task[]): TaskEdge[] {
  const edges: TaskEdge[] = [];
  
  tasks.forEach(task => {
    task.dependencies.forEach(depId => {
      edges.push({
        id: `edge-${depId}-${task.id}`,
        source: `task-${depId}`,
        target: `task-${task.id}`,
        type: 'dependency',
        animated: true,
        style: {
          stroke: '#64748b',
          strokeWidth: 2
        }
      });
    });
  });
  
  return edges;
}
export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  nodes: [],
  edges: [],
  selectedTaskId: null,
  editorPreference: 'cursor',
  searchQuery: '',
  
  loadTasks: (tasks) => {
    const nodes = calculateNodePositions(tasks);
    const edges = createEdges(tasks);
    set({ tasks, nodes, edges });
  },
  
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  
  updateTaskStatus: (taskId, status) => set(state => ({
    tasks: state.tasks.map(task => 
      task.id === taskId ? { ...task, status } : task
    ),
    nodes: state.nodes.map(node => 
      node.data.task.id === taskId 
        ? { ...node, data: { ...node.data, task: { ...node.data.task, status } } }
        : node
    )
  })),
  
  toggleTaskCollapse: (taskId) => set(state => ({
    nodes: state.nodes.map(node => 
      node.data.task.id === taskId 
        ? { ...node, data: { ...node.data, isCollapsed: !node.data.isCollapsed } }
        : node
    )
  })),
  
  setEditorPreference: (editor) => set({ editorPreference: editor }),
  
  openInEditor: (taskId) => {
    const { editorPreference } = get();
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Create a temporary file with task details
    const content = JSON.stringify(task, null, 2);
    const fileName = `task_${String(taskId).padStart(3, '0')}.json`;
    const filePath = `/Users/jason/ai/tmvisuals/tasks/${fileName}`;
    
    // Open in preferred editor
    const editorCommand = editorPreference === 'vscode' ? 'code' : 'cursor';
    // Use native handler - this will work in Electron or desktop environments
    // For web, we'll need to implement a different approach
    if (window.electronAPI) {
      window.electronAPI.openInEditor(filePath, editorCommand);
    } else {
      console.log(`Would open ${filePath} in ${editorCommand}`);
      alert(`To open in editor: ${editorCommand} ${filePath}`);
    }
  },
  
  setSearchQuery: (query) => set({ searchQuery: query })
}));
