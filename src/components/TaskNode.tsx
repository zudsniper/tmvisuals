import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Task } from '../types/task';
import { CheckCircle, Circle, Clock, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
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

export const TaskNode: React.FC<NodeProps<TaskNodeData>> = ({ data, id }) => {
  const { task, isCollapsed } = data;
  const { selectTask, toggleTaskCollapse, openInEditor, layoutMode, isDarkMode } = useTaskStore();
  
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
        cursor-pointer hover:shadow-lg transition-shadow
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
          <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
            #{task.id}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenInEditor}
            className={`p-1 rounded ${
              isDarkMode 
                ? 'hover:bg-gray-700 text-gray-400' 
                : 'hover:bg-gray-100 text-gray-500'
            }`}
            title="Open in editor"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={handleCollapseToggle}
            className={`p-1 rounded ${
              isDarkMode 
                ? 'hover:bg-gray-700' 
                : 'hover:bg-gray-100'
            }`}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
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
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(task.subtasks.filter(st => st.status === 'done').length / task.subtasks.length) * 100}%` }}
                />
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