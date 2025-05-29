import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Task } from '../types/task';
import { CheckCircle, Circle, Clock, ChevronDown, ChevronUp, ExternalLink, Activity } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

interface TaskNodeData {
  task: Task;
  isCollapsed: boolean;
}

const statusIcons = {
  'done': <CheckCircle className="w-5 h-5 text-green-500" />,
  'in-progress': <Clock className="w-5 h-5 text-blue-500" />,
  'pending': <Circle className="w-5 h-5 text-gray-400" />
};

const priorityColors = {
  'high': 'border-red-500',
  'medium': 'border-yellow-500',
  'low': 'border-gray-300'
};

// Dark mode variants
const priorityColorsDark = {
  'high': 'border-red-400',
  'medium': 'border-yellow-400',
  'low': 'border-gray-600'
};

export const TaskNode: React.FC<NodeProps<TaskNodeData>> = ({ data }) => {
  const { task, isCollapsed } = data;
  const { selectTask, toggleTaskCollapse, openInEditor, layoutMode, isDarkMode, focusOnActiveTask } = useTaskStore();
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [prevStatus, setPrevStatus] = useState(task.status);
  const [prevSubtaskStatuses, setPrevSubtaskStatuses] = useState(
    task.subtasks.map(st => st.status)
  );
  const [statusChangeAnimation, setStatusChangeAnimation] = useState(false);
  const [completionCelebration, setCompletionCelebration] = useState(false);
  const [subtaskCompletionAnimation, setSubtaskCompletionAnimation] = useState<string[]>([]);
  const animationRef = useRef<number>();
  
  // Calculate progress from subtasks
  const actualProgress = task.subtasks.length > 0 
    ? (task.subtasks.filter(st => st.status === 'done').length / task.subtasks.length) * 100 
    : 0;

  // Check if this task is actively being worked on
  const isActivelyWorking = task.status === 'in-progress' || 
    task.subtasks.some(subtask => subtask.status === 'in-progress');
  
  // Status change detection and animations
  useEffect(() => {
    // Main task status change
    if (prevStatus !== task.status) {
      setStatusChangeAnimation(true);
      
      // Special celebration for completion
      if (task.status === 'done' && prevStatus !== 'done') {
        setCompletionCelebration(true);
        setTimeout(() => setCompletionCelebration(false), 2000);
      }
      
      setTimeout(() => setStatusChangeAnimation(false), 1000);
      setPrevStatus(task.status);
    }

    // Subtask completion detection
    const currentSubtaskStatuses = task.subtasks.map(st => st.status);
    const newlyCompletedSubtasks: string[] = [];
    
    currentSubtaskStatuses.forEach((status, index) => {
      if (status === 'done' && prevSubtaskStatuses[index] !== 'done') {
        newlyCompletedSubtasks.push(task.subtasks[index].id);
      }
    });

    if (newlyCompletedSubtasks.length > 0) {
      setSubtaskCompletionAnimation(newlyCompletedSubtasks);
      setTimeout(() => setSubtaskCompletionAnimation([]), 1000);
    }

    setPrevSubtaskStatuses(currentSubtaskStatuses);
  }, [task.status, task.subtasks, prevStatus, prevSubtaskStatuses]);
  
  // Check if this task has recent activity (updated within last 10 minutes)
  const hasRecentActivity = useMemo(() => {
    if (!isActivelyWorking) return false;
    
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    
    // Check task's lastUpdated
    if (task.lastUpdated) {
      const taskUpdated = new Date(task.lastUpdated);
      if (taskUpdated > tenMinutesAgo) return true;
    }
    
    // Check subtasks' lastUpdated
    return task.subtasks.some(subtask => {
      if (subtask.status === 'in-progress' && subtask.lastUpdated) {
        const subtaskUpdated = new Date(subtask.lastUpdated);
        return subtaskUpdated > tenMinutesAgo;
      }
      return false;
    });
  }, [task.lastUpdated, task.subtasks, isActivelyWorking]);

  // Animate progress changes
  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    const startProgress = animatedProgress;
    const targetProgress = actualProgress;
    const startTime = performance.now();
    const duration = 800; // 800ms animation
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentProgress = startProgress + (targetProgress - startProgress) * easeOut;
      setAnimatedProgress(currentProgress);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [actualProgress]);

  const handleNodeClick = () => {
    selectTask(task.id);
  };

  const handleCollapseToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleTaskCollapse(task.id);
  };

  const handleOpenInEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    openInEditor(task.id);
  };

  const showHandles = layoutMode === 'graph';
  const priorityColorMap = isDarkMode ? priorityColorsDark : priorityColors;
  const isDoneTask = task.status === 'done';
  
  // Enhanced visual highlighting when focus is enabled
  const shouldHighlight = focusOnActiveTask && isActivelyWorking && !isDoneTask;
  
  return (
    <>
      <div 
        className={`
          ${isDarkMode 
            ? 'bg-gray-800 text-white border-gray-600' 
            : 'bg-white text-gray-800 border-gray-300'
          } 
          rounded-lg shadow-md p-4 min-w-[250px] max-w-[350px] border-2 
          ${priorityColorMap[task.priority]} 
          cursor-pointer hover:shadow-lg transition-all duration-300
          ${shouldHighlight ? 'shadow-2xl shadow-orange-500/50 ring-4 ring-orange-400/60 ring-offset-2 active-task-border-glow' : ''}
          ${isActivelyWorking && !shouldHighlight ? 'shadow-lg shadow-orange-500/30 ring-2 ring-orange-400/40' : ''}
          ${statusChangeAnimation ? 'animate-status-change' : ''}
          ${completionCelebration ? 'animate-completion-celebration' : ''}
        `}
        onClick={handleNodeClick}
    >
      {/* Only show connection handles in graph mode */}
      {showHandles && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className={`!w-3 !h-3 ${isDarkMode ? '!bg-gray-400' : '!bg-gray-500'}`} 
        />
      )}
      
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {statusIcons[task.status]}
          <span className={`text-sm font-medium ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            #{task.id}
          </span>
          
          {/* Enhanced activity indicator for working tasks */}
          {hasRecentActivity && (
            <div className="flex items-center gap-1 animate-pulse">
              <Activity className="w-4 h-4 text-orange-500 animate-bounce" />
              <span className="text-xs text-orange-500 font-bold">Live</span>
            </div>
          )}
          
          {/* Enhanced orange working indicator for active tasks without subtasks */}
          {isActivelyWorking && task.subtasks.length === 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-ping"></div>
              <span className="text-xs text-orange-500 font-bold tracking-wide">ACTIVE</span>
            </div>
          )}
          
          {/* Status change indicator */}
          {statusChangeAnimation && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
              <span className="text-xs text-blue-500 font-medium">Updated</span>
            </div>
          )}
          
          {/* Completion celebration indicator */}
          {completionCelebration && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
              <span className="text-xs text-green-500 font-bold">DONE!</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {task.subtasks.length > 0 && (
            <button
              onClick={handleCollapseToggle}
              className={`p-1 rounded hover:bg-opacity-20 ${
                isDarkMode ? 'hover:bg-white' : 'hover:bg-black'
              }`}
            >
              {isCollapsed ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronUp className="w-4 h-4" />
              }
            </button>
          )}
          
          <button
            onClick={handleOpenInEditor}
            className={`p-1 rounded hover:bg-opacity-20 ${
              isDarkMode ? 'hover:bg-white' : 'hover:bg-black'
            }`}
            title="Open in editor"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      <h3 className={`font-semibold mb-2 line-clamp-2 ${
        isDarkMode ? 'text-white' : 'text-gray-800'
      }`}>
        {task.title}
      </h3>
      
      {!isCollapsed && (
        <>
          <p className={`text-sm line-clamp-3 mb-3 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {task.description}
          </p>
          
          {task.subtasks.length > 0 && (
            <div className={`mt-3 pt-3 border-t ${
              isDarkMode ? 'border-gray-600' : 'border-gray-200'
            }`}>
              <p className={`text-xs font-medium mb-2 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Subtasks: {task.subtasks.filter(st => st.status === 'done').length}/{task.subtasks.length}
              </p>
              
              {/* Individual subtasks with clean styling */}
              <div className="space-y-1 mb-3">
                {task.subtasks.slice(0, isCollapsed ? 2 : task.subtasks.length).map((subtask) => (
                  <div 
                    key={subtask.id}
                    className={`flex items-center gap-2 text-xs py-1 px-2 rounded transition-all duration-300 ${
                      subtaskCompletionAnimation.includes(subtask.id) ? 'animate-subtask-complete' : ''
                    } ${
                      subtask.status === 'in-progress'
                        ? `${isDarkMode ? 'bg-orange-900/20 text-orange-300' : 'bg-orange-50 text-orange-700'}`
                        : `${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`
                    }`}
                  >
                    {subtask.status === 'done' ? (
                      <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                    ) : subtask.status === 'in-progress' ? (
                      <Clock className="w-3 h-3 text-orange-500 flex-shrink-0" />
                    ) : (
                      <Circle className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{subtask.title}</span>
                  </div>
                ))}
                {isCollapsed && task.subtasks.length > 2 && (
                  <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    +{task.subtasks.length - 2} more...
                  </p>
                )}
              </div>
              
              <div className={`w-full rounded-full h-2 relative overflow-hidden ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ease-out ${
                    isActivelyWorking 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600' 
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${animatedProgress}%` }}
                />
                
                {/* Sliding animation overlay for active tasks */}
                {isActivelyWorking && (
                  <div className="absolute top-0 left-0 h-full w-full overflow-hidden rounded-full">
                    <div className="h-full w-8 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-slide-right" />
                  </div>
                )}
              </div>
            </div>
          )}
          
          {task.dependencies.length > 0 && (
            <p className={`text-xs mt-2 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Dependencies: {task.dependencies.join(', ')}
            </p>
          )}
        </>
      )}
      
      {/* Only show connection handles in graph mode */}
      {showHandles && (
        <Handle 
          type="source" 
          position={Position.Right} 
          className={`!w-3 !h-3 ${isDarkMode ? '!bg-gray-400' : '!bg-gray-500'}`} 
        />
      )}
    </div>
    </>
  );
};