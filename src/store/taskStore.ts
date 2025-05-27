import { create } from 'zustand';
import { Task, TaskNode, TaskEdge } from '../types/task';

export type LayoutMode = 'grid' | 'graph';

interface TaskStore {
  tasks: Task[];
  nodes: TaskNode[];
  edges: TaskEdge[];
  selectedTaskId: number | null;
  editorPreference: 'vscode' | 'cursor';
  searchQuery: string;
  layoutMode: LayoutMode;
  projectPath: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadTasks: (tasks: Task[]) => void;
  loadTasksFromPath: (projectPath: string) => Promise<void>;
  selectTask: (taskId: number | null) => void;
  updateTaskStatus: (taskId: number, status: 'pending' | 'in-progress' | 'done') => void;
  toggleTaskCollapse: (taskId: number) => void;
  setEditorPreference: (editor: 'vscode' | 'cursor') => void;
  openInEditor: (taskId: number) => void;
  setSearchQuery: (query: string) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setProjectPath: (path: string | null) => void;
}

// Grid layout: simple ordered grid without overlaps, extends downward
function calculateGridLayout(tasks: Task[]): TaskNode[] {
  const nodes: TaskNode[] = [];
  
  // Node dimensions with EXTREMELY generous padding to prevent any overlaps
  const NODE_WIDTH = 300;
  const NODE_HEIGHT = 140;
  const HORIZONTAL_GUTTER = 150; // DRAMATICALLY larger horizontal spacing
  const VERTICAL_GUTTER = 150;   // DRAMATICALLY larger vertical spacing  
  const MARGIN = 100;            // Much larger margin from edges
  
  // Get viewport width and calculate available space
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const availableWidth = viewportWidth - (2 * MARGIN); // Leave margin on both sides
  
  // Calculate how many columns can fit with proper gutters
  const columnsPerRow = Math.max(1, Math.floor((availableWidth + HORIZONTAL_GUTTER) / (NODE_WIDTH + HORIZONTAL_GUTTER)));
  
  tasks.forEach((task, index) => {
    const row = Math.floor(index / columnsPerRow);
    const col = index % columnsPerRow;
    
    // Simple grid positioning - no centering, just consistent spacing, allowing overflow
    const x = MARGIN + col * (NODE_WIDTH + HORIZONTAL_GUTTER);
    const y = MARGIN + 100 + row * (NODE_HEIGHT + VERTICAL_GUTTER); // Add 100px for top nav bar
    
    nodes.push({
      id: `task-${task.id}`,
      type: 'task',
      position: { x, y },
      data: {
        task,
        isCollapsed: false
      }
    });
  });
  
  return nodes;
}

// Graph layout: hierarchical layout based on dependencies
function calculateGraphLayout(tasks: Task[]): TaskNode[] {
  const nodes: TaskNode[] = [];
  const levelMap = new Map<number, number>();
  const visiting = new Set<number>(); // Track nodes currently being visited to detect cycles
  
  // Node dimensions with much more generous spacing
  const NODE_WIDTH = 300;
  const NODE_HEIGHT = 140;
  const MIN_VERTICAL_SPACING = 350; // MUCH larger vertical spacing between levels
  const HORIZONTAL_SPACING = 120;   // Larger horizontal spacing
  const MARGIN = 100;               // Larger margin from edges
  
  // Get viewport dimensions
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const availableWidth = viewportWidth - (2 * MARGIN);
  
  // First pass: determine levels based on dependencies
  const calculateLevel = (taskId: number): number => {
    if (levelMap.has(taskId)) return levelMap.get(taskId)!;
    
    // Cycle detection: if we're already visiting this node, there's a cycle
    if (visiting.has(taskId)) {
      console.warn(`Circular dependency detected involving task ${taskId}`);
      return 0; // Assign level 0 for circular dependencies
    }
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return 0;
    
    visiting.add(taskId); // Mark as currently being visited
    
    let maxDepLevel = -1;
    for (const depId of task.dependencies) {
      maxDepLevel = Math.max(maxDepLevel, calculateLevel(depId));
    }
    
    visiting.delete(taskId); // Remove from visiting set
    
    const level = maxDepLevel + 1;
    levelMap.set(taskId, level);
    return level;
  };
  
  // Calculate all levels
  tasks.forEach(task => calculateLevel(task.id));
  
  // Group tasks by level
  const levelGroups = new Map<number, Task[]>();
  tasks.forEach(task => {
    const level = levelMap.get(task.id) || 0;
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(task);
  });
  
  // Position nodes level by level with generous spacing
  for (const [level, tasksInLevel] of levelGroups) {
    const numTasksInLevel = tasksInLevel.length;
    
    // Calculate spacing - use new horizontal spacing
    const totalLevelWidth = numTasksInLevel * NODE_WIDTH + (numTasksInLevel - 1) * HORIZONTAL_SPACING;
    
    if (totalLevelWidth > availableWidth) {
      // If nodes would overflow, create multiple rows with generous spacing
      const nodesPerRow = Math.max(1, Math.floor((availableWidth + HORIZONTAL_SPACING) / (NODE_WIDTH + HORIZONTAL_SPACING)));
      
      tasksInLevel.forEach((task, index) => {
        const row = Math.floor(index / nodesPerRow);
        const col = index % nodesPerRow;
        
        // Simple positioning without centering - allows overflow with dramatic spacing
        const x = MARGIN + col * (NODE_WIDTH + HORIZONTAL_SPACING);
        const y = MARGIN + 100 + level * MIN_VERTICAL_SPACING + row * (NODE_HEIGHT + 100); // Increased row spacing
        
        nodes.push({
          id: `task-${task.id}`,
          type: 'task',
          position: { x, y },
          data: {
            task,
            isCollapsed: false
          }
        });
      });
    } else {
      // Normal horizontal spacing if they fit
      tasksInLevel.forEach((task, index) => {
        const x = MARGIN + index * (NODE_WIDTH + HORIZONTAL_SPACING);
        const y = MARGIN + 100 + level * MIN_VERTICAL_SPACING;
        
        nodes.push({
          id: `task-${task.id}`,
          type: 'task',
          position: { x, y },
          data: {
            task,
            isCollapsed: false
          }
        });
      });
    }
  }
  
  return nodes;
}

