import React from 'react';
import { X } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { editorPreference, setEditorPreference, isDarkMode } = useTaskStore();

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`rounded-lg shadow-xl p-6 w-96 ${
        isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-xl font-bold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Default Editor
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="editor"
                  value="cursor"
                  checked={editorPreference === 'cursor'}
                  onChange={(e) => setEditorPreference(e.target.value as 'cursor' | 'vscode')}
                  className="mr-2"
                />
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                  Cursor
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="editor"
                  value="vscode"
                  checked={editorPreference === 'vscode'}
                  onChange={(e) => setEditorPreference(e.target.value as 'cursor' | 'vscode')}
                  className="mr-2"
                />
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                  Visual Studio Code
                </span>
              </label>
            </div>
          </div>

          <div className={`pt-4 border-t ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <p className={`text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              This preference will be used when opening task files in your editor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
