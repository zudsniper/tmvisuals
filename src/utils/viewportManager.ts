import { Viewport } from 'reactflow';
import { Task, TaskNode } from '../types/task';

export interface ViewportCalculationOptions {
  padding?: number;
  includeRelatedTasks?: boolean;
  maxZoom?: number;
  minZoom?: number;
  animationDuration?: number;
}

export interface ViewportTransition {
  from: Viewport;
  to: Viewport;
  duration: number;
  easing?: string;
}

/**
 * Manages viewport positioning and calculations for task focus
 */
export class ViewportManager {
  private defaultOptions: ViewportCalculationOptions = {
    padding: 150,
    includeRelatedTasks: true,
    maxZoom: 1.5,
    minZoom: 0.1,
    animationDuration: 1000
  };

  /**
   * Calculate optimal viewport to center on an active task using nodes and task ID
   */
  calculateOptimalViewport(
    nodes: TaskNode[],
    activeTaskId: number,
    currentViewport?: Viewport,
    options: Partial<ViewportCalculationOptions> = {}
  ): Viewport | null {
    const opts = { ...this.defaultOptions, ...options };
    
    // Find the active task node
    const activeNode = nodes.find(node => node.data.task.id === activeTaskId);
    if (!activeNode || !activeNode.position) {
      return null;
    }

    let targetNodes = [activeNode];

    // Include related tasks if enabled
    if (opts.includeRelatedTasks) {
      const allTasks = nodes.map(n => n.data.task);
      const relatedTasks = this.findRelatedTasks(activeNode.data.task, allTasks);
      const relatedNodes = nodes.filter(node => 
        relatedTasks.some(task => task.id === node.data.task.id) && 
        node.position
      );
      targetNodes = [...targetNodes, ...relatedNodes];
    }

    // Calculate bounding box of target nodes
    const bounds = this.calculateBoundingBox(targetNodes);
    if (!bounds) {
      return currentViewport || { x: 0, y: 0, zoom: 1 };
    }

    // Calculate viewport dimensions
    const { width: viewportWidth, height: viewportHeight } = this.getViewportDimensions();

    // Calculate zoom level to fit all target nodes with padding
    const boundsWidth = bounds.maxX - bounds.minX + 300; // Add node width
    const boundsHeight = bounds.maxY - bounds.minY + 200; // Add node height
    
    const scaleX = (viewportWidth - opts.padding! * 2) / boundsWidth;
    const scaleY = (viewportHeight - opts.padding! * 2) / boundsHeight;
    const zoom = Math.min(scaleX, scaleY, opts.maxZoom!, Math.max(opts.minZoom!, 0.1));

    // Calculate center position
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Convert to viewport coordinates
    const x = viewportWidth / 2 - centerX * zoom;
    const y = viewportHeight / 2 - centerY * zoom;

    return { x, y, zoom };
  }

  /**
   * Calculate viewport to fit multiple tasks
   */
  calculateFitViewport(
    tasks: Task[],
    nodes: TaskNode[],
    options: Partial<ViewportCalculationOptions> = {}
  ): Viewport {
    const opts = { ...this.defaultOptions, ...options };
    
    // Filter nodes to include only those with valid positions
    const validNodes = nodes.filter(node => node.position && 
      tasks.some(task => task.id === node.data.task.id)
    );

    if (validNodes.length === 0) {
      return { x: 0, y: 0, zoom: 1 };
    }

    const bounds = this.calculateBoundingBox(validNodes);
    if (!bounds) {
      return { x: 0, y: 0, zoom: 1 };
    }

    const { width: viewportWidth, height: viewportHeight } = this.getViewportDimensions();
    
    const contentWidth = bounds.maxX - bounds.minX + opts.padding! * 2;
    const contentHeight = bounds.maxY - bounds.minY + opts.padding! * 2;
    
    const scaleX = viewportWidth / contentWidth;
    const scaleY = viewportHeight / contentHeight;
    const zoom = Math.min(scaleX, scaleY, opts.maxZoom!);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    return {
      x: viewportWidth / 2 - centerX * zoom,
      y: viewportHeight / 2 - centerY * zoom,
      zoom
    };
  }

  /**
   * Find tasks related to the active task (dependencies and dependents)
   */
  private findRelatedTasks(activeTask: Task, allTasks: Task[]): Task[] {
    const related: Task[] = [];

    // Add direct dependencies
    activeTask.dependencies.forEach(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      if (depTask) related.push(depTask);
    });

    // Add tasks that depend on this task
    allTasks.forEach(task => {
      if (task.dependencies.includes(activeTask.id) && task.id !== activeTask.id) {
        related.push(task);
      }
    });

