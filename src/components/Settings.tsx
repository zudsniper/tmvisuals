import React, { useState, useEffect } from 'react';
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
    updateForceLayout,
    clearAllStoredData,
    setProjectPath,
    projectPath
  } = useTaskStore();

  const [customPath, setCustomPath] = useState<string | null>(null);

  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  // Smart spacing configuration state
  const [smartSpacingConfig, setSmartSpacingConfig] = useState({
    enableSmartSpacing: true,
    prioritySpacingMultiplier: 1.3,
    clusterSpacing: 150,
    minNodeSeparation: 180,
    densityAdaptation: true,
    edgeBundling: false
  });

  // State for tracking smooth transitions
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTimeout, setTransitionTimeout] = useState<NodeJS.Timeout | null>(null);

  // Core physics parameters state
  const [physicsConfig, setPhysicsConfig] = useState({
    linkDistance: 200,
    linkStrength: 0.7,
    chargeStrength: -800,
    centerStrength: 0.1,
    collisionRadius: 160,
    collisionStrength: 0.8,
    alphaDecay: 0.0228,
    alphaMin: 0.001,
    velocityDecay: 0.4
  });

  // Graph size presets
  const graphSizePresets = {
    small: {
      linkDistance: 250,
      chargeStrength: -1200,
      alphaDecay: 0.0228,
      collisionRadius: 180
    },
    medium: {
      linkDistance: 200,
      chargeStrength: -800,
      alphaDecay: 0.05,
      collisionRadius: 160
    },
    large: {
      linkDistance: 150,
      chargeStrength: -400,
      alphaDecay: 0.1,
      collisionRadius: 120
    }
  };

  const handleSmartSpacingToggle = (key: keyof typeof smartSpacingConfig, value: boolean) => {
    const newConfig = { ...smartSpacingConfig, [key]: value };
    setSmartSpacingConfig(newConfig);
    updateForceLayout({ [key]: value });
  };

  const handleSmartSpacingSlider = (key: keyof typeof smartSpacingConfig, value: number) => {
    const newConfig = { ...smartSpacingConfig, [key]: value };
    setSmartSpacingConfig(newConfig);
    updateForceLayout({ [key]: value });
  };

  const handlePhysicsSlider = (key: keyof typeof physicsConfig, value: number) => {
    const newConfig = { ...physicsConfig, [key]: value };
    setPhysicsConfig(newConfig);
    
    // Provide visual feedback for smooth transitions
    setIsTransitioning(true);
    
    // Clear any existing timeout
    if (transitionTimeout) {
      clearTimeout(transitionTimeout);
    }
    
    // Update the force layout with smooth transition
    updateForceLayout({ [key]: value });
    
    // Reset transition state after animation completes
    const timeout = setTimeout(() => {
      setIsTransitioning(false);
    }, 600); // Slightly longer than the transition duration
    
    setTransitionTimeout(timeout);
  };

  const applyGraphSizePreset = (size: 'small' | 'medium' | 'large') => {
    const preset = graphSizePresets[size];
    const newConfig = { ...physicsConfig, ...preset };
    setPhysicsConfig(newConfig);
    
    // Provide visual feedback for preset application
    setIsTransitioning(true);
    
    // Clear any existing timeout
    if (transitionTimeout) {
      clearTimeout(transitionTimeout);
    }
    
    // Apply preset with smooth transition
    updateForceLayout(preset);
    
    // Reset transition state after animation completes
    const timeout = setTimeout(() => {
      setIsTransitioning(false);
    }, 600);
    
    setTransitionTimeout(timeout);
  };

  const handleClearData = () => {
    clearAllStoredData();
    setShowClearConfirmation(false);
    // Optionally close the settings modal after clearing
    onClose();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeout) {
        clearTimeout(transitionTimeout);
      }
    };
  }, [transitionTimeout]);

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`rounded-lg shadow-xl p-6 w-[500px] max-h-[80vh] overflow-y-auto ${
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
          {/* Default Editor section */}
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

          {/* Default Project Path section */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Startup Project Path
            </label>
            <input
              type="text"
              value={customPath || projectPath || ''}
              onChange={(e) => setCustomPath(e.target.value)}
              onBlur={() => {
                if (customPath !== null) {
                  setProjectPath(customPath);
                  // Save to default start path storage as well
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('taskmaster-default-start-path', customPath);
                  }
                }
              }}
              className={`text-sm p-2 rounded border ${
                isDarkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'
              } w-full`}
              placeholder="Enter default startup directory path"
            />
            <p className={`text-xs mt-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Change this to override the default startup directory.
            </p>
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

          {/* Layout Options section */}
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
                  disabled={layoutMode !== 'graph' && layoutMode !== 'force'}
                  className="mr-2"
                />
                <span className={`${
                  (layoutMode !== 'graph' && layoutMode !== 'force') 
                    ? (isDarkMode ? 'text-gray-500' : 'text-gray-400')
                    : (isDarkMode ? 'text-white' : 'text-gray-900')
                }`}>
                  Dynamic active task positioning (graph/force view only)
                </span>
              </label>
            </div>
            <p className={`text-xs mt-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              When enabled in graph or force view, the layout will reorganize around the currently active task, placing it in the center with related tasks nearby.
            </p>
          </div>

          {/* Smart Spacing Configuration section */}
          <div className={`pt-4 border-t ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <label className={`block text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Core Physics Parameters (Force Layout)
              </label>
              {isTransitioning && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className={`text-xs ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    Applying changes...
                  </span>
                </div>
              )}
            </div>
            
            {layoutMode !== 'force' && (
              <p className={`text-xs mb-3 px-3 py-2 rounded ${
                isDarkMode ? 'bg-yellow-900/20 text-yellow-200 border border-yellow-700' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              }`}>
                Physics parameters are available in Force layout mode only.
              </p>
            )}

            <div className="space-y-4">
              {/* Graph Size Presets */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Graph Size Presets
                </label>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => applyGraphSizePreset(size)}
                      disabled={layoutMode !== 'force'}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        layoutMode !== 'force' 
                          ? (isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400')
                          : (isDarkMode 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : 'bg-blue-500 hover:bg-blue-600 text-white')
                      }`}
                    >
                      {size === 'small' && '<100 nodes'}
                      {size === 'medium' && '100-500 nodes'}
                      {size === 'large' && '>500 nodes'}
                    </button>
                  ))}
                </div>
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Apply optimized settings for different graph sizes.
                </p>
              </div>

              {/* Link Distance */}
              <div className={layoutMode === 'force' ? '' : 'opacity-50'}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Link Distance: {physicsConfig.linkDistance}px
                </label>
                <input
                  type="range"
                  min="100"
                  max="400"
                  step="25"
                  value={physicsConfig.linkDistance}
                  onChange={(e) => handlePhysicsSlider('linkDistance', parseInt(e.target.value))}
                  disabled={layoutMode !== 'force'}
                  className={`w-full ${
                    isDarkMode ? 'accent-blue-500' : 'accent-blue-600'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Distance between connected nodes. Larger values spread the graph more.
                </p>
              </div>

              {/* Charge Strength (Node Repulsion) */}
              <div className={layoutMode === 'force' ? '' : 'opacity-50'}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Node Repulsion: {Math.abs(physicsConfig.chargeStrength)}
                </label>
                <input
                  type="range"
                  min="200"
                  max="2000"
                  step="100"
                  value={Math.abs(physicsConfig.chargeStrength)}
                  onChange={(e) => handlePhysicsSlider('chargeStrength', -parseInt(e.target.value))}
                  disabled={layoutMode !== 'force'}
                  className={`w-full ${
                    isDarkMode ? 'accent-blue-500' : 'accent-blue-600'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  How strongly nodes repel each other. Higher values spread nodes apart.
                </p>
              </div>

              {/* Link Strength */}
              <div className={layoutMode === 'force' ? '' : 'opacity-50'}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Link Strength: {physicsConfig.linkStrength.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={physicsConfig.linkStrength}
                  onChange={(e) => handlePhysicsSlider('linkStrength', parseFloat(e.target.value))}
                  disabled={layoutMode !== 'force'}
                  className={`w-full ${
                    isDarkMode ? 'accent-blue-500' : 'accent-blue-600'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Strength of connections between linked nodes. Higher values create tighter clusters.
                </p>
              </div>

              {/* Simulation Speed (Alpha Decay) */}
              <div className={layoutMode === 'force' ? '' : 'opacity-50'}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Simulation Speed: {(physicsConfig.alphaDecay * 1000).toFixed(1)}
                </label>
                <input
                  type="range"
                  min="10"
                  max="150"
                  step="5"
                  value={physicsConfig.alphaDecay * 1000}
                  onChange={(e) => handlePhysicsSlider('alphaDecay', parseInt(e.target.value) / 1000)}
                  disabled={layoutMode !== 'force'}
                  className={`w-full ${
                    isDarkMode ? 'accent-blue-500' : 'accent-blue-600'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  How quickly the simulation converges. Higher values reach stability faster.
                </p>
              </div>

              {/* Collision Radius */}
              <div className={layoutMode === 'force' ? '' : 'opacity-50'}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Collision Radius: {physicsConfig.collisionRadius}px
                </label>
                <input
                  type="range"
                  min="100"
                  max="250"
                  step="10"
                  value={physicsConfig.collisionRadius}
                  onChange={(e) => handlePhysicsSlider('collisionRadius', parseInt(e.target.value))}
                  disabled={layoutMode !== 'force'}
                  className={`w-full ${
                    isDarkMode ? 'accent-blue-500' : 'accent-blue-600'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Minimum space around each node to prevent overlap.
                </p>
              </div>
            </div>
          </div>

          {/* Smart Spacing Configuration section */}
          <div className={`pt-4 border-t ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <label className={`block text-sm font-medium mb-3 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Smart Spacing Configuration (Force Layout)
            </label>
            
            {layoutMode !== 'force' && (
              <p className={`text-xs mb-3 px-3 py-2 rounded ${
                isDarkMode ? 'bg-yellow-900/20 text-yellow-200 border border-yellow-700' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              }`}>
                Smart spacing features are available in Force layout mode only.
              </p>
            )}

            <div className="space-y-4">
              {/* Enable Smart Spacing */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={smartSpacingConfig.enableSmartSpacing}
                    onChange={(e) => handleSmartSpacingToggle('enableSmartSpacing', e.target.checked)}
                    disabled={layoutMode !== 'force'}
                    className="mr-2"
                  />
                  <span className={`${
                    layoutMode !== 'force' 
                      ? (isDarkMode ? 'text-gray-500' : 'text-gray-400')
                      : (isDarkMode ? 'text-white' : 'text-gray-900')
                  }`}>
                    Enable Smart Spacing Algorithms
                  </span>
                </label>
                <p className={`text-xs mt-1 ml-6 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Advanced spacing with variable collision radii, clustering, and density adaptation.
                </p>
              </div>

              {/* Priority Spacing Multiplier */}
              <div className={smartSpacingConfig.enableSmartSpacing && layoutMode === 'force' ? '' : 'opacity-50'}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Priority Spacing Multiplier: {smartSpacingConfig.prioritySpacingMultiplier.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="2.0"
                  step="0.1"
                  value={smartSpacingConfig.prioritySpacingMultiplier}
                  onChange={(e) => handleSmartSpacingSlider('prioritySpacingMultiplier', parseFloat(e.target.value))}
                  disabled={!smartSpacingConfig.enableSmartSpacing || layoutMode !== 'force'}
                  className={`w-full ${
                    isDarkMode ? 'accent-blue-500' : 'accent-blue-600'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Extra space allocation for high-priority tasks.
                </p>
              </div>

              {/* Cluster Spacing */}
              <div className={smartSpacingConfig.enableSmartSpacing && layoutMode === 'force' ? '' : 'opacity-50'}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Cluster Spacing: {smartSpacingConfig.clusterSpacing}px
                </label>
                <input
                  type="range"
                  min="100"
                  max="300"
                  step="25"
                  value={smartSpacingConfig.clusterSpacing}
                  onChange={(e) => handleSmartSpacingSlider('clusterSpacing', parseInt(e.target.value))}
                  disabled={!smartSpacingConfig.enableSmartSpacing || layoutMode !== 'force'}
                  className={`w-full ${
                    isDarkMode ? 'accent-blue-500' : 'accent-blue-600'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Distance between different task clusters.
                </p>
              </div>

              {/* Minimum Node Separation */}
              <div className={smartSpacingConfig.enableSmartSpacing && layoutMode === 'force' ? '' : 'opacity-50'}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Minimum Node Separation: {smartSpacingConfig.minNodeSeparation}px
                </label>
                <input
                  type="range"
                  min="120"
                  max="300"
                  step="20"
                  value={smartSpacingConfig.minNodeSeparation}
                  onChange={(e) => handleSmartSpacingSlider('minNodeSeparation', parseInt(e.target.value))}
                  disabled={!smartSpacingConfig.enableSmartSpacing || layoutMode !== 'force'}
                  className={`w-full ${
                    isDarkMode ? 'accent-blue-500' : 'accent-blue-600'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Minimum distance between any two task nodes.
                </p>
              </div>

              {/* Density Adaptation */}
              <div className={smartSpacingConfig.enableSmartSpacing && layoutMode === 'force' ? '' : 'opacity-50'}>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={smartSpacingConfig.densityAdaptation}
                    onChange={(e) => handleSmartSpacingToggle('densityAdaptation', e.target.checked)}
                    disabled={!smartSpacingConfig.enableSmartSpacing || layoutMode !== 'force'}
                    className="mr-2"
                  />
                  <span className={`${
                    (!smartSpacingConfig.enableSmartSpacing || layoutMode !== 'force')
                      ? (isDarkMode ? 'text-gray-500' : 'text-gray-400')
                      : (isDarkMode ? 'text-white' : 'text-gray-900')
                  }`}>
                    Adaptive Density Spacing
                  </span>
                </label>
                <p className={`text-xs mt-1 ml-6 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Automatically increase spacing in dense areas to prevent overcrowding.
                </p>
              </div>

              {/* Edge Bundling (Future Enhancement) */}
              <div className={smartSpacingConfig.enableSmartSpacing && layoutMode === 'force' ? 'opacity-50' : 'opacity-30'}>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={smartSpacingConfig.edgeBundling}
                    onChange={(e) => handleSmartSpacingToggle('edgeBundling', e.target.checked)}
                    disabled={true} // Always disabled for now
                    className="mr-2"
                  />
                  <span className={`${
                    isDarkMode ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    Edge Bundling (Coming Soon)
                  </span>
                </label>
                <p className={`text-xs mt-1 ml-6 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Bundle multiple edges between clusters for cleaner visualization.
                </p>
              </div>

              {/* Collision Detection Testing */}
              <div className={smartSpacingConfig.enableSmartSpacing && layoutMode === 'force' ? '' : 'opacity-50'}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Collision Detection Testing
                </label>
                <button
                  onClick={() => {
                    const forceLayout = (window as any).taskStore?.getState()?.forceLayout;
                    if (forceLayout && forceLayout.testCollisionDetection) {
                      const result = forceLayout.testCollisionDetection();
                      const report = forceLayout.generateCollisionReport();
                      console.log('=== Collision Detection Test Results ===');
                      console.log(`Test ${result.success ? 'PASSED' : 'FAILED'}`);
                      console.log(report);
                      alert(`Collision detection test ${result.success ? 'PASSED' : 'FAILED'}!\n\nCheck console for detailed report.\n\nSummary:\n- Nodes: ${result.details.totalNodes}\n- Violations: ${result.details.spacingMetrics.spacingViolations}\n- Min distance: ${result.details.spacingMetrics.minNodeDistance.toFixed(1)}px`);
                    } else {
                      alert('Force layout not available. Please switch to Force layout mode first.');
                    }
                  }}
                  disabled={!smartSpacingConfig.enableSmartSpacing || layoutMode !== 'force'}
                  className={`px-3 py-2 text-sm rounded font-medium transition-colors ${
                    (!smartSpacingConfig.enableSmartSpacing || layoutMode !== 'force')
                      ? (isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                      : (isDarkMode 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white')
                  }`}
                >
                  Test Collision System
                </button>
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Run comprehensive collision detection tests and view detailed report in console.
                </p>
              </div>
            </div>
          </div>

          {/* Storage Management section */}
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
                  Clear all stored data including project paths, custom positions, viewport settings, and preferences. Note: Tasks are stored in ".taskmaster/tasks/tasks.json"; legacy "tasks/tasks.json" projects are still supported but will be migrated in a future release. AI model configuration is loaded from ".taskmaster/config.json".
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

          {/* Existing bottom section */}
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
