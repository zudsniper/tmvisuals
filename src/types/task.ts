export type TaskStatus = 'pending' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Subtask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  lastUpdated?: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  details: string;
  testStrategy: string;
  priority: TaskPriority;
  dependencies: number[];
  status: TaskStatus;
  subtasks: Subtask[];
  lastUpdated?: string;
  // Optional properties added by server for tasks loaded from individual files
  filePath?: string;
  fileName?: string;
  // Context menu and interaction properties
  isLocked?: boolean;
  zIndex?: number;
}

export interface TaskData {
  tasks: Task[];
}

// ReactFlow types
export interface TaskNode {
  id: string;
  type: 'task';
  position: { x: number; y: number };
  data: {
    task: Task;
    isCollapsed: boolean;
  };
  zIndex?: number;
}

export interface TaskEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'straight' | 'smoothstep' | 'bezier' | 'dependency';
  animated?: boolean;
  style?: React.CSSProperties;
}