    // Add subtasks of related tasks for context
    related.forEach(task => {
      if (task.subtasks.some(st => st.status === 'in-progress' || st.status === 'pending')) {
        // Task with active subtasks is more relevant
      }
    });

    return related;
  }

  /**
   * Calculate bounding box for a set of nodes
   */
  private calculateBoundingBox(nodes: TaskNode[]): { minX: number; maxX: number; minY: number; maxY: number } | null {
    if (nodes.length === 0) return null;

    const positions = nodes
      .map(node => node.position)
      .filter(pos => pos !== undefined) as { x: number; y: number }[];

    if (positions.length === 0) return null;

    return {
      minX: Math.min(...positions.map(p => p.x)),
      maxX: Math.max(...positions.map(p => p.x)),
      minY: Math.min(...positions.map(p => p.y)),
      maxY: Math.max(...positions.map(p => p.y))
    };
  }

  /**
   * Get current viewport dimensions
   */
  private getViewportDimensions(): { width: number; height: number } {
    if (typeof window !== 'undefined') {
      return {
        width: window.innerWidth,
        height: window.innerHeight
      };
    }
    return { width: 1200, height: 800 };
  }

  /**
   * Determine if transition should be animated based on distance
   */
  shouldAnimateTransition(from: Viewport, to: Viewport): boolean {
    const positionDiff = Math.sqrt(
      Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)
    );
    const zoomDiff = Math.abs(to.zoom - from.zoom);
    
    // Animate if the change is significant
    return positionDiff > 50 || zoomDiff > 0.1;
  }
}

/**
 * Camera Controller for smooth viewport transitions
 */
export class CameraController {
  private activeTransition: number | null = null;
  private reactFlowInstance: any = null;

  /**
   * Set the ReactFlow instance for camera control
   */
  setReactFlowInstance(instance: any): void {
    this.reactFlowInstance = instance;
  }

  /**
   * Smoothly transition the viewport to target position
   */
  transitionToViewport(
    targetViewport: Viewport,
    duration: number = 1000,
    easing: string = 'ease-out'
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.reactFlowInstance) {
        console.warn('ReactFlow instance not set');
        resolve();
        return;
      }

      // Cancel any existing transition
      if (this.activeTransition) {
        cancelAnimationFrame(this.activeTransition);
      }

      const startTime = performance.now();
      const startViewport = this.reactFlowInstance.getViewport();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Apply easing function
        const easedProgress = this.applyEasing(progress, easing);

        // Interpolate viewport values
        const currentViewport = {
          x: startViewport.x + (targetViewport.x - startViewport.x) * easedProgress,
          y: startViewport.y + (targetViewport.y - startViewport.y) * easedProgress,
          zoom: startViewport.zoom + (targetViewport.zoom - startViewport.zoom) * easedProgress
        };

        this.reactFlowInstance.setViewport(currentViewport);

        if (progress < 1) {
          this.activeTransition = requestAnimationFrame(animate);
        } else {
          this.activeTransition = null;
          resolve();
        }
      };

      this.activeTransition = requestAnimationFrame(animate);
    });
  }

  /**
   * Apply easing function to animation progress
   */
  private applyEasing(progress: number, easing: string): number {
    switch (easing) {
      case 'ease-out':
        return 1 - Math.pow(1 - progress, 3);
      case 'ease-in':
        return Math.pow(progress, 3);
      case 'ease-in-out':
        return progress < 0.5
          ? 4 * Math.pow(progress, 3)
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      default:
        return progress;
    }
  }

  /**
   * Cancel any active transitions
   */
  cancelTransition(): void {
    if (this.activeTransition) {
      cancelAnimationFrame(this.activeTransition);
      this.activeTransition = null;
    }
  }
}

/**
 * Task Status Manager to track active task changes
 */
export class TaskStatusManager {
  private subscribers: Array<(activeTask: Task | null, previousTask: Task | null) => void> = [];
  private currentActiveTask: Task | null = null;

  /**
   * Update the current active task and notify subscribers
   */
  updateActiveTask(tasks: Task[]): void {
    const previousTask = this.currentActiveTask;
    
    // Find the current active task
    const activeTask = tasks.find(task => 
      task.status === 'in-progress' || 
      task.subtasks.some(subtask => subtask.status === 'in-progress')
    ) || null;

    // Only notify if the active task actually changed
    if (activeTask?.id !== previousTask?.id) {
      this.currentActiveTask = activeTask;
      
      // Notify all subscribers
      this.subscribers.forEach(callback => {
        callback(activeTask, previousTask);
      });
    }
  }

  /**
   * Subscribe to active task changes
   */
  subscribe(callback: (activeTask: Task | null, previousTask: Task | null) => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Get the current active task
   */
  getCurrentActiveTask(): Task | null {
    return this.currentActiveTask;
  }
}
