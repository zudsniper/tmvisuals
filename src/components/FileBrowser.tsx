import { useState, useEffect } from 'react';
import { Folder, File, HardDrive, ArrowLeft, Check, X } from 'lucide-react';

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
      const response = await fetch('/api/drives');
      const data = await response.json();
      setDrives(data.drives || []);
      
      // Set initial path based on platform
      if (data.drives && data.drives.length > 0) {
        const defaultPath = data.drives.find((d: FileItem) => d.path === '/Users') || data.drives[0];
        setCurrentPath(defaultPath.path);
        loadDirectory(defaultPath.path);
      }
    } catch (error) {
      console.error('Failed to load drives:', error);
      setError('Failed to load system drives');
    }
  };

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/browse?dir=${encodeURIComponent(path)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load directory');
      }
      
      const data: BrowseResponse = await response.json();
      setCurrentPath(data.currentPath);
      setItems(data.items);
    } catch (error) {
      console.error('Directory load error:', error);
      setError(error instanceof Error ? error.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: FileItem) => {
    if (item.isDirectory) {
      loadDirectory(item.path);
    }
  };

  const goToParent = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadDirectory(parentPath);
  };

  const handleSelectPath = () => {
    onSelectPath(currentPath);
    onClose();
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
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] m-4">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-gray-800">Select Project Root Directory</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Choose the root directory of your project. Tasks will be loaded from the <code className="bg-gray-100 px-1 rounded">tasks/</code> subdirectory.
            <br />
            <span className="text-xs text-gray-500">Example: Select <code>/Users/john/myproject</code> to load tasks from <code>/Users/john/myproject/tasks/</code></span>
          </p>
          
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={goToParent}
              disabled={currentPath === '/'}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            
            <div className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono">
              {currentPath}
            </div>
            
            <button
              onClick={handleSelectPath}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Select Project Root
            </button>
          </div>

          {/* System Drives */}
          {drives.length > 0 && (
            <div className="flex gap-2 mb-4">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <HardDrive className="w-4 h-4" />
                Quick Access:
              </span>
              {drives.map((drive) => (
                <button
                  key={drive.path}
                  onClick={() => loadDirectory(drive.path)}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  {drive.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-y-auto max-h-96">
          {loading && (
            <div className="p-8 text-center text-gray-500">
              Loading...
            </div>
          )}

          {error && (
            <div className="p-4 text-red-600 bg-red-50 m-4 rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="p-4">
              {items.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No accessible items in this directory
                </div>
              ) : (
                <div className="space-y-1">
                  {items.map((item) => (
                    <div
                      key={item.path}
                      onClick={() => handleItemClick(item)}
                      className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 ${
                        item.isDirectory ? 'cursor-pointer' : 'cursor-default opacity-60'
                      }`}
                    >
                      {item.isDirectory ? (
                        <Folder className="w-5 h-5 text-blue-500" />
                      ) : (
                        <File className="w-5 h-5 text-gray-400" />
                      )}
                      
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{item.name}</div>
                        <div className="text-sm text-gray-500">
                          {item.isDirectory ? 'Directory' : formatFileSize(item.size || 0)}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-400">
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
