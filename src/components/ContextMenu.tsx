import React, { useEffect, useRef } from 'react';
import { 
  Lock, 
  Unlock, 
  ArrowUp, 
  ArrowDown, 
  Copy, 
  Trash2, 
  Move3D,
  RotateCcw,
  ZoomIn,
  Grid3X3,
  FileImage,
  FileText
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

export const ContextMenu: React.FC = () => {
  const { 
    isDarkMode, 
    tasks, 
    contextMenu,
    hideContextMenu,
    toggleTaskLock,
    bringTaskToFront,
    sendTaskToBack,
    duplicateTask,
    deleteTask,
    resetLayout,
    fitAllNodes,
    centerViewport,
    toggleGrid,
    exportToPNG,
    exportToMermaid
  } = useTaskStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        hideContextMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideContextMenu();
      }
    };

    if (contextMenu.isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.isVisible, hideContextMenu]);

  if (!contextMenu.isVisible) return null;

  // Get the task if this is a node context menu
  const task = contextMenu.targetNodeId ? 
    tasks.find(t => `task-${t.id}` === contextMenu.targetNodeId) : 
    null;
  const isTaskLocked = task?.isLocked || false;

  const menuItems = !contextMenu.isBackgroundMenu && task ? [
    // Task-specific actions
    {
      icon: isTaskLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />,
      label: isTaskLocked ? 'Unlock Task' : 'Lock Task',
      action: () => toggleTaskLock(task.id),
      separator: false
    },
    {
      icon: <ArrowUp className="w-4 h-4" />,
      label: 'Bring to Front',
      action: () => bringTaskToFront(task.id),
      separator: false
    },
    {
      icon: <ArrowDown className="w-4 h-4" />,
      label: 'Send to Back',
      action: () => sendTaskToBack(task.id),
      separator: false
    },
    {
      icon: <Copy className="w-4 h-4" />,
      label: 'Duplicate Task',
      action: () => duplicateTask(task.id),
      separator: false
    },
    {
      icon: <Trash2 className="w-4 h-4" />,
      label: 'Delete Task',
      action: () => {
        if (confirm('Are you sure you want to delete this task?')) {
          deleteTask(task.id);
        }
      },
      separator: true,
      danger: true
    }
  ] : [
    // Background actions
    {
      icon: <RotateCcw className="w-4 h-4" />,
      label: 'Reset Layout',
      action: () => resetLayout(),
      separator: false
    },
    {
      icon: <Move3D className="w-4 h-4" />,
      label: 'Fit All Nodes',
      action: () => fitAllNodes(),
      separator: false
    },
    {
      icon: <ZoomIn className="w-4 h-4" />,
      label: 'Center Viewport',
      action: () => centerViewport(),
      separator: false
    },
    {
      icon: <Grid3X3 className="w-4 h-4" />,
      label: 'Toggle Grid',
      action: () => toggleGrid(),
      separator: true
    },
    {
      icon: <FileImage className="w-4 h-4" />,
      label: 'Export PNG (Full)',
      action: () => exportToPNG(true),
      separator: false
    },
    {
      icon: <FileImage className="w-4 h-4" />,
      label: 'Export PNG (Visible)',
      action: () => exportToPNG(false),
      separator: false
    },
    {
      icon: <FileText className="w-4 h-4" />,
      label: 'Export Mermaid.js',
      action: () => {
        const mermaidCode = exportToMermaid();
        navigator.clipboard.writeText(mermaidCode);
        alert('Mermaid code copied to clipboard!');
      },
      separator: false
    }
  ];

  // Calculate menu position to ensure it stays within viewport
  const calculatePosition = () => {
    if (!menuRef.current) return contextMenu.position;

    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = contextMenu.position;

    // Adjust horizontal position if menu would go off screen
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10;
    }
    if (x < 10) {
      x = 10;
    }

    // Adjust vertical position if menu would go off screen
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 10;
    }
    if (y < 10) {
      y = 10;
    }

    return { x, y };
  };

  const position = calculatePosition();

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 min-w-[200px] rounded-lg shadow-xl border transition-all duration-200 ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-600 text-white' 
          : 'bg-white border-gray-200 text-gray-900'
      }`}
      style={{
        left: position.x,
        top: position.y,
        transform: 'scale(1)',
        opacity: 1
      }}
    >
      <div className="py-2">
        {menuItems.map((item, index) => (
          <React.Fragment key={index}>
            <button
              onClick={() => {
                item.action();
                hideContextMenu();
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                item.danger
                  ? isDarkMode
                    ? 'hover:bg-red-900/50 text-red-400'
                    : 'hover:bg-red-50 text-red-600'
                  : isDarkMode
                    ? 'hover:bg-gray-700 text-gray-200'
                    : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
            {item.separator && index < menuItems.length - 1 && (
              <div className={`my-1 border-t ${
                isDarkMode ? 'border-gray-600' : 'border-gray-200'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
