import React, { useState } from 'react';
import { 
  FolderOpen, 
  Plus, 
  Download, 
  ExternalLink, 
  AlertCircle,
  Book,
  Lightbulb,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

interface NoTasksFoundProps {
  onSelectFolder: () => void;
  onRefresh?: () => void;
  projectPath?: string | null;
}

export const NoTasksFound: React.FC<NoTasksFoundProps> = ({ 
  onSelectFolder, 
  onRefresh,
  projectPath 
}) => {
  const { isDarkMode } = useTaskStore();
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleCreateSampleTasks = async () => {
    if (!projectPath) {
      alert('Please select a project folder first.');
      return;
    }

    try {
      const response = await fetch('/api/create-sample-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath })
      });

      if (response.ok) {
        onRefresh?.();
      } else {
        const error = await response.json();
        alert(`Failed to create sample tasks: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to create sample tasks:', error);
      alert('Failed to create sample tasks. Please try again.');
    }
  };

  const handleDownloadTemplate = () => {
    const template = {
      tasks: [
        {
          id: 1,
          title: "Project Setup",
          description: "Set up the basic project structure and dependencies",
          status: "done",
          priority: "high",
          dependencies: [],
          subtasks: [
            { id: 1, title: "Initialize repository", status: "done" },
            { id: 2, title: "Install dependencies", status: "done" },
            { id: 3, title: "Configure build tools", status: "done" }
          ]
        },
        {
          id: 2,
          title: "User Interface Development",
          description: "Design and implement the main user interface components",
          status: "in-progress",
          priority: "high",
          dependencies: [1],
          subtasks: [
            { id: 1, title: "Create wireframes", status: "done" },
            { id: 2, title: "Implement layout components", status: "in-progress" },
            { id: 3, title: "Add styling and themes", status: "pending" }
          ]
        },
        {
          id: 3,
          title: "Backend API Development",
          description: "Develop the server-side API endpoints and database integration",
          status: "pending",
          priority: "medium",
          dependencies: [1],
          subtasks: [
            { id: 1, title: "Design database schema", status: "pending" },
            { id: 2, title: "Implement API routes", status: "pending" },
            { id: 3, title: "Add authentication", status: "pending" }
          ]
        },
        {
          id: 4,
          title: "Testing and Quality Assurance",
          description: "Comprehensive testing of all application features",
          status: "pending",
          priority: "medium",
          dependencies: [2, 3],
          subtasks: [
            { id: 1, title: "Unit tests", status: "pending" },
            { id: 2, title: "Integration tests", status: "pending" },
            { id: 3, title: "User acceptance testing", status: "pending" }
          ]
        }
      ]
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tasks.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      alert('Please enter your feedback before submitting.');
      return;
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          feedback: feedbackText,
          context: 'no-tasks-found',
          projectPath,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setFeedbackSubmitted(true);
        setTimeout(() => {
          setShowFeedback(false);
          setFeedbackSubmitted(false);
          setFeedbackText('');
        }, 2000);
      } else {
        console.error('Failed to submit feedback');
        alert('Failed to submit feedback. Please try again later.');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again later.');
    }
  };

  return (
    <div className={`h-full w-full flex items-center justify-center p-8 ${
      isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Main Icon and Title */}
        <div className="space-y-4">
          <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${
            isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-600'
          }`}>
            <AlertCircle className="w-10 h-10" />
          </div>
          
          <h2 className="text-3xl font-bold">
            No Tasks Found
          </h2>
          
          <p className={`text-lg ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {projectPath 
              ? `We couldn't find any tasks in the selected project folder.`
              : 'Please select a project folder to get started with task visualization.'
            }
          </p>
        </div>

        {/* Project Path Display */}
        {projectPath && (
          <div className={`p-4 rounded-lg ${
            isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}>
            <p className={`text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Selected project:
            </p>
            <p className="font-mono text-sm mt-1 break-all">
              {projectPath}
            </p>
          </div>
        )}

        {/* Setup Instructions */}
        <div className={`text-left p-6 rounded-lg ${
          isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        }`}>
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            How to Set Up Tasks
          </h3>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
              }`}>
                1
              </div>
              <div>
                <p className="font-medium">Create a tasks directory</p>
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  In your project root, create a folder named <code className={`px-1 rounded ${
                    isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
                  }`}>tasks</code>
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
              }`}>
                2
              </div>
              <div>
                <p className="font-medium">Add your tasks</p>
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Create a <code className={`px-1 rounded ${
                    isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
                  }`}>tasks.json</code> file or individual task files (task_*.txt, task_*.md)
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
              }`}>
                3
              </div>
              <div>
                <p className="font-medium">Refresh or reload</p>
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Click the refresh button or reload the project to see your tasks
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={onSelectFolder}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <FolderOpen className="w-5 h-5" />
            {projectPath ? 'Select Different Folder' : 'Select Project Folder'}
          </button>
          
          {projectPath && (
            <button
              onClick={handleCreateSampleTasks}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Plus className="w-5 h-5" />
              Create Sample Tasks
            </button>
          )}
        </div>

        {/* Additional Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleDownloadTemplate}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
          
          <button
            onClick={() => window.open('https://github.com/your-username/taskmaster-visualizer#readme', '_blank')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Book className="w-4 h-4" />
            View README
            <ExternalLink className="w-3 h-3" />
          </button>
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          )}
        </div>

        {/* Feedback Section */}
        <div className="pt-4">
          {!showFeedback ? (
            <button
              onClick={() => setShowFeedback(true)}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800' 
                  : 'text-gray-500 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Having trouble? Send feedback
            </button>
          ) : (
            <div className={`p-4 rounded-lg border ${
              isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              {feedbackSubmitted ? (
                <div className="text-center">
                  <p className={`text-green-600 ${isDarkMode ? 'text-green-400' : ''}`}>
                    ✓ Thank you for your feedback!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    Help us improve by describing the issue you encountered:
                  </p>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Describe what you were trying to do and what went wrong..."
                    className={`w-full h-20 px-3 py-2 text-sm rounded border resize-none ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowFeedback(false);
                        setFeedbackText('');
                      }}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        isDarkMode 
                          ? 'text-gray-400 hover:text-gray-300' 
                          : 'text-gray-500 hover:text-gray-600'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitFeedback}
                      className={`px-3 py-1 text-sm rounded text-white transition-colors ${
                        isDarkMode 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                    >
                      Send Feedback
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

