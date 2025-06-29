import { useState, useEffect, useRef, KeyboardEvent } from 'react';
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
  const { isDarkMode, clearError } = useTaskStore();
  const [currentPath, setCurrentPath] = useState<string>('/home');
  const [inputPath, setInputPath] = useState<string>('/home');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drives, setDrives] = useState<FileItem[]>([]);
  const [completionSuggestions, setCompletionSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load system drives on component mount and set home directory when available
  useEffect(() => {
    if (isOpen) {
      // Clear any existing global errors when opening the file browser
      clearError();
      loadDrives();
      // Focus the input when the dialog opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, clearError]);

  // Initialize with home directory if we don't have drives yet
  useEffect(() => {
    if (isOpen && drives.length === 0) {
      // Try to get home directory from server
      const initializeWithHome = async () => {
        try {
          const response = await fetch('/api/drives');
          if (response.ok) {
            const data = await response.json();
            if (data.homeDirectory && currentPath === '/home') {
              setCurrentPath(data.homeDirectory);
              setInputPath(data.homeDirectory);
              await loadDirectory(data.homeDirectory);
            }
          }
        } catch (error) {
          console.warn('Failed to get home directory for initialization:', error);
        }
      };
      initializeWithHome();
    }
  }, [isOpen, drives.length, currentPath]);

  // Update input path when current path changes
  useEffect(() => {
    setInputPath(currentPath);
  }, [currentPath]);

  // Helper function to parse errors from fetch responses
  const parseFetchError = async (response: Response, defaultMessage: string): Promise<string> => {
    let errorMsg = defaultMessage;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = errorData.error;
      } else {
        errorMsg = `Error ${response.status}: ${response.statusText || defaultMessage}`;
      }
    } catch (jsonParseError) {
      try {
        const textError = await response.text();
        errorMsg = `Server error ${response.status}: ${textError.substring(0, 100)}${textError.length > 100 ? '...' : ''}`;
      } catch (textParseError) {
        errorMsg = `${defaultMessage} (Status: ${response.status})`;
      }
    }
    return errorMsg;
  };

  const loadDrives = async () => {
    setLoading(true);
    // Don't clear error immediately, only on success or new loadDirectory attempt
    try {
      setError(null);
      setLoading(true);
      
      const response = await fetch('/api/drives');
      if (!response.ok) {
        const errorMsg = await parseFetchError(response, 'Failed to load system drives');
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setDrives(data.drives || []);
      setError(null); // Clear error on successful drive load
      
      // Set initial path to home directory if available
      if (data.homeDirectory) {
        setCurrentPath(data.homeDirectory);
        setInputPath(data.homeDirectory);
        await loadDirectory(data.homeDirectory);
      } else if (data.drives && data.drives.length > 0) {
        const defaultPath = data.drives[0].path;
        setCurrentPath(defaultPath);
        setInputPath(defaultPath);
        await loadDirectory(defaultPath);
      } else {
        // If no drives, maybe load root or a default, or show a message.
        // For now, if loadDirectory isn't called, ensure loading is false.
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load drives:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred while loading drives');
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
      setInputPath(data.currentPath);
      setItems(data.items);
      setError(null); // Clear error only on successful directory load
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
      const pathToSelect = inputPath.trim();
      
      if (!pathToSelect || pathToSelect.length === 0) {
        setError('Cannot select empty path');
        return;
      }
      
      // Basic path validation before selecting
      if (pathToSelect.includes('..')) {
        setError('Invalid path: contains directory traversal attempts');
        return;
      }
      
      // Check if the path might cause issues with watch mode
      const normalizedPath = pathToSelect.toLowerCase().replace(/\\/g, '/');
      if (normalizedPath === '/users' || 
          normalizedPath === '/users/' ||
          normalizedPath === '/users/jason' ||
          normalizedPath === '/users/jason/' ||
          normalizedPath.includes('/ai/tmvisuals') ||
          normalizedPath === '/' ||
          normalizedPath === '/home' ||
          normalizedPath === '/home/') {
        setError('Cannot select this directory: Please select a specific project folder, not a system directory or the application directory itself.');
        return;
      }
      
      onSelectPath(pathToSelect);
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

  // Tab completion logic
  const getCompletions = async (partialPath: string): Promise<string[]> => {
    try {
      const separator = partialPath.includes('\\') ? '\\' : '/';
      const lastSeparatorIndex = partialPath.lastIndexOf(separator);
      
      let dirPath: string;
      let prefix: string;
      
      if (lastSeparatorIndex === -1) {
        // No separator, use current directory
        dirPath = currentPath;
        prefix = partialPath;
      } else {
        dirPath = partialPath.substring(0, lastSeparatorIndex) || separator;
        prefix = partialPath.substring(lastSeparatorIndex + 1);
      }
      
      // Fetch directory contents
      const response = await fetch(`/api/browse?dir=${encodeURIComponent(dirPath)}`);
      if (!response.ok) {
        return [];
      }
      
      const data: BrowseResponse = await response.json();
      
      // Filter directories that start with the prefix
      const suggestions = data.items
        .filter(item => item.isDirectory && item.name.toLowerCase().startsWith(prefix.toLowerCase()))
        .map(item => {
          // Return the full path
          if (lastSeparatorIndex === -1) {
            return item.path;
          } else {
            return partialPath.substring(0, lastSeparatorIndex + 1) + item.name;
          }
        });
      
      return suggestions;
    } catch (error) {
      console.error('Failed to get completions:', error);
      return [];
    }
  };

  const handleInputKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      if (showSuggestions && completionSuggestions.length > 0) {
        // Cycle through suggestions
        const nextIndex = (selectedSuggestionIndex + 1) % completionSuggestions.length;
        setSelectedSuggestionIndex(nextIndex);
        setInputPath(completionSuggestions[nextIndex]);
      } else {
        // Get new suggestions
        const suggestions = await getCompletions(inputPath);
        if (suggestions.length > 0) {
          setCompletionSuggestions(suggestions);
          setShowSuggestions(true);
          setSelectedSuggestionIndex(0);
          setInputPath(suggestions[0]);
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setShowSuggestions(false);
      
      // Try to load the directory
      const pathToLoad = inputPath.trim();
      if (pathToLoad) {
        await loadDirectory(pathToLoad);
      }
    } else if (e.key === 'Escape') {
      if (showSuggestions) {
        setShowSuggestions(false);
        setCompletionSuggestions([]);
        setSelectedSuggestionIndex(-1);
      } else {
        // Reset to current path
        setInputPath(currentPath);
      }
    } else {
      // Reset suggestions on any other key
      setShowSuggestions(false);
      setCompletionSuggestions([]);
      setSelectedSuggestionIndex(-1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPath(e.target.value);
    setShowSuggestions(false);
    setCompletionSuggestions([]);
    setSelectedSuggestionIndex(-1);
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
            <br />
            <span className={`text-xs mt-1 ${
              isDarkMode ? 'text-blue-400' : 'text-blue-600'
            }`}>
              Tip: Use Tab for auto-completion, Enter to navigate to a directory
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
            
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputPath}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                className={`w-full px-3 py-2 rounded-lg text-sm font-mono outline-none ${
                  isDarkMode 
                    ? 'bg-gray-700 text-gray-200 focus:ring-2 focus:ring-blue-500' 
                    : 'bg-gray-100 text-gray-800 focus:ring-2 focus:ring-blue-400'
                }`}
                placeholder="Type a path or use Tab for completion"
              />
              {showSuggestions && completionSuggestions.length > 0 && (
                <div className={`absolute top-full mt-1 left-0 right-0 rounded-lg shadow-lg overflow-hidden z-10 ${
                  isDarkMode ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-200'
                }`}>
                  <div className={`px-3 py-1 text-xs ${
                    isDarkMode ? 'text-gray-400 bg-gray-800' : 'text-gray-500 bg-gray-50'
                  }`}>
                    Tab completion ({completionSuggestions.length} suggestion{completionSuggestions.length !== 1 ? 's' : ''})
                  </div>
                  {completionSuggestions.slice(0, 5).map((suggestion, index) => (
                    <div
                      key={suggestion}
                      className={`px-3 py-2 text-sm font-mono ${
                        index === selectedSuggestionIndex 
                          ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                          : isDarkMode ? 'text-gray-200' : 'text-gray-800'
                      }`}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
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
