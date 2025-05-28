import React from 'react';
import { X, Tag, AlertCircle, FileText, TestTube } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

export const TaskDetails: React.FC = () => {
  const { selectedTaskId, tasks, selectTask, updateTaskStatus, isDarkMode } = useTaskStore();
  
  const task = tasks.find(t => t.id === selectedTaskId);
  
  if (!task) return null;

  const statusOptions = ['pending', 'in-progress', 'done'] as const;

  return (
    <div className={`absolute right-0 top-0 h-full w-96 shadow-xl p-6 overflow-y-auto z-10 ${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Task #{task.id}
        </h2>
        <button
          onClick={() => selectTask(null)}
          className={`p-2 rounded ${
            isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
          }`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className={`text-lg font-semibold mb-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {task.title}
          </h3>
          <div className="flex items-center gap-2 mb-3">
            <Tag className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              task.priority === 'high' 
                ? isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-700'
                : task.priority === 'medium' 
                ? isDarkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-700'
                : isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}>
              {task.priority} priority
            </span>
          </div>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Status
          </label>
          <select
            value={task.status}
            onChange={(e) => updateTaskStatus(task.id, e.target.value as any)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}          </select>
        </div>

        <div>
          <h4 className={`text-sm font-medium mb-1 flex items-center gap-1 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <AlertCircle className="w-4 h-4" />
            Description
          </h4>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {task.description}
          </p>
        </div>

        <div>
          <h4 className={`text-sm font-medium mb-1 flex items-center gap-1 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <FileText className="w-4 h-4" />
            Details
          </h4>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {task.details}
          </p>
        </div>

        <div>
          <h4 className={`text-sm font-medium mb-1 flex items-center gap-1 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <TestTube className="w-4 h-4" />
            Test Strategy
          </h4>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {task.testStrategy}
          </p>
        </div>

        {task.dependencies.length > 0 && (
          <div>
            <h4 className={`text-sm font-medium mb-1 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Dependencies
            </h4>
            <div className="flex flex-wrap gap-2">
              {task.dependencies.map(dep => (
                <span 
                  key={dep} 
                  className={`px-2 py-1 rounded text-sm ${
                    isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Task #{dep}
                </span>
              ))}
            </div>
          </div>
        )}

        {task.subtasks.length > 0 && (
          <div>
            <h4 className={`text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Subtasks
            </h4>
            <div className="space-y-2">
              {task.subtasks.map(subtask => (
                <div 
                  key={subtask.id} 
                  className={`p-2 rounded ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      subtask.status === 'done' ? 'bg-green-500' :
                      subtask.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {subtask.title}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {subtask.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};