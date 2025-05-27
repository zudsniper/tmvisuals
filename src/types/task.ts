export type TaskStatus = 'pending' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Subtask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
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
}

export interface TaskEdge {
  id: string;
  source: string;
  target: string;
  type: 'dependency';
  animated?: boolean;
  style?: React.CSSProperties;
}
