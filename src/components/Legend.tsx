import React from 'react';
import { CheckCircle, Circle, Clock, Activity } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

export const Legend: React.FC = () => {
  const { isDarkMode } = useTaskStore();
  
  return (
    <div className={`absolute bottom-4 left-4 rounded-lg shadow-md p-4 z-10 ${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
    }`}>
      <h3 className={`text-sm font-semibold mb-2 ${
        isDarkMode ? 'text-white' : 'text-gray-900'
      }`}>
        Legend
      </h3>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Circle className="w-4 h-4 text-gray-400" />
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Pending
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            In Progress
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Done
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500 animate-bounce" />
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Recently Active
          </span>
        </div>
      </div>
      
      <div className={`mt-3 pt-3 border-t space-y-1 ${
        isDarkMode ? 'border-gray-600' : 'border-gray-200'
      }`}>
        <h4 className={`text-xs font-semibold mb-1 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          Dependencies (Graph Mode)
        </h4>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-500 rounded"></div>
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            To Active Task
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-green-500 rounded"></div>
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            From Active Task
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-green-500 rounded border-dashed border border-green-500"></div>
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Completed Dependency
          </span>
        </div>
      </div>
      
      <div className={`mt-3 pt-3 border-t space-y-1 ${
        isDarkMode ? 'border-gray-600' : 'border-gray-200'
      }`}>
        <h4 className={`text-xs font-semibold mb-1 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          Priority Borders
        </h4>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 border-2 rounded ${
            isDarkMode ? 'border-red-400' : 'border-red-500'
          }`}></div>
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            High Priority
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 border-2 rounded ${
            isDarkMode ? 'border-yellow-400' : 'border-yellow-500'
          }`}></div>
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Medium Priority
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 border-2 rounded ${
            isDarkMode ? 'border-gray-600' : 'border-gray-300'
          }`}></div>
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Low Priority
          </span>
        </div>
      </div>
    </div>
  );
};
