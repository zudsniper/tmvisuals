import { create } from 'zustand';
import { Task, TaskNode, TaskEdge } from '../types/task';
import { Viewport } from 'reactflow';

export type LayoutMode = 'grid' | 'graph';
export type ThemeMode = 'light' | 'dark' | 'system';

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
  
  // New features
  theme: ThemeMode;
  isDarkMode: boolean;
  customPositions: Map<string, { x: number; y: number }>;
  lastViewport: Viewport | null;
  projectName: string | null;
  focusOnActiveTask: boolean; // New setting to focus on active task instead of remembering viewport
  dynamicLayout: boolean; // New setting for dynamic layout based on active task changes
  currentActiveTaskId: number | null; // Track current active task for dynamic layout
  
  // Live updates
  isLiveUpdateEnabled: boolean;
  sseConnection: EventSource | null;
  lastUpdateTime: string | null;
  
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
  
  // New actions
  setTheme: (theme: ThemeMode) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  setLastViewport: (viewport: Viewport) => void;
  setProjectName: (name: string | null) => void;
  setFocusOnActiveTask: (focus: boolean) => void;
  setDynamicLayout: (dynamic: boolean) => void;
  
  // Live update actions
  enableLiveUpdates: () => void;
  disableLiveUpdates: () => void;
  startWatchingProject: (projectPath: string) => Promise<void>;
  stopWatchingProject: (projectPath: string) => Promise<void>;
  
  // Storage management
  clearAllStoredData: () => void;
}

