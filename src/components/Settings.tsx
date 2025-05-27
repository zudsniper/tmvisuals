import React from 'react';
import { X } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { editorPreference, setEditorPreference } = useTaskStore();

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <span>Cursor</span>
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
                <span>Visual Studio Code</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              This preference will be used when opening task files in your editor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
