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

export const TaskNode: React.FC<NodeProps<TaskNodeData>> = ({ data, id }) => {
  const { task, isCollapsed } = data;
  const { selectTask, toggleTaskCollapse, openInEditor } = useTaskStore();
  
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
  
  return (
    <div 
      className={`bg-white rounded-lg shadow-md p-4 min-w-[250px] max-w-[350px] border-2 ${priorityColors[task.priority]} cursor-pointer hover:shadow-lg transition-shadow`}
      onClick={handleNodeClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-500" />
      
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">          {statusIcons[task.status]}
          <span className="text-sm font-medium text-gray-500">#{task.id}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenInEditor}
            className="p-1 hover:bg-gray-100 rounded"
            title="Open in editor"
          >
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={handleCollapseToggle}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">{task.title}</h3>
      
      {!isCollapsed && (
        <>
          <p className="text-sm text-gray-600 line-clamp-3 mb-3">{task.description}</p>
          
          {task.subtasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-1">
                Subtasks: {task.subtasks.filter(st => st.status === 'done').length}/{task.subtasks.length}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(task.subtasks.filter(st => st.status === 'done').length / task.subtasks.length) * 100}%` }}
                />
              </div>
            </div>
          )}
          
          {task.dependencies.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Dependencies: {task.dependencies.join(', ')}
            </p>
          )}
        </>
      )}
      
      <Handle type="source" position={Position.Right} className="!bg-gray-500" />
    </div>
  );
};