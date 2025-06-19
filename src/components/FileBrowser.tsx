import { useState, useEffect } from 'react';
import { Folder, File, HardDrive, ArrowLeft, Check, X } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified: string;
}

interface BrowseResponse {
  currentPath: string;
  parent: string;
  items: FileItem[];
}

interface FileBrowserProps {
  onSelectPath: (path: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ onSelectPath, onClose, isOpen }) => {
  const { isDarkMode } = useTaskStore();
  const [currentPath, setCurrentPath] = useState<string>('/Users');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drives, setDrives] = useState<FileItem[]>([]);

  // Load system drives on component mount
  useEffect(() => {
    if (isOpen) {
      loadDrives();
    }
  }, [isOpen]);

  const loadDrives = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await fetch('/api/drives');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const data = await response.json();
      const drives = data.drives || [];
      
      if (drives.length === 0) {
        throw new Error('No accessible drives found on this system');
      }
      
      setDrives(drives);
      
      // Set initial path based on platform
      const defaultPath = drives.find((d: FileItem) => d.path === '/Users') || drives[0];
      if (defaultPath?.path) {
        setCurrentPath(defaultPath.path);
        await loadDirectory(defaultPath.path);
      }
    } catch (error) {
      console.error('Failed to load drives:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load system drives';
      setError(`Drive loading failed: ${errorMessage}`);
      
      // Set a fallback path for user navigation
      const fallbackPath = process.platform === 'win32' ? 'C:\\' : '/Users';
      setCurrentPath(fallbackPath);
    } finally {
      setLoading(false);
    }
  };

  const loadDirectory = async (path: string) => {
    // Validate path input
    if (!path || typeof path !== 'string') {
      setError('Invalid directory path provided');
      return;
    }
    
    const trimmedPath = path.trim();
    if (trimmedPath.length === 0) {
      setError('Directory path cannot be empty');
      return;
    }
    
    setLoading(true);
    setError(null);
    setItems([]); // Clear previous items while loading
    
    try {
      const response = await fetch(`/api/browse?dir=${encodeURIComponent(trimmedPath)}`);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Server returned an invalid response' };
        }
        
        const errorMessage = errorData.details || errorData.error || `HTTP ${response.status}: Failed to load directory`;
        
        // Provide user-friendly error messages based on error codes
        if (errorData.errorCode === 'ENOENT') {
          throw new Error(`Directory does not exist: ${trimmedPath}`);
        } else if (errorData.errorCode === 'EACCES') {
          throw new Error(`Permission denied: Cannot access ${trimmedPath}`);
        } else if (response.status === 400) {
          throw new Error(`Invalid path: ${errorMessage}`);
        } else if (response.status === 404) {
          throw new Error(`Directory not found: ${trimmedPath}`);
        } else {
          throw new Error(errorMessage);
        }
      }
      
      const data: BrowseResponse = await response.json();
      
      // Validate response data
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from server');
      }
      
      if (!data.currentPath) {
        throw new Error('Server response missing current path');
      }
      
      if (!Array.isArray(data.items)) {
        throw new Error('Server response missing items array');
      }
      
      setCurrentPath(data.currentPath);
      setItems(data.items);
      
    } catch (error) {
      console.error('Directory load error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred while loading directory';
      setError(errorMessage);
      
      // Provide actionable suggestions based on error type
      if (errorMessage.includes('Permission denied')) {
        setError(`${errorMessage}\n\nTry selecting a different directory or contact your system administrator.`);
      } else if (errorMessage.includes('does not exist')) {
        setError(`${errorMessage}\n\nThe directory may have been moved or deleted. Try navigating to a parent directory.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: FileItem) => {
    if (!item || !item.path) {
      setError('Invalid item selected');
      return;
    }
    
    if (item.isDirectory) {
      try {
        loadDirectory(item.path);
      } catch (error) {
        console.error('Failed to navigate to directory:', error);
        setError('Failed to navigate to the selected directory');
      }
    }
  };

  const goToParent = () => {
    try {
      if (!currentPath) {
        setError('Cannot navigate up: current path is not set');
        return;
      }
      
      // Handle different path separators based on platform
      const separator = currentPath.includes('\\') ? '\\' : '/';
      const pathParts = currentPath.split(separator);
      
      if (pathParts.length <= 1) {
        setError('Already at the root directory');
        return;
      }
      
      const parentPath = pathParts.slice(0, -1).join(separator) || separator;
      loadDirectory(parentPath);
    } catch (error) {
      console.error('Failed to navigate to parent directory:', error);
      setError('Failed to navigate to parent directory');
    }
  };

  const handleSelectPath = () => {
    try {
      if (!currentPath || currentPath.trim().length === 0) {
        setError('Cannot select empty path');
        return;
      }
      
      // Basic path validation before selecting
      if (currentPath.includes('..')) {
        setError('Invalid path: contains directory traversal attempts');
        return;
      }
      
      onSelectPath(currentPath.trim());
      onClose();
    } catch (error) {
      console.error('Failed to select path:', error);
      setError('Failed to select the current path');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] m-4 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className={`p-4 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-xl font-bold ${
              isDarkMode ? 'text-white' : 'text-gray-800'
            }`}>
              Select Project Root Directory
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <p className={`text-sm mb-4 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Choose the root directory of your project. Tasks will be loaded from the{' '}
            <code className={`px-1 rounded ${
              isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'
            }`}>
              tasks/
            </code>{' '}
            subdirectory.
            <br />
            <span className={`text-xs ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Example: Select <code>/Users/john/myproject</code> to load tasks from{' '}
              <code>/Users/john/myproject/tasks/</code>
            </span>
          </p>
          
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={goToParent}
              disabled={currentPath === '/'}
              className={`p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            
            <div className={`flex-1 px-3 py-2 rounded-lg text-sm font-mono ${
              isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'
            }`}>
              {currentPath}
            </div>
            
            <button
              onClick={handleSelectPath}
              className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                isDarkMode 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              <Check className="w-4 h-4" />
              Select Project Root
            </button>
          </div>

          {/* System Drives */}
          {drives.length > 0 && (
            <div className="flex gap-2 mb-4">
              <span className={`text-sm flex items-center gap-1 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <HardDrive className="w-4 h-4" />
                Quick Access:
              </span>
              {drives.map((drive) => (
                <button
                  key={drive.path}
                  onClick={() => loadDirectory(drive.path)}
                  className={`px-3 py-1 rounded text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  {drive.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-y-auto max-h-96">
          {loading && (
            <div className={`p-8 text-center ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Loading...
            </div>
          )}

          {error && (
            <div className={`p-4 m-4 rounded-lg ${
              isDarkMode 
                ? 'text-red-400 bg-red-900 bg-opacity-50' 
                : 'text-red-600 bg-red-50'
            }`}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="p-4">
              {items.length === 0 ? (
                <div className={`text-center py-8 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  No accessible items in this directory
                </div>
              ) : (
                <div className="space-y-1">
                  {items.map((item) => (
                    <div
                      key={item.path}
                      onClick={() => handleItemClick(item)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        isDarkMode 
                          ? 'hover:bg-gray-700' 
                          : 'hover:bg-gray-50'
                      } ${
                        item.isDirectory ? 'cursor-pointer' : 'cursor-default opacity-60'
                      }`}
                    >
                      {item.isDirectory ? (
                        <Folder className="w-5 h-5 text-blue-500" />
                      ) : (
                        <File className="w-5 h-5 text-gray-400" />
                      )}
                      
                      <div className="flex-1">
                        <div className={`font-medium ${
                          isDarkMode ? 'text-white' : 'text-gray-800'
                        }`}>
                          {item.name}
                        </div>
                        <div className={`text-sm ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {item.isDirectory ? 'Directory' : formatFileSize(item.size || 0)}
                        </div>
                      </div>
                      
                      <div className={`text-xs ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        {new Date(item.modified).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
