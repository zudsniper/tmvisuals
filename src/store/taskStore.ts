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
}

// Grid layout: simple ordered grid without overlaps, extends downward
function calculateGridLayout(tasks: Task[], customPositions: Map<string, { x: number; y: number }>): TaskNode[] {
  const nodes: TaskNode[] = [];
  
  // Node dimensions with EXTREMELY generous padding to prevent any overlaps
  const NODE_WIDTH = 300;
  const NODE_HEIGHT = 220;
  const HORIZONTAL_GUTTER = 75; 
  const VERTICAL_GUTTER = 75;     
  const MARGIN = 25;            // Much larger margin from edges
  
  // Get viewport width and calculate available space
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const availableWidth = viewportWidth - (2 * MARGIN); // Leave margin on both sides
  
  // Calculate how many columns can fit with proper gutters
  const columnsPerRow = Math.max(1, Math.floor((availableWidth + HORIZONTAL_GUTTER) / (NODE_WIDTH + HORIZONTAL_GUTTER)));
  
  tasks.forEach((task, index) => {
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
    
    const row = Math.floor(index / columnsPerRow);
    const col = index % columnsPerRow;
    
    // Simple grid positioning - no centering, just consistent spacing, allowing overflow
    const x = MARGIN + col * (NODE_WIDTH + HORIZONTAL_GUTTER);
    const y = MARGIN + 100 + row * (NODE_HEIGHT + VERTICAL_GUTTER); // Add 100px for top nav bar
    
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

// Enhanced timeline-style graph layout with intelligent fan-out positioning for better relationship lines
function calculateGraphLayout(tasks: Task[], customPositions: Map<string, { x: number; y: number }>): TaskNode[] {
  const nodes: TaskNode[] = [];
  const levelMap = new Map<number, number>();
  const visiting = new Set<number>(); // Track nodes currently being visited to detect cycles
  
  // Timeline layout dimensions - horizontal flow
  const NODE_WIDTH = 300;
  const NODE_HEIGHT = 140;
  const HORIZONTAL_SPACING = 250; // Increased spacing for better relationship lines
  const VERTICAL_SPACING = 100;   // Increased vertical spacing for better fan-out
  const MARGIN = 100;             // Margin from edges
  const TIMELINE_START_X = MARGIN; // Where timeline starts
  
  // Get viewport dimensions
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const availableHeight = viewportHeight - (2 * MARGIN);
  
  // First pass: determine timeline levels (time columns) based on dependencies
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
  
  // Group tasks by timeline level (time columns)
  const timelineColumns = new Map<number, Task[]>();
  tasks.forEach(task => {
    const level = levelMap.get(task.id) || 0;
    if (!timelineColumns.has(level)) {
      timelineColumns.set(level, []);
    }
    timelineColumns.get(level)!.push(task);
  });
  
  // Enhanced positioning with intelligent fan-out for relationship lines
  for (const [timeColumn, tasksInColumn] of timelineColumns) {
    const tasksCount = tasksInColumn.length;
    
    // Sort tasks by their dependency relationships for better visual flow
    tasksInColumn.sort((a, b) => {
      // Tasks with more dependencies appear higher to create better visual flow
      const aDeps = a.dependencies.length;
      const bDeps = b.dependencies.length;
      if (aDeps !== bDeps) return bDeps - aDeps;
      
      // Secondary sort by task ID for consistency
      return a.id - b.id;
    });
    
    tasksInColumn.forEach((task, index) => {
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
      
      // Enhanced timeline positioning with fan-out consideration
      const x = TIMELINE_START_X + timeColumn * (NODE_WIDTH + HORIZONTAL_SPACING);
      
      // Calculate vertical positioning with intelligent fan-out
      let y: number;
      
      if (tasksCount === 1) {
        // Single task: center it vertically
        y = MARGIN + 100 + availableHeight / 2 - NODE_HEIGHT / 2;
      } else {
        // Multiple tasks: create fan-out pattern for better relationship lines
        const totalColumnHeight = tasksCount * NODE_HEIGHT + (tasksCount - 1) * VERTICAL_SPACING;
        
        if (totalColumnHeight <= availableHeight) {
          // Tasks fit in viewport: center the group and fan out evenly
          const startY = MARGIN + 100 + (availableHeight - totalColumnHeight) / 2;
          y = startY + index * (NODE_HEIGHT + VERTICAL_SPACING);
        } else {
          // Tasks don't fit: use adaptive spacing
          const adaptiveSpacing = Math.max(60, (availableHeight - tasksCount * NODE_HEIGHT) / (tasksCount - 1));
          y = MARGIN + 100 + index * (NODE_HEIGHT + adaptiveSpacing);
        }
      }
      
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
  }
  
  return nodes;
}

// Calculate positions based on layout mode
function calculateNodePositions(tasks: Task[], layoutMode: LayoutMode, customPositions: Map<string, { x: number; y: number }>): TaskNode[] {
  switch (layoutMode) {
    case 'grid':
      return calculateGridLayout(tasks, customPositions);
    case 'graph':
      return calculateGraphLayout(tasks, customPositions);
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
    
    loadTasks: (tasks) => {
      console.log('loadTasks called with:', tasks);
      console.log('Number of tasks to load:', tasks?.length);
      const { layoutMode, customPositions } = get();
      const nodes = calculateNodePositions(tasks, layoutMode, customPositions);
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
        
        const { layoutMode, customPositions } = get();
        const nodes = calculateNodePositions(tasks, layoutMode, customPositions);
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
          error: null 
        });
        
        // Save to localStorage after successful load
        saveProjectPathToStorage(projectPath);
        if (!currentProjectName) {
          saveProjectNameToStorage(newProjectName);
        }
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
      const { tasks, customPositions } = get();
      const nodes = calculateNodePositions(tasks, mode, customPositions);
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
      
      const fileName = `task_${String(taskId).padStart(3, '0')}.json`;
      const filePath = `/Users/jason/ai/tmvisuals/tasks/${fileName}`;
      
      const editorCommand = editorPreference === 'vscode' ? 'code' : 'cursor';
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        electronAPI.openInEditor(filePath, editorCommand);
      } else {
        console.log(`Would open ${filePath} in ${editorCommand}`);
        alert(`To open in editor: ${editorCommand} ${filePath}`);
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
    }
  };
});