// Calculate positions based on layout mode
function calculateNodePositions(tasks: Task[], layoutMode: LayoutMode): TaskNode[] {
  switch (layoutMode) {
    case 'grid':
      return calculateGridLayout(tasks);
    case 'graph':
      return calculateGraphLayout(tasks);
    default:
      return calculateGridLayout(tasks);
  }
}

// Persistence helpers
const STORAGE_KEY = 'taskmaster-project-path';

const loadProjectPathFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to load project path from localStorage:', error);
    return null;
  }
};

const saveProjectPathToStorage = (path: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (path) {
      localStorage.setItem(STORAGE_KEY, path);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to save project path to localStorage:', error);
  }
};

function createEdges(tasks: Task[], layoutMode: LayoutMode): TaskEdge[] {
  if (layoutMode !== 'graph') {
    return []; // No edges in grid mode
  }
  
  const edges: TaskEdge[] = [];
  const edgeConnections = new Map<string, number>(); // Track multiple edges between same nodes
  
  tasks.forEach(task => {
    task.dependencies.forEach(depId => {
      const edgeKey = `${depId}-${task.id}`;
      const existingCount = edgeConnections.get(edgeKey) || 0;
      edgeConnections.set(edgeKey, existingCount + 1);
      
      // Create a single curved edge that represents all dependencies between these nodes
      if (existingCount === 0) {
        edges.push({
          id: `edge-${depId}-${task.id}`,
          source: `task-${depId}`,
          target: `task-${task.id}`,
          type: 'smoothstep', // Use smooth curved edges
          animated: false,    // Disable animation for better performance
          style: {
            stroke: '#64748b',
            strokeWidth: 2.5,   // Slightly thicker for better visibility
            strokeOpacity: 0.8, // More opaque for curved lines
            strokeDasharray: undefined // Solid lines
          }
        });
      }
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
  layoutMode: 'grid',
  projectPath: loadProjectPathFromStorage(),
  isLoading: false,
  error: null,
  
  loadTasks: (tasks) => {
    console.log('loadTasks called with:', tasks);
    console.log('Number of tasks to load:', tasks?.length);
    const { layoutMode } = get();
    const nodes = calculateNodePositions(tasks, layoutMode);
    const edges = createEdges(tasks, layoutMode);
    console.log('Generated nodes:', nodes.length);
    console.log('Generated edges:', edges.length);
    set({ tasks, nodes, edges, error: null });
  },

  loadTasksFromPath: async (projectPath: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`/api/tasks?projectPath=${encodeURIComponent(projectPath)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load tasks');
      }
      
      const tasksData = await response.json();
      const tasks: Task[] = tasksData.tasks || [];
      
      const { layoutMode } = get();
      const nodes = calculateNodePositions(tasks, layoutMode);
      const edges = createEdges(tasks, layoutMode);
      
      set({ 
        tasks, 
        nodes, 
        edges, 
        projectPath, 
        isLoading: false, 
        error: null 
      });
      
      // Save to localStorage after successful load
      saveProjectPathToStorage(projectPath);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load tasks',
        tasks: [],
        nodes: [],
        edges: []
      });
    }
  },

  setProjectPath: (path) => {
    set({ projectPath: path });
    saveProjectPathToStorage(path); // Persist to localStorage
  },
  
  setLayoutMode: (mode) => {
    const { tasks } = get();
    const nodes = calculateNodePositions(tasks, mode);
    const edges = createEdges(tasks, mode);
    set({ layoutMode: mode, nodes, edges });
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
    const fileName = `task_${String(taskId).padStart(3, '0')}.json`;
    const filePath = `/Users/jason/ai/tmvisuals/tasks/${fileName}`;
    
    // Open in preferred editor
    const editorCommand = editorPreference === 'vscode' ? 'code' : 'cursor';
    // Use native handler - this will work in Electron or desktop environments
    // For web, we'll need to implement a different approach
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      electronAPI.openInEditor(filePath, editorCommand);
    } else {
      console.log(`Would open ${filePath} in ${editorCommand}`);
      alert(`To open in editor: ${editorCommand} ${filePath}`);
    }
  },
  
  setSearchQuery: (query) => set({ searchQuery: query })
}));