// Enhanced grid layout with intelligent height-aware positioning
function calculateGridLayout(tasks: Task[], customPositions: Map<string, { x: number; y: number }>): TaskNode[] {
  const nodes: TaskNode[] = [];
  
  // Node dimensions with much better spacing
  const NODE_WIDTH = 300;
  const BASE_NODE_HEIGHT = 180; // Base height for tasks without subtasks
  const HORIZONTAL_GUTTER = 120; // Increased from 50 for much more space
  const VERTICAL_GUTTER = 80;    // Increased from 40 for much more space  
  const MARGIN = 40;             // Increased from 25
  
  // Get viewport width and calculate available space
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const availableWidth = viewportWidth - (2 * MARGIN);
  
  // Calculate how many columns can fit
  const columnsPerRow = Math.max(1, Math.floor((availableWidth + HORIZONTAL_GUTTER) / (NODE_WIDTH + HORIZONTAL_GUTTER)));
  
  // Track the height of each column to enable intelligent positioning
  const columnHeights = new Array(columnsPerRow).fill(0);
  
  tasks.forEach((task) => {
    const nodeId = `task-${task.id}`;
    
    // Check if this node has a custom position
    const customPos = customPositions.get(nodeId);
    if (customPos) {
      nodes.push({
        id: nodeId,
        type: 'task',
        position: customPos,
        data: {
          task,
          isCollapsed: false
        }
      });
      return;
    }
    
    // Calculate estimated task height based on content
    const estimatedHeight = BASE_NODE_HEIGHT + 
      (task.subtasks.length * 25) + // ~25px per subtask
      (task.description.length > 100 ? 20 : 0) + // Extra height for long descriptions
      (task.dependencies.length > 0 ? 15 : 0); // Extra height for dependencies
    
    // Find the column with the shortest current height (intelligent filling)
    const targetColumn = columnHeights.indexOf(Math.min(...columnHeights));
    
    const x = MARGIN + targetColumn * (NODE_WIDTH + HORIZONTAL_GUTTER);
    const y = MARGIN + 100 + columnHeights[targetColumn]; // Add 100px for top nav bar
    
    // Update the column height for the next task
    columnHeights[targetColumn] += estimatedHeight + VERTICAL_GUTTER;
    
    nodes.push({
      id: nodeId,
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

// Enhanced graph layout with dynamic active task positioning
function calculateGraphLayout(tasks: Task[], customPositions: Map<string, { x: number; y: number }>, dynamicLayout: boolean = false, activeTaskId: number | null = null): TaskNode[] {
  const nodes: TaskNode[] = [];
  const levelMap = new Map<number, number>();
  const visiting = new Set<number>();
  
  // Layout dimensions - optimized for better space utilization
  const NODE_WIDTH = 280;
  const HORIZONTAL_SPACING = 100; // Reduced from 150 for better space usage
  const VERTICAL_SPACING = 160;   // Consistent vertical spacing for all tasks
  const MARGIN = 60;              // Reduced margin for more space
  const TOP_MARGIN = 120;         // Space for navigation
  
  // Get viewport dimensions
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1400;
  const availableWidth = viewportWidth - (2 * MARGIN);
  
  // Calculate max columns - less conservative for better utilization
  const maxColumns = Math.max(3, Math.floor(availableWidth / (NODE_WIDTH + HORIZONTAL_SPACING)));
  
  // Find current active task for dynamic layout
  const currentActiveTask = dynamicLayout && activeTaskId ? 
    tasks.find(t => t.id === activeTaskId && (t.status === 'in-progress' || t.subtasks.some(st => st.status === 'in-progress'))) :
    tasks.find(t => t.status === 'in-progress' || t.subtasks.some(st => st.status === 'in-progress'));
  
  // Simple dependency level calculation
  const calculateLevel = (taskId: number): number => {
    if (levelMap.has(taskId)) return levelMap.get(taskId)!;
    
    if (visiting.has(taskId)) {
      console.warn(`Circular dependency detected involving task ${taskId}`);
      return 0;
    }
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return 0;
    
    visiting.add(taskId);
    
    let maxDepLevel = -1;
    for (const depId of task.dependencies) {
      maxDepLevel = Math.max(maxDepLevel, calculateLevel(depId));
    }
    
    visiting.delete(taskId);
    
    const level = maxDepLevel + 1;
    levelMap.set(taskId, level);
    return level;
  };
  
  // Calculate all levels
  tasks.forEach(task => calculateLevel(task.id));
  
  // Group tasks by level with dynamic active task prioritization
  const columns = new Map<number, Task[]>();
  
  // If dynamic layout is enabled and we have an active task, reorganize around it
  if (dynamicLayout && currentActiveTask) {
    // Place active task in center column (column 1 if 3+ columns available)
    const centerColumn = Math.floor(maxColumns / 2);
    const activeTaskLevel = levelMap.get(currentActiveTask.id) || 0;
    
    // Adjust all tasks relative to active task's position
    tasks.forEach(task => {
      let adjustedLevel = levelMap.get(task.id) || 0;
      
      // Center active task's column
      if (task.id === currentActiveTask.id) {
        adjustedLevel = centerColumn;
      } else {
        // Shift other tasks relative to the active task
        const originalLevel = levelMap.get(task.id) || 0;
        const relativeToActive = originalLevel - activeTaskLevel;
        adjustedLevel = centerColumn + relativeToActive;
        
        // Ensure we don't go below 0
        adjustedLevel = Math.max(0, adjustedLevel);
      }
      
      if (!columns.has(adjustedLevel)) {
        columns.set(adjustedLevel, []);
      }
      columns.get(adjustedLevel)!.push(task);
    });
  } else {
    // Standard layout without dynamic positioning
    tasks.forEach(task => {
      const level = levelMap.get(task.id) || 0;
      if (!columns.has(level)) {
        columns.set(level, []);
      }
      columns.get(level)!.push(task);
    });
  }
  
  // Simple positioning with guaranteed spacing
  for (const [column, tasksInColumn] of Array.from(columns.entries()).sort(([a], [b]) => a - b)) {
    // Calculate column position with wrapping
    const effectiveColumn = column % maxColumns;
    const wrapRow = Math.floor(column / maxColumns);
    
    // Sort tasks for consistent ordering with active task priority
    tasksInColumn.sort((a, b) => {
      // If dynamic layout is enabled, prioritize active task and its dependencies
      if (dynamicLayout && currentActiveTask) {
        const aIsActive = a.id === currentActiveTask.id;
        const bIsActive = b.id === currentActiveTask.id;
        const aIsDepOfActive = currentActiveTask.dependencies.includes(a.id);
        const bIsDepOfActive = currentActiveTask.dependencies.includes(b.id);
        const aHasActiveDep = a.dependencies.includes(currentActiveTask.id);
        const bHasActiveDep = b.dependencies.includes(currentActiveTask.id);
        
        // Active task goes first
        if (aIsActive && !bIsActive) return -1;
        if (bIsActive && !aIsActive) return 1;
        
        // Dependencies of active task come next
        if (aIsDepOfActive && !bIsDepOfActive) return -1;
        if (bIsDepOfActive && !aIsDepOfActive) return 1;
        
        // Tasks that depend on active task come after
        if (aHasActiveDep && !bHasActiveDep) return -1;
        if (bHasActiveDep && !aHasActiveDep) return 1;
      }
      
      // Standard priority ordering
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const statusOrder = { 'in-progress': 3, 'pending': 2, 'done': 1 };
      
      const aPriority = priorityOrder[a.priority] || 1;
      const bPriority = priorityOrder[b.priority] || 1;
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      const aStatus = statusOrder[a.status] || 1;
      const bStatus = statusOrder[b.status] || 1;
      if (aStatus !== bStatus) return bStatus - aStatus;
      
      return a.id - b.id;
    });
    
    tasksInColumn.forEach((task, taskIndex) => {
      const nodeId = `task-${task.id}`;
      
      // Check for custom position first
      const customPos = customPositions.get(nodeId);
      if (customPos) {
        nodes.push({
          id: nodeId,
          type: 'task',
          position: customPos,
          data: { task, isCollapsed: false }
        });
        return;
      }
      
      // Calculate Y position with consistent, clean spacing
      const baseY = TOP_MARGIN + (wrapRow * 600); // Larger row separation
      const taskY = baseY + (taskIndex * VERTICAL_SPACING);
      
      let x = MARGIN + effectiveColumn * (NODE_WIDTH + HORIZONTAL_SPACING);
      const y = taskY;
      
      // OVERLAP OFFSET: If cards would overlap or be too close, offset to the left
      // Check if there are other nodes that might overlap with this position
      const potentialOverlaps = nodes.filter(node => {
        if (!node.position) return false;
        const xDiff = Math.abs(node.position.x - x);
        const yDiff = Math.abs(node.position.y - y);
        // Consider it an overlap if within 50px horizontally and 100px vertically
        return xDiff < 50 && yDiff < 100;
      });
      
      // If there are potential overlaps, offset this card to the left
      if (potentialOverlaps.length > 0) {
        x -= 30 * (taskIndex + 1); // Progressive offset based on task index
      }
      
      nodes.push({
        id: nodeId,
        type: 'task',
        position: { x, y },
        data: { task, isCollapsed: false }
      });
    });
  }
  
  return nodes;
}

// Calculate positions based on layout mode
function calculateNodePositions(tasks: Task[], layoutMode: LayoutMode, customPositions: Map<string, { x: number; y: number }>, dynamicLayout: boolean = false, activeTaskId: number | null = null): TaskNode[] {
  switch (layoutMode) {
    case 'grid':
      return calculateGridLayout(tasks, customPositions);
    case 'graph':
      return calculateGraphLayout(tasks, customPositions, dynamicLayout, activeTaskId);
    default:
      return calculateGridLayout(tasks, customPositions);
  }
}

// Persistence helpers
const STORAGE_KEY = 'taskmaster-project-path';
const THEME_STORAGE_KEY = 'taskmaster-theme';
const POSITIONS_STORAGE_KEY = 'taskmaster-positions';
const VIEWPORT_STORAGE_KEY = 'taskmaster-viewport';
const PROJECT_NAME_STORAGE_KEY = 'taskmaster-project-name';
const FOCUS_ON_ACTIVE_TASK_KEY = 'taskmaster-focus-on-active-task';
const DYNAMIC_LAYOUT_STORAGE_KEY = 'taskmaster-dynamic-layout';

// Dark mode detection
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const loadProjectPathFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to load project path from localStorage:', error);
    return null;
  }
};

const loadThemeFromStorage = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
    return stored || 'system';
  } catch (error) {
    console.warn('Failed to load theme from localStorage:', error);
    return 'system';
  }
};

const loadCustomPositions = (): Map<string, { x: number; y: number }> => {
  if (typeof window === 'undefined') return new Map();
  try {
    const stored = localStorage.getItem(POSITIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(parsed);
    }
  } catch (error) {
    console.warn('Failed to load positions from localStorage:', error);
  }
  return new Map();
};

const loadLastViewport = (): Viewport | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load viewport from localStorage:', error);
    return null;
  }
};

const loadProjectNameFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(PROJECT_NAME_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to load project name from localStorage:', error);
    return null;
  }
};

const loadFocusOnActiveTaskFromStorage = (): boolean => {
  if (typeof window === 'undefined') return true; // Default to true
  try {
    const stored = localStorage.getItem(FOCUS_ON_ACTIVE_TASK_KEY);
    return stored !== null ? JSON.parse(stored) : true; // Default to true
  } catch (error) {
    console.warn('Failed to load focus on active task setting from localStorage:', error);
    return true;
  }
};

const loadDynamicLayoutFromStorage = (): boolean => {
  if (typeof window === 'undefined') return false; // Default to false for stability
  try {
    const stored = localStorage.getItem(DYNAMIC_LAYOUT_STORAGE_KEY);
    return stored !== null ? JSON.parse(stored) : false; // Default to false
  } catch (error) {
    console.warn('Failed to load dynamic layout setting from localStorage:', error);
    return false;
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

const saveThemeToStorage = (theme: ThemeMode): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Failed to save theme to localStorage:', error);
  }
};

const saveCustomPositions = (positions: Map<string, { x: number; y: number }>): void => {
  if (typeof window === 'undefined') return;
  try {
    const serialized = Array.from(positions.entries());
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.warn('Failed to save positions to localStorage:', error);
  }
};

const saveLastViewport = (viewport: Viewport): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(viewport));
  } catch (error) {
    console.warn('Failed to save viewport to localStorage:', error);
  }
};

const saveProjectNameToStorage = (name: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (name) {
      localStorage.setItem(PROJECT_NAME_STORAGE_KEY, name);
    } else {
      localStorage.removeItem(PROJECT_NAME_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to save project name to localStorage:', error);
  }
};

const saveFocusOnActiveTaskToStorage = (focus: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FOCUS_ON_ACTIVE_TASK_KEY, JSON.stringify(focus));
  } catch (error) {
    console.warn('Failed to save focus on active task setting to localStorage:', error);
  }
};

const saveDynamicLayoutToStorage = (dynamic: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DYNAMIC_LAYOUT_STORAGE_KEY, JSON.stringify(dynamic));
  } catch (error) {
    console.warn('Failed to save dynamic layout setting to localStorage:', error);
  }
};

// Function to extract project name from git remote or folder path
const extractProjectName = (projectPath: string | null): string => {
  if (!projectPath) return 'TaskMaster Visualizer';
  
  try {
    // Extract from folder path first (most reliable)
    const folderName = projectPath.split('/').pop() || projectPath.split('\\').pop();
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
};

function createEdges(tasks: Task[], layoutMode: LayoutMode): TaskEdge[] {
  if (layoutMode !== 'graph') {
    return []; // No edges in grid mode
  }
  
  const edges: TaskEdge[] = [];
  const edgeConnections = new Map<string, number>(); // Track multiple edges between same nodes
  
  // Create task lookup map for quick access
  const taskMap = new Map<number, Task>();
  tasks.forEach(task => taskMap.set(task.id, task));
  
  tasks.forEach(task => {
    task.dependencies.forEach(depId => {
      const edgeKey = `${depId}-${task.id}`;
      const existingCount = edgeConnections.get(edgeKey) || 0;
      edgeConnections.set(edgeKey, existingCount + 1);
      
      // Create a single curved edge that represents all dependencies between these nodes
      if (existingCount === 0) {
        const sourceTask = taskMap.get(depId);
        const targetTask = task;
        
        // Determine if this edge should be animated based on task statuses
        const isSourceActive = sourceTask?.status === 'in-progress' || 
          sourceTask?.subtasks.some(st => st.status === 'in-progress');
        const isTargetActive = targetTask.status === 'in-progress' || 
          targetTask.subtasks.some(st => st.status === 'in-progress');
        const shouldAnimate = isSourceActive || isTargetActive;
        
        // Determine edge color and style based on task statuses
        let edgeColor = '#64748b'; // Default gray
        let edgeOpacity = 0.6;
        let strokeWidth = 2;
        let strokeDasharray: string | undefined = undefined;
        
        if (isTargetActive) {
          edgeColor = '#3b82f6'; // Blue for incoming to active tasks
          edgeOpacity = 0.8;
          strokeWidth = 3;
        } else if (isSourceActive) {
          edgeColor = '#10b981'; // Green for outgoing from active tasks
          edgeOpacity = 0.7;
          strokeWidth = 2.5;
        }
        
        // Special case: if target is pending but source is done, show as completed dependency
        if (sourceTask?.status === 'done' && targetTask.status === 'pending') {
          edgeColor = '#22c55e'; // Green for completed dependencies
          edgeOpacity = 0.6;
          strokeDasharray = '5,5'; // Dashed line for completed dependencies
        }
        
        edges.push({
          id: `edge-${depId}-${task.id}`,
          source: `task-${depId}`,
          target: `task-${task.id}`,
          type: 'smoothstep', // Use smooth curved edges
          animated: shouldAnimate, // Animate edges connected to active tasks
          style: {
            stroke: edgeColor,
            strokeWidth,
            strokeOpacity: edgeOpacity,
            strokeDasharray
          }
        });
      }
    });
  });
  
  return edges;
}

export const useTaskStore = create<TaskStore>((set, get) => {
  // Initialize theme detection
  const initialTheme = loadThemeFromStorage();
  const systemTheme = getSystemTheme();
  const initialIsDarkMode = initialTheme === 'dark' || (initialTheme === 'system' && systemTheme === 'dark');
  
  // Apply initial theme to document
  if (typeof window !== 'undefined') {
    if (initialIsDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  return {
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
    
    // New features
    theme: initialTheme,
    isDarkMode: initialIsDarkMode,
    customPositions: loadCustomPositions(),
    lastViewport: loadLastViewport(),
    projectName: loadProjectNameFromStorage(),
    focusOnActiveTask: loadFocusOnActiveTaskFromStorage(),
    dynamicLayout: loadDynamicLayoutFromStorage(), // Load from storage instead of defaulting to false
    currentActiveTaskId: null,
    
    // Live updates
    isLiveUpdateEnabled: false,
    sseConnection: null,
    lastUpdateTime: null,
    
    loadTasks: (tasks) => {
      console.log('loadTasks called with:', tasks);
      console.log('Number of tasks to load:', tasks?.length);
      const { layoutMode, customPositions, dynamicLayout } = get();
      
      // Track active task for dynamic layout
      const activeTask = tasks.find(t => 
        t.status === 'in-progress' || t.subtasks.some(st => st.status === 'in-progress')
      );
      const activeTaskId = activeTask?.id || null;
      
      const nodes = calculateNodePositions(tasks, layoutMode, customPositions, dynamicLayout, activeTaskId);
      const edges = createEdges(tasks, layoutMode);
      console.log('Generated nodes:', nodes.length);
      console.log('Generated edges:', edges.length);
      set({ tasks, nodes, edges, error: null, currentActiveTaskId: activeTaskId });
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
        
        const { layoutMode, customPositions, dynamicLayout } = get();
        
        // Track active task for dynamic layout
        const activeTask = tasks.find(t => 
          t.status === 'in-progress' || t.subtasks.some(st => st.status === 'in-progress')
        );
        const activeTaskId = activeTask?.id || null;
        
        const nodes = calculateNodePositions(tasks, layoutMode, customPositions, dynamicLayout, activeTaskId);
        const edges = createEdges(tasks, layoutMode);
        
        // Extract project name if not already set
        const currentProjectName = get().projectName;
        let newProjectName = currentProjectName;
        if (!currentProjectName) {
          newProjectName = extractProjectName(projectPath);
        }
        
        set({ 
          tasks, 
          nodes, 
          edges, 
          projectPath, 
          projectName: newProjectName,
          isLoading: false, 
          error: null,
          currentActiveTaskId: activeTaskId 
        });
        
        // Save to localStorage after successful load
        saveProjectPathToStorage(projectPath);
        if (!currentProjectName) {
          saveProjectNameToStorage(newProjectName);
        }
        
        // Start watching project for live updates
        get().startWatchingProject(projectPath);
        
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
      saveProjectPathToStorage(path);
    },
    
    setLayoutMode: (mode) => {
      const { tasks, customPositions, dynamicLayout, currentActiveTaskId } = get();
      const nodes = calculateNodePositions(tasks, mode, customPositions, dynamicLayout, currentActiveTaskId);
      const edges = createEdges(tasks, mode);
      set({ layoutMode: mode, nodes, edges });
    },
    
    selectTask: (taskId) => set({ selectedTaskId: taskId }),
    
    updateTaskStatus: (taskId, status) => set(state => {
      const updatedTasks = state.tasks.map(task => 
        task.id === taskId ? { ...task, status } : task
      );
      
      // Check if active task changed for dynamic layout
      const newActiveTask = updatedTasks.find(t => 
        t.status === 'in-progress' || t.subtasks.some(st => st.status === 'in-progress')
      );
      const newActiveTaskId = newActiveTask?.id || null;
      const activeTaskChanged = newActiveTaskId !== state.currentActiveTaskId;
      
      // Recalculate layout if dynamic layout is enabled and active task changed
      let updatedNodes = state.nodes.map(node => 
        node.data.task.id === taskId 
          ? { ...node, data: { ...node.data, task: { ...node.data.task, status } } }
          : node
      );
      
      if (state.dynamicLayout && state.layoutMode === 'graph' && activeTaskChanged) {
        updatedNodes = calculateNodePositions(updatedTasks, 'graph', state.customPositions, true, newActiveTaskId);
      }
      
      return {
        tasks: updatedTasks,
        nodes: updatedNodes,
        currentActiveTaskId: newActiveTaskId
      };
    }),
    
    toggleTaskCollapse: (taskId) => set(state => ({
      nodes: state.nodes.map(node => 
        node.data.task.id === taskId 
          ? { ...node, data: { ...node.data, isCollapsed: !node.data.isCollapsed } }
          : node
      )
    })),
    
    setEditorPreference: (editor) => set({ editorPreference: editor }),
    
    openInEditor: (taskId) => {
      const { editorPreference, projectPath } = get();
      const task = get().tasks.find(t => t.id === taskId);
      if (!task) return;
      
      if (!projectPath) {
        console.warn('No project path available');
        alert('No project path available. Please load a project first.');
        return;
      }
      
      // Determine the file path to open
      let fileToOpen: string;
      
      // Check if task has a specific file path (for tasks loaded from individual files)
      if (task.filePath) {
        fileToOpen = task.filePath;
      } else {
        // For tasks loaded from tasks.json, open the tasks.json file
        fileToOpen = `${projectPath}/tasks/tasks.json`;
      }
      
      // Create the appropriate URI scheme
      const uriScheme = editorPreference === 'vscode' ? 'vscode' : 'cursor';
      const editorUri = `${uriScheme}://file${fileToOpen}`;
      
      try {
        // Use window.open to trigger the URI scheme
        window.open(editorUri, '_blank');
        console.log(`Opening file in ${editorPreference}: ${fileToOpen}`);
      } catch (error) {
        console.error('Failed to open file in editor:', error);
        alert(`Failed to open file in ${editorPreference}. Make sure ${editorPreference} is installed and associated with ${uriScheme}:// URLs.`);
      }
    },
    
    setSearchQuery: (query) => set({ searchQuery: query }),
    
    // New methods
    setTheme: (theme) => {
      const systemTheme = getSystemTheme();
      const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
      
      if (typeof window !== 'undefined') {
        if (isDarkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      
      set({ theme, isDarkMode });
      saveThemeToStorage(theme);
    },
    
    updateNodePosition: (nodeId, position) => {
      const state = get();
      const newPositions = new Map(state.customPositions);
      newPositions.set(nodeId, position);
      
      set({ 
        customPositions: newPositions,
        nodes: state.nodes.map(node => 
          node.id === nodeId ? { ...node, position } : node
        )
      });
      
      saveCustomPositions(newPositions);
    },
    
    setLastViewport: (viewport) => {
      set({ lastViewport: viewport });
      saveLastViewport(viewport);
    },
    
    setProjectName: (name) => {
      set({ projectName: name });
      saveProjectNameToStorage(name);
    },
    
    setFocusOnActiveTask: (focus) => {
      set({ focusOnActiveTask: focus });
      saveFocusOnActiveTaskToStorage(focus);
    },
    
    setDynamicLayout: (dynamic) => {
      const state = get();
      set({ dynamicLayout: dynamic });
      saveDynamicLayoutToStorage(dynamic); // Persist the setting
      
      // If enabling dynamic layout, recalculate layout with current active task
      if (dynamic && state.layoutMode === 'graph') {
        const activeTask = state.tasks.find(t => 
          t.status === 'in-progress' || t.subtasks.some(st => st.status === 'in-progress')
        );
        const activeTaskId = activeTask?.id || null;
        
        const nodes = calculateNodePositions(state.tasks, 'graph', state.customPositions, dynamic, activeTaskId);
        const edges = createEdges(state.tasks, 'graph');
        set({ nodes, edges, currentActiveTaskId: activeTaskId });
      }
    },
    
    // Live update methods
    enableLiveUpdates: () => {
      const state = get();
      if (state.sseConnection || state.isLiveUpdateEnabled) return;
      
      try {
        console.log('Connecting to live updates...');
        const eventSource = new EventSource('/api/live-updates');
        
        eventSource.onopen = () => {
          console.log('SSE connection opened');
          set({ isLiveUpdateEnabled: true, sseConnection: eventSource });
        };
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Received SSE message:', data);
            
            if (data.type === 'tasks-updated') {
              console.log('Tasks updated, refreshing...');
              const { layoutMode, customPositions } = get();
              const tasks: Task[] = data.data.tasks || [];
              const nodes = calculateNodePositions(tasks, layoutMode, customPositions);
              const edges = createEdges(tasks, layoutMode);
              
              set({ 
                tasks,
                nodes,
                edges,
                lastUpdateTime: data.timestamp,
                error: null
              });
            } else if (data.type === 'error') {
              console.error('SSE error:', data.message);
              set({ error: data.message });
            }
          } catch (parseError) {
            console.error('Failed to parse SSE message:', parseError);
          }
        };
        
        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          set({ 
            isLiveUpdateEnabled: false, 
            sseConnection: null,
            error: 'Live updates connection lost' 
          });
        };
        
      } catch (error) {
        console.error('Failed to enable live updates:', error);
        set({ error: 'Failed to enable live updates' });
      }
    },
    
    disableLiveUpdates: () => {
      const state = get();
      if (state.sseConnection) {
        state.sseConnection.close();
      }
      set({ 
        isLiveUpdateEnabled: false, 
        sseConnection: null 
      });
      console.log('Live updates disabled');
    },
    
    startWatchingProject: async (projectPath: string) => {
      try {
        const response = await fetch('/api/watch-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start watching project');
        }
        
        const result = await response.json();
        console.log('Started watching project:', result);
        
        // Enable live updates if not already enabled
        const state = get();
        if (!state.isLiveUpdateEnabled) {
          state.enableLiveUpdates();
        }
        
      } catch (error) {
        console.error('Failed to start watching project:', error);
        set({ error: `Failed to start watching project: ${error instanceof Error ? error.message : 'Unknown error'}` });
      }
    },
    
    stopWatchingProject: async (projectPath: string) => {
      try {
        const response = await fetch('/api/unwatch-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to stop watching project');
        }
        
        const result = await response.json();
        console.log('Stopped watching project:', result);
        
      } catch (error) {
        console.error('Failed to stop watching project:', error);
        set({ error: `Failed to stop watching project: ${error instanceof Error ? error.message : 'Unknown error'}` });
      }
    },
    
    clearAllStoredData: () => {
      if (typeof window === 'undefined') return;
      
      try {
        // Remove all TaskMaster related localStorage data
        const keysToRemove = [
          STORAGE_KEY,
          THEME_STORAGE_KEY,
          POSITIONS_STORAGE_KEY,
          VIEWPORT_STORAGE_KEY,
          PROJECT_NAME_STORAGE_KEY,
          FOCUS_ON_ACTIVE_TASK_KEY,
          DYNAMIC_LAYOUT_STORAGE_KEY
        ];
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
        
        console.log('All stored data cleared');
        
        // Reset store to initial state
        set({
          projectPath: null,
          theme: 'system',
          isDarkMode: getSystemTheme() === 'dark',
          customPositions: new Map(),
          lastViewport: null,
          projectName: null,
          focusOnActiveTask: true,
          dynamicLayout: false,
          editorPreference: 'cursor',
          selectedTaskId: null,
          searchQuery: '',
          layoutMode: 'grid'
        });
        
        // Reapply system theme
        const systemTheme = getSystemTheme();
        const isDarkMode = systemTheme === 'dark';
        
        if (typeof window !== 'undefined') {
          if (isDarkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        
      } catch (error) {
        console.warn('Failed to clear stored data:', error);
      }
    }
  };
});
