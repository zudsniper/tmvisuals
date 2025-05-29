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
  const { selectTask, toggleTaskCollapse, openInEditor, layoutMode, isDarkMode } = useTaskStore();
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const animationRef = useRef<number>();
  
  // Calculate progress from subtasks
  const actualProgress = task.subtasks.length > 0 
    ? (task.subtasks.filter(st => st.status === 'done').length / task.subtasks.length) * 100 
    : 0;

  // Check if this task is actively being worked on
  const isActivelyWorking = task.status === 'in-progress' || 
    task.subtasks.some(subtask => subtask.status === 'in-progress');
  
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
  
  return (
    <div 
      className={`
        ${isDarkMode 
          ? 'bg-gray-800 text-white border-gray-600' 
          : 'bg-white text-gray-800 border-gray-300'
        } 
        rounded-lg shadow-md p-4 min-w-[250px] max-w-[350px] border-2 
        ${priorityColorMap[task.priority]} 
        cursor-pointer hover:shadow-lg transition-all duration-200
        ${hasRecentActivity ? 'ring-2 ring-blue-400 ring-opacity-60 animate-pulse working-shimmer' : ''}
        ${isActivelyWorking ? 'shadow-lg shadow-blue-500/20 working-pulse' : ''}
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
          
          {/* Activity indicator for working tasks */}
          {hasRecentActivity && (
            <div className="flex items-center gap-1">
              <Activity className="w-4 h-4 text-blue-500 animate-bounce" />
              <span className="text-xs text-blue-500 font-medium">Working</span>
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
              <p className={`text-xs font-medium mb-1 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Subtasks: {task.subtasks.filter(st => st.status === 'done').length}/{task.subtasks.length}
              </p>
              <div className={`w-full rounded-full h-2 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ease-out ${
                    isActivelyWorking 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 progress-glow' 
                      : 'bg-blue-500'
                  } ${isActivelyWorking ? 'shadow-sm shadow-blue-500/50' : ''}`}
                  style={{ width: `${animatedProgress}%` }}
                >
                  {/* Working animation overlay */}
                  {isActivelyWorking && animatedProgress > 0 && (
                    <div className="h-full w-full bg-white bg-opacity-20 rounded-full animate-pulse" />
                  )}
                </div>
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
  );
};