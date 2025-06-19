import { create } from 'zustand';
import React from 'react';
import { Task, TaskNode, TaskEdge } from '../types/task';
import { Viewport } from 'reactflow';
import { ForceDirectedLayout, DEFAULT_FORCE_CONFIG, ForceLayoutConfig } from '../utils/forceLayout';
import { ViewportManager, CameraController, TaskStatusManager } from '../utils/viewportManager';

export type LayoutMode = 'grid' | 'graph' | 'force';
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
  
  // Force-directed layout system
  forceLayout: ForceDirectedLayout | null;
  isSimulationRunning: boolean;
  
  // Viewport management system
  viewportManager: ViewportManager;
  cameraController: CameraController;
  taskStatusManager: TaskStatusManager;
  autoFocusOnActiveTask: boolean; // Control automatic viewport centering
  focusTransitionDuration: number; // Duration for focus transitions
  
  // Live updates
  isLiveUpdateEnabled: boolean;
  sseConnection: EventSource | null;
  lastUpdateTime: string | null;
  
  // Context menu state
  contextMenu: {
    isVisible: boolean;
    position: { x: number; y: number };
    targetNodeId: string | null;
    isBackgroundMenu: boolean;
  };
  
  // Grid and viewport state
  showGrid: boolean;
  reactFlowInstance: any;
  
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
  
  // Force layout actions
  initializeForceLayout: () => void;
  updateForceLayout: (config?: Partial<ForceLayoutConfig>) => void;
  startForceSimulation: () => void;
  stopForceSimulation: () => void;
  setActiveTaskFocus: (taskId: number | null) => void;
  
  // Live update actions
  enableLiveUpdates: () => void;
  disableLiveUpdates: () => void;
  startWatchingProject: (projectPath: string) => Promise<void>;
  stopWatchingProject: (projectPath: string) => Promise<void>;
  
  // Context menu actions
  showContextMenu: (position: { x: number; y: number }, targetNodeId?: string) => void;
  hideContextMenu: () => void;
  toggleTaskLock: (taskId: number) => void;
  bringTaskToFront: (taskId: number) => void;
  sendTaskToBack: (taskId: number) => void;
  duplicateTask: (taskId: number) => void;
  deleteTask: (taskId: number) => void;
  
  // Grid and viewport actions
  toggleGrid: () => void;
  resetLayout: () => void;
  fitAllNodes: () => void;
  centerViewport: () => void;
  setReactFlowInstance: (instance: any) => void;
  
  // Export actions
  exportToPNG: (fullGraph?: boolean) => Promise<void>;
  exportToMermaid: () => string;
  
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

// Force-directed graph layout using physics simulation
function calculateForceDirectedLayout(tasks: Task[], customPositions: Map<string, { x: number; y: number }>, forceLayout: ForceDirectedLayout | null, activeTaskId: number | null = null): TaskNode[] {
  const nodes: TaskNode[] = [];
  
  // If force layout is not initialized or no tasks, fall back to static layout
  if (!forceLayout || tasks.length === 0) {
    return calculateGraphLayout(tasks, customPositions, false, activeTaskId);
  }
  
  // Use positions from force simulation or fall back to custom positions
  tasks.forEach(task => {
    const nodeId = `task-${task.id}`;
    
    // Try to get position from custom positions (updated by force simulation)
    const position = customPositions.get(nodeId) || { 
      x: Math.random() * 800 + 200, // Random initial position if no data
      y: Math.random() * 600 + 150 
    };
    
    nodes.push({
      id: nodeId,
      type: 'task',
      position,
      data: { task, isCollapsed: false }
    });
  });
  
  return nodes;
}

// Calculate positions based on layout mode
function calculateNodePositions(tasks: Task[], layoutMode: LayoutMode, customPositions: Map<string, { x: number; y: number }>, dynamicLayout?: boolean, activeTaskId?: number | null): TaskNode[];
function calculateNodePositions(tasks: Task[], layoutMode: LayoutMode, customPositions: Map<string, { x: number; y: number }>, dynamicLayout: boolean, activeTaskId: number | null, forceLayout: ForceDirectedLayout | null): TaskNode[];
function calculateNodePositions(tasks: Task[], layoutMode: LayoutMode, customPositions: Map<string, { x: number; y: number }>, dynamicLayout: boolean = false, activeTaskId: number | null = null, forceLayout?: ForceDirectedLayout | null): TaskNode[] {
  // If force layout is provided and layout mode is graph, use force-directed layout
  if (forceLayout && layoutMode === 'graph') {
    return calculateForceDirectedLayout(tasks, customPositions, forceLayout, activeTaskId);
  }
  
  switch (layoutMode) {
    case 'grid':
      return calculateGridLayout(tasks, customPositions);
    case 'graph':
      return calculateGraphLayout(tasks, customPositions, dynamicLayout, activeTaskId);
    case 'force':
      return calculateForceDirectedLayout(tasks, customPositions, forceLayout || null, activeTaskId);
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

// Enhanced edge routing algorithms with collision avoidance and smart path selection
// Interfaces for future advanced routing features
// interface EdgeRouting would go here when implementing advanced pathfinding

// Node spatial index for efficient collision detection
class SpatialIndex {
  private nodePositions: Map<string, { x: number; y: number; width: number; height: number }> = new Map();
  
  addNode(id: string, x: number, y: number, width: number = 280, height: number = 120) {
    this.nodePositions.set(id, { x, y, width, height });
  }
  
  getNodeBounds(id: string) {
    return this.nodePositions.get(id);
  }
  
  checkIntersection(x1: number, y1: number, x2: number, y2: number): boolean {
    for (const [_nodeId, bounds] of this.nodePositions) {
      if (this.lineIntersectsRect(x1, y1, x2, y2, bounds)) {
        return true;
      }
    }
    return false;
  }
  
  private lineIntersectsRect(x1: number, y1: number, x2: number, y2: number, 
                           rect: { x: number; y: number; width: number; height: number }): boolean {
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;
    
    // Check if line intersects any of the rectangle's edges
    return this.lineIntersectsLine(x1, y1, x2, y2, left, top, right, top) ||
           this.lineIntersectsLine(x1, y1, x2, y2, right, top, right, bottom) ||
           this.lineIntersectsLine(x1, y1, x2, y2, right, bottom, left, bottom) ||
           this.lineIntersectsLine(x1, y1, x2, y2, left, bottom, left, top);
  }
  
  private lineIntersectsLine(x1: number, y1: number, x2: number, y2: number,
                           x3: number, y3: number, x4: number, y4: number): boolean {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return false;
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
}

// Edge bundling for multiple connections between same nodes
function bundleEdges(edges: { source: string; target: string; data: any }[]): 
  { source: string; target: string; data: any; offset: number }[] {
  const bundles = new Map<string, { source: string; target: string; data: any }[]>();
  
  edges.forEach(edge => {
    const key = `${edge.source}-${edge.target}`;
    if (!bundles.has(key)) {
      bundles.set(key, []);
    }
    bundles.get(key)!.push(edge);
  });
  
  const result: { source: string; target: string; data: any; offset: number }[] = [];
  
  bundles.forEach(bundleEdges => {
    if (bundleEdges.length === 1) {
      result.push({ ...bundleEdges[0], offset: 0 });
    } else {
      bundleEdges.forEach((edge, index) => {
        const totalEdges = bundleEdges.length;
        const offset = (index - (totalEdges - 1) / 2) * 20; // 20px spacing between bundled edges
        result.push({ ...edge, offset });
      });
    }
  });
  
  return result;
}

// Smart routing algorithm to avoid node intersections (for future enhancement)
// function calculateSmartRoute would go here when we implement advanced pathfinding

function createEdges(tasks: Task[], layoutMode: LayoutMode): TaskEdge[] {
  if (layoutMode !== 'graph' && layoutMode !== 'force') {
    return []; // No edges in grid mode, but show edges in both graph and force modes
  }
  
  const edges: TaskEdge[] = [];
  const spatialIndex = new SpatialIndex();
  
  // Create task lookup map for quick access
  const taskMap = new Map<number, Task>();
  tasks.forEach(task => taskMap.set(task.id, task));
  
  // Build spatial index from current node positions (simplified - in real app would get from ReactFlow)
  tasks.forEach(task => {
    // Note: In real implementation, we'd get actual node positions from ReactFlow
    // For now, we'll use a simplified approach
    spatialIndex.addNode(`task-${task.id}`, task.id * 300, task.id * 150);
  });
  
  // Collect all edge relationships for bundling
  const edgeRelationships: { source: string; target: string; data: {
    sourceTask: Task;
    targetTask: Task;
    relationshipType: 'dependency' | 'subtask' | 'priority';
    priority: number;
  }}[] = [];
  
  tasks.forEach(task => {
    task.dependencies.forEach((depId, index) => {
      const sourceTask = taskMap.get(depId);
      if (sourceTask) {
        edgeRelationships.push({
          source: `task-${depId}`,
          target: `task-${task.id}`,
          data: {
            sourceTask,
            targetTask: task,
            relationshipType: 'dependency',
            priority: index
          }
        });
      }
    });
  });
  
  // Bundle edges to prevent overlap
  const bundledEdges = bundleEdges(edgeRelationships);
  
  bundledEdges.forEach(({ source, target, data, offset }) => {
    const { sourceTask, targetTask } = data;
    
    // Determine if this edge should be animated based on task statuses
    const isSourceActive = sourceTask.status === 'in-progress' || 
      sourceTask.subtasks.some((st: any) => st.status === 'in-progress');
    const isTargetActive = targetTask.status === 'in-progress' || 
      targetTask.subtasks.some((st: any) => st.status === 'in-progress');
    const shouldAnimate = isSourceActive || isTargetActive;
    
    // Enhanced edge styling based on relationship and status
    let edgeColor = '#64748b'; // Default gray
    let edgeOpacity = 0.6;
    let strokeWidth = 2;
    let strokeDasharray: string | undefined = undefined;
    let edgeType: 'default' | 'straight' | 'smoothstep' | 'bezier' | 'dependency' = 'smoothstep';
    
    // Style based on task status relationships
    if (isTargetActive) {
      edgeColor = '#3b82f6'; // Blue for incoming to active tasks
      edgeOpacity = 0.9;
      strokeWidth = 3;
      edgeType = 'smoothstep';
    } else if (isSourceActive) {
      edgeColor = '#10b981'; // Green for outgoing from active tasks
      edgeOpacity = 0.8;
      strokeWidth = 2.5;
      edgeType = 'smoothstep';
    } else if (sourceTask.status === 'done' && targetTask.status === 'pending') {
      edgeColor = '#22c55e'; // Green for completed dependencies
      edgeOpacity = 0.7;
      strokeDasharray = '8,4'; // Dashed line for completed dependencies
      edgeType = 'bezier';
    } else if (sourceTask.status === 'done' && targetTask.status === 'done') {
      edgeColor = '#94a3b8'; // Light gray for completed chains
      edgeOpacity = 0.4;
      strokeWidth = 1.5;
      edgeType = 'straight';
    }
    
    // Priority-based styling
    if (targetTask.priority === 'high') {
      edgeColor = '#ef4444'; // Red for high priority connections
      strokeWidth = Math.max(strokeWidth, 2.5);
    } else if (targetTask.priority === 'low') {
      edgeOpacity = Math.min(edgeOpacity, 0.5);
      strokeWidth = Math.max(strokeWidth - 0.5, 1);
    }
    
    // Apply offset for bundled edges
    const style: React.CSSProperties = {
      stroke: edgeColor,
      strokeWidth,
      strokeOpacity: edgeOpacity,
      strokeDasharray
    };
    
    if (offset !== 0) {
      // For bundled edges, slightly adjust the path
      style.transform = `translateY(${offset}px)`;
      edgeOpacity = Math.max(0.3, edgeOpacity - Math.abs(offset) * 0.01);
    }
    
    edges.push({
      id: `edge-${sourceTask.id}-${targetTask.id}-${Math.abs(offset)}`,
      source,
      target,
      type: edgeType,
      animated: shouldAnimate,
      style
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
    
    // Force-directed layout system
    forceLayout: null,
    isSimulationRunning: false,
    
    // Viewport management system
    viewportManager: new ViewportManager(),
    cameraController: new CameraController(),
    taskStatusManager: new TaskStatusManager(),
    autoFocusOnActiveTask: true, // Default to enabled
    focusTransitionDuration: 1000, // 1 second transitions
    
    // Live updates
    isLiveUpdateEnabled: false,
    sseConnection: null,
    lastUpdateTime: null,
    
    // Context menu state
    contextMenu: {
      isVisible: false,
      position: { x: 0, y: 0 },
      targetNodeId: null,
      isBackgroundMenu: false,
    },
    
    // Grid and viewport state
    showGrid: false,
    reactFlowInstance: null,
    
    loadTasks: (tasks) => {
      console.log('loadTasks called with:', tasks);
      console.log('Number of tasks to load:', tasks?.length);
      const { layoutMode, customPositions, dynamicLayout, forceLayout } = get();
      
      // Track active task for dynamic layout
      const activeTask = tasks.find(t => 
        t.status === 'in-progress' || t.subtasks.some(st => st.status === 'in-progress')
      );
      const activeTaskId = activeTask?.id || null;
      
      const nodes = calculateNodePositions(tasks, layoutMode, customPositions, dynamicLayout, activeTaskId, forceLayout);
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
        
        const { layoutMode, customPositions, dynamicLayout, forceLayout } = get();
        
        // Track active task for dynamic layout
        const activeTask = tasks.find(t => 
          t.status === 'in-progress' || t.subtasks.some(st => st.status === 'in-progress')
        );
        const activeTaskId = activeTask?.id || null;
        
        const nodes = calculateNodePositions(tasks, layoutMode, customPositions, dynamicLayout, activeTaskId, forceLayout);
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
        // Enhanced error handling with user-friendly messages
        let userFriendlyError = 'Failed to load tasks';
        
        if (error instanceof Error) {
          const errorMessage = error.message;
          
          if (errorMessage.includes('tasks directory not found') || errorMessage.includes('No tasks directory')) {
            userFriendlyError = `No tasks directory found in the selected project.\n\nTo get started:\n• Create a 'tasks' folder in your project root\n• Add a tasks.json file or individual task files\n• Refresh to see your tasks`;
          } else if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
            userFriendlyError = `Permission denied accessing the project folder.\n\nPlease check that you have read access to the directory and try selecting a different folder.`;
          } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
            userFriendlyError = 'Connection error. Please check if the server is running and try again.';
          } else if (errorMessage.includes('JSON')) {
            userFriendlyError = `Invalid task file format.\n\nPlease check your tasks.json file for syntax errors, or download a template to get started.`;
          } else {
            userFriendlyError = errorMessage;
          }
        }
        
        set({ 
          isLoading: false, 
          error: userFriendlyError,
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
      const state = get();
      const { tasks, customPositions, dynamicLayout, currentActiveTaskId, forceLayout } = state;
      
      // Initialize force layout if switching to force mode and not already initialized
      if (mode === 'force' && !forceLayout) {
        // First initialize the force layout
        const config: ForceLayoutConfig = {
          ...DEFAULT_FORCE_CONFIG,
          width: typeof window !== 'undefined' ? window.innerWidth : 1200,
          height: typeof window !== 'undefined' ? window.innerHeight : 800,
          activeTaskId: currentActiveTaskId,
        };
        
        const newForceLayout = new ForceDirectedLayout(config);
        
        // Set up simulation event handlers
        newForceLayout.onTickUpdate((nodes) => {
          const { customPositions, tasks, layoutMode } = get();
          const newPositions = new Map(customPositions);
          
          nodes.forEach(node => {
            if (node.x !== undefined && node.y !== undefined) {
              newPositions.set(node.id, { x: node.x, y: node.y });
            }
          });
          
          // Update positions and recalculate nodes if we're in force mode
          if (layoutMode === 'force') {
            const updatedNodes = calculateNodePositions(tasks, 'force', newPositions, dynamicLayout, currentActiveTaskId, newForceLayout);
            set({ customPositions: newPositions, nodes: updatedNodes });
          } else {
            set({ customPositions: newPositions });
          }
        });
        
        newForceLayout.onSimulationEnd(() => {
          set({ isSimulationRunning: false });
        });
        
        // Set the new force layout and start simulation
        set({ forceLayout: newForceLayout });
        
        // Optimize for large datasets
        newForceLayout.optimizeForLargeDataset(tasks.length);
        
        // Start the simulation
        newForceLayout.setData(tasks, customPositions);
        newForceLayout.start();
        set({ isSimulationRunning: true });
      }
      
      const nodes = calculateNodePositions(tasks, mode, customPositions, dynamicLayout, currentActiveTaskId, mode === 'force' ? (forceLayout || get().forceLayout) : forceLayout);
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
      
      if (state.dynamicLayout && (state.layoutMode === 'graph' || state.layoutMode === 'force') && activeTaskChanged) {
        updatedNodes = calculateNodePositions(updatedTasks, state.layoutMode, state.customPositions, true, newActiveTaskId, state.forceLayout);
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
      if (dynamic && (state.layoutMode === 'graph' || state.layoutMode === 'force')) {
        const activeTask = state.tasks.find(t => 
          t.status === 'in-progress' || t.subtasks.some(st => st.status === 'in-progress')
        );
        const activeTaskId = activeTask?.id || null;
        
        const nodes = calculateNodePositions(state.tasks, state.layoutMode, state.customPositions, dynamic, activeTaskId, state.forceLayout);
        const edges = createEdges(state.tasks, state.layoutMode);
        set({ nodes, edges, currentActiveTaskId: activeTaskId });
      }
    },
    
    // Force layout actions
    initializeForceLayout: () => {
      const { tasks } = get();
      if (tasks.length === 0) return;
      
      const config: ForceLayoutConfig = {
        ...DEFAULT_FORCE_CONFIG,
        width: typeof window !== 'undefined' ? window.innerWidth : 1200,
        height: typeof window !== 'undefined' ? window.innerHeight : 800,
      };
      
      const forceLayout = new ForceDirectedLayout(config);
      
      // Set up simulation event handlers
      forceLayout.onTickUpdate((nodes) => {
        const { customPositions, tasks, layoutMode, dynamicLayout, currentActiveTaskId } = get();
        const newPositions = new Map(customPositions);
        
        nodes.forEach(node => {
          if (node.x !== undefined && node.y !== undefined) {
            newPositions.set(node.id, { x: node.x, y: node.y });
          }
        });
        
        // Update positions and recalculate nodes if we're in force mode
        if (layoutMode === 'force') {
          const updatedNodes = calculateNodePositions(tasks, 'force', newPositions, dynamicLayout, currentActiveTaskId, forceLayout);
          set({ customPositions: newPositions, nodes: updatedNodes });
        } else {
          set({ customPositions: newPositions });
        }
      });
      
      forceLayout.onSimulationEnd(() => {
        set({ isSimulationRunning: false });
      });
      
      set({ forceLayout, isSimulationRunning: false });
      
      // Optimize for large datasets
      forceLayout.optimizeForLargeDataset(tasks.length);
    },
    
    updateForceLayout: (config) => {
      const { forceLayout } = get();
      if (!forceLayout) return;
      
      if (config) {
        // Use smooth transition for significant layout changes
        const significantChanges = config.linkDistance || config.chargeStrength || config.collisionRadius;
        
        if (significantChanges) {
          // Use the new smooth transition method for layout parameter changes
          forceLayout.transitionToNewLayout(config, 500);
        } else {
          // Direct update for minor changes
          forceLayout.updateConfig(config);
        }
      }
    },
    
    startForceSimulation: () => {
      const { forceLayout, tasks, customPositions } = get();
      if (!forceLayout || tasks.length === 0) return;
      
      // Set data in the force layout
      forceLayout.setData(tasks, customPositions);
      forceLayout.start();
      set({ isSimulationRunning: true });
    },
    
    stopForceSimulation: () => {
      const { forceLayout } = get();
      if (!forceLayout) return;
      
      forceLayout.stop();
      set({ isSimulationRunning: false });
    },
    
    setActiveTaskFocus: (taskId) => {
      const { forceLayout } = get();
      if (!forceLayout) return;
      
      const config = { activeTaskId: taskId };
      forceLayout.updateConfig(config);
      set({ currentActiveTaskId: taskId });
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
              console.error('🔴 SSE error:', data.message);
              const errorMsg = data.details ? `${data.message}: ${data.details}` : data.message;
              set({ error: errorMsg });
            } else if (data.type === 'watcher-error') {
              console.error('🔴 File watcher error:', data.message);
              const errorMsg = `File watcher error: ${data.message}${data.details ? ` (${data.details})` : ''}`;
              set({ 
                error: errorMsg,
                isLiveUpdateEnabled: false // Disable live updates on watcher error
              });
              // Optionally close the SSE connection when watcher fails
              if (eventSource) {
                eventSource.close();
                set({ sseConnection: null });
              }
            } else if (data.type === 'connected') {
              console.log('🟢 SSE connection established with ID:', data.id);
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
        
        const result = await response.json();
        
        if (!response.ok) {
          // Handle different types of errors
          if (response.status === 404) {
            // Tasks directory not found
            console.warn(`⚠️ Tasks directory not found: ${result.message}`);
            console.log(`📝 Suggestion: ${result.suggestion}`);
            
            if (result.maxRetriesExceeded) {
              console.error('❌ Maximum retry attempts exceeded for this project');
              set({ 
                error: `${result.message}\n\n${result.suggestion}`,
                isLiveUpdateEnabled: false
              });
              return; // Don't enable live updates
            } else {
              console.log(`🔄 Retry ${result.retryCount}/${result.maxRetries} for project watching`);
              set({ 
                error: `${result.message} (Attempt ${result.retryCount}/${result.maxRetries})\n\n${result.suggestion}` 
              });
              // Don't enable live updates for missing directories
              return;
            }
          } else if (response.status === 400 && result.maxRetriesExceeded) {
            // Maximum retries exceeded
            console.error('❌ Maximum retry attempts exceeded:', result.message);
            set({ 
              error: `${result.message}\n\n${result.suggestion}`,
              isLiveUpdateEnabled: false
            });
            return;
          } else {
            // Other server errors
            throw new Error(result.error || result.message || 'Failed to start watching project');
          }
        }
        
        // Success case
        if (result.watching) {
          console.log('✅ Started watching project:', result);
          
          // Clear any existing error
          set({ error: null });
          
          // Enable live updates if not already enabled
          const state = get();
          if (!state.isLiveUpdateEnabled) {
            state.enableLiveUpdates();
          }
        } else {
          // Server returned success but not watching (shouldn't happen with new logic)
          console.warn('⚠️ Server response indicates not watching:', result.message);
          set({ error: result.message || 'Project watching not enabled' });
        }
        
      } catch (error) {
        console.error('❌ Failed to start watching project:', error);
        set({ 
          error: `Failed to start watching project: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isLiveUpdateEnabled: false
        });
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
    },
    
    // Context menu actions
    showContextMenu: (position, targetNodeId) => {
      set({
        contextMenu: {
          isVisible: true,
          position,
          targetNodeId: targetNodeId || null,
          isBackgroundMenu: !targetNodeId,
        }
      });
    },
    
    hideContextMenu: () => {
      set({
        contextMenu: {
          isVisible: false,
          position: { x: 0, y: 0 },
          targetNodeId: null,
          isBackgroundMenu: false,
        }
      });
    },
    
    toggleTaskLock: (taskId) => {
      const { tasks, nodes } = get();
      const updatedTasks = tasks.map(task => 
        task.id === taskId 
          ? { ...task, isLocked: !task.isLocked }
          : task
      );
      
      const updatedNodes = nodes.map(node => 
        node.data.task.id === taskId 
          ? { ...node, data: { ...node.data, task: { ...node.data.task, isLocked: !node.data.task.isLocked } } }
          : node
      );
      
      set({ tasks: updatedTasks, nodes: updatedNodes });
    },
    
    bringTaskToFront: (taskId) => {
      const { tasks, nodes } = get();
      const maxZIndex = Math.max(...tasks.map(t => t.zIndex || 0), 0);
      const newZIndex = maxZIndex + 1;
      
      const updatedTasks = tasks.map(task => 
        task.id === taskId 
          ? { ...task, zIndex: newZIndex }
          : task
      );
      
      const updatedNodes = nodes.map(node => 
        node.data.task.id === taskId 
          ? { ...node, data: { ...node.data, task: { ...node.data.task, zIndex: newZIndex } }, zIndex: newZIndex }
          : node
      );
      
      set({ tasks: updatedTasks, nodes: updatedNodes });
    },
    
    sendTaskToBack: (taskId) => {
      const { tasks, nodes } = get();
      const minZIndex = Math.min(...tasks.map(t => t.zIndex || 0), 0);
      const newZIndex = minZIndex - 1;
      
      const updatedTasks = tasks.map(task => 
        task.id === taskId 
          ? { ...task, zIndex: newZIndex }
          : task
      );
      
      const updatedNodes = nodes.map(node => 
        node.data.task.id === taskId 
          ? { ...node, data: { ...node.data, task: { ...node.data.task, zIndex: newZIndex } }, zIndex: newZIndex }
          : node
      );
      
      set({ tasks: updatedTasks, nodes: updatedNodes });
    },
    
    duplicateTask: (taskId) => {
      const { tasks, customPositions, layoutMode, dynamicLayout, currentActiveTaskId, forceLayout } = get();
      const taskToDuplicate = tasks.find(t => t.id === taskId);
      if (!taskToDuplicate) return;
      
      const newTaskId = Math.max(...tasks.map(t => t.id)) + 1;
      const newTask: Task = {
        ...taskToDuplicate,
        id: newTaskId,
        title: `${taskToDuplicate.title} (Copy)`,
        dependencies: [], // Clear dependencies for duplicate
        isLocked: false,
        zIndex: (taskToDuplicate.zIndex || 0) + 1
      };
      
      const updatedTasks = [...tasks, newTask];
      const nodes = calculateNodePositions(updatedTasks, layoutMode, customPositions, dynamicLayout, currentActiveTaskId, forceLayout);
      const edges = createEdges(updatedTasks, layoutMode);
      
      set({ tasks: updatedTasks, nodes, edges });
    },
    
    deleteTask: (taskId) => {
      const { tasks, customPositions, layoutMode, dynamicLayout, currentActiveTaskId, forceLayout } = get();
      const updatedTasks = tasks.filter(t => t.id !== taskId);
      
      // Remove any dependencies on the deleted task
      const cleanedTasks = updatedTasks.map(task => ({
        ...task,
        dependencies: task.dependencies.filter(depId => depId !== taskId)
      }));
      
      // Remove custom position for deleted task
      const newCustomPositions = new Map(customPositions);
      newCustomPositions.delete(`task-${taskId}`);
      
      const nodes = calculateNodePositions(cleanedTasks, layoutMode, newCustomPositions, dynamicLayout, currentActiveTaskId, forceLayout);
      const edges = createEdges(cleanedTasks, layoutMode);
      
      set({ tasks: cleanedTasks, nodes, edges, customPositions: newCustomPositions });
    },
    
    // Grid and viewport actions
    toggleGrid: () => {
      set(state => ({ showGrid: !state.showGrid }));
    },
    
    resetLayout: () => {
      const { tasks, layoutMode, dynamicLayout, currentActiveTaskId, forceLayout } = get();
      const newCustomPositions = new Map();
      const nodes = calculateNodePositions(tasks, layoutMode, newCustomPositions, dynamicLayout, currentActiveTaskId, forceLayout);
      const edges = createEdges(tasks, layoutMode);
      
      set({ customPositions: newCustomPositions, nodes, edges });
    },
    
    fitAllNodes: () => {
      const { reactFlowInstance } = get();
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.1, maxZoom: 1.5, duration: 800 });
      }
    },
    
    centerViewport: () => {
      const { reactFlowInstance } = get();
      if (reactFlowInstance) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({ x: 0, y: 0, zoom: viewport.zoom }, { duration: 800 });
      }
    },
    
    setReactFlowInstance: (instance: any) => {
      set({ reactFlowInstance: instance });
    },
    
    // Export actions
    exportToPNG: async (fullGraph = false) => {
      try {
        // Dynamically import html2canvas
        const { default: html2canvas } = await import('html2canvas');
        
        // Find the ReactFlow wrapper element
        const reactFlowWrapper = document.querySelector('.react-flow');
        if (!reactFlowWrapper) {
          console.error('ReactFlow element not found');
          return;
        }
        
        let targetElement = reactFlowWrapper as HTMLElement;
        
        if (!fullGraph) {
          // For visible area only, use the viewport
          const viewport = document.querySelector('.react-flow__viewport');
          if (viewport) {
            targetElement = viewport as HTMLElement;
          }
        }
        
        // Generate canvas from the target element
        const canvas = await html2canvas(targetElement, {
          backgroundColor: null, // Transparent background
          scale: 2, // Higher quality
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
          logging: false
        });
        
        // Convert to blob and download
        canvas.toBlob((blob: Blob | null) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `task-visualization-${fullGraph ? 'full' : 'visible'}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        }, 'image/png');
        
        console.log(`PNG export completed (fullGraph: ${fullGraph})`);
      } catch (error) {
        console.error('Error exporting to PNG:', error);
        // Fallback: show message to user
        alert('PNG export failed. Please try again or use a different browser.');
      }
    },
    
    exportToMermaid: () => {
      const { tasks } = get();
      
      let mermaid = 'graph TD\n';
      
      // Add nodes
      tasks.forEach(task => {
        const nodeId = `T${task.id}`;
        const nodeLabel = task.title.replace(/"/g, '\\"');
        const statusClass = task.status === 'done' ? ':::done' : 
                           task.status === 'in-progress' ? ':::inProgress' : 
                           ':::pending';
        mermaid += `    ${nodeId}["${nodeLabel}"]${statusClass}\n`;
      });
      
      // Add edges (dependencies)
      tasks.forEach(task => {
        task.dependencies.forEach(depId => {
          mermaid += `    T${depId} --> T${task.id}\n`;
        });
      });
      
      // Add class definitions
      mermaid += '\n    classDef done fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff\n';
      mermaid += '    classDef inProgress fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff\n';
      mermaid += '    classDef pending fill:#6b7280,stroke:#4b5563,stroke-width:2px,color:#fff\n';
      
      // Copy to clipboard
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(mermaid).then(() => {
          console.log('Mermaid diagram copied to clipboard');
        }).catch(err => {
          console.error('Failed to copy to clipboard:', err);
        });
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = mermaid;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          console.log('Mermaid diagram copied to clipboard (fallback)');
        } catch (err) {
          console.error('Failed to copy to clipboard (fallback):', err);
        }
        document.body.removeChild(textArea);
      }
      
      return mermaid;
    }
  };
});
