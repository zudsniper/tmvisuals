import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { 
    editorPreference, 
    setEditorPreference, 
    isDarkMode, 
    focusOnActiveTask, 
    setFocusOnActiveTask,
    dynamicLayout,
    setDynamicLayout,
    layoutMode,
    clearAllStoredData
  } = useTaskStore();

  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  const handleClearData = () => {
    clearAllStoredData();
    setShowClearConfirmation(false);
    // Optionally close the settings modal after clearing
    onClose();
  };

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

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Viewport Behavior
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={focusOnActiveTask}
                  onChange={(e) => setFocusOnActiveTask(e.target.checked)}
                  className="mr-2"
                />
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                  Focus on active task instead of remembering last position
                </span>
              </label>
            </div>
            <p className={`text-xs mt-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              When enabled, the view will automatically center on the selected task instead of returning to your last viewport position.
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Layout Options
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dynamicLayout}
                  onChange={(e) => setDynamicLayout(e.target.checked)}
                  disabled={layoutMode !== 'graph'}
                  className="mr-2"
                />
                <span className={`${
                  layoutMode !== 'graph' 
                    ? (isDarkMode ? 'text-gray-500' : 'text-gray-400')
                    : (isDarkMode ? 'text-white' : 'text-gray-900')
                }`}>
                  Dynamic active task positioning (graph view only)
                </span>
              </label>
            </div>
            <p className={`text-xs mt-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              When enabled in graph view, the layout will reorganize around the currently active task, placing it in the center with related tasks nearby.
            </p>
          </div>

          <div className={`pt-4 border-t ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <div className="space-y-4">
              <div>
                <h3 className={`text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Storage Management
                </h3>
                <p className={`text-xs mb-3 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Clear all stored data including project paths, custom positions, viewport settings, and preferences.
                </p>
                
                {!showClearConfirmation ? (
                  <button
                    onClick={() => setShowClearConfirmation(true)}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                      isDarkMode 
                        ? 'bg-red-900 hover:bg-red-800 text-red-200 border border-red-700' 
                        : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All Stored Data
                  </button>
                ) : (
                  <div className={`p-4 rounded border ${
                    isDarkMode 
                      ? 'bg-red-900/20 border-red-700' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <span className={`font-medium ${
                        isDarkMode ? 'text-red-200' : 'text-red-800'
                      }`}>
                        Clear all stored data?
                      </span>
                    </div>
                    
                    <p className={`text-sm mb-4 ${
                      isDarkMode ? 'text-red-200' : 'text-red-700'
                    }`}>
                      This will reset all preferences, positions, and settings. This action cannot be undone.
                    </p>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleClearData}
                        className={`px-4 py-2 text-sm rounded transition-colors ${
                          isDarkMode 
                            ? 'bg-red-600 hover:bg-red-700 text-white' 
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        OK, I understand
                      </button>
                      <button
                        onClick={() => setShowClearConfirmation(false)}
                        className={`px-4 py-2 text-sm rounded transition-colors ${
                          isDarkMode 
                            ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
