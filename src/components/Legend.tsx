import React from 'react';
import { CheckCircle, Circle, Clock } from 'lucide-react';

export const Legend: React.FC = () => {
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-4 z-10">
      <h3 className="text-sm font-semibold mb-2">Legend</h3>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Circle className="w-4 h-4 text-gray-400" />
          <span className="text-xs">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="text-xs">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-xs">Done</span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-red-500 rounded"></div>
          <span className="text-xs">High Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-yellow-500 rounded"></div>
          <span className="text-xs">Medium Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 rounded"></div>
          <span className="text-xs">Low Priority</span>
        </div>
      </div>
    </div>
  );
};
