# Force Layout Configuration API Documentation

The `ForceDirectedLayout` class provides a comprehensive API for configuring and controlling force-directed graph layouts. This documentation covers all available configuration options and API methods for consumers of the layout engine.

## Table of Contents

1. [Configuration Interface](#configuration-interface)
2. [Core API Methods](#core-api-methods)
3. [Performance & Monitoring](#performance--monitoring)
4. [Layout Control](#layout-control)
5. [Data Management](#data-management)
6. [Position Manipulation](#position-manipulation)
7. [Diagnostics & Testing](#diagnostics--testing)
8. [Usage Examples](#usage-examples)
9. [Best Practices](#best-practices)

## Configuration Interface

### ForceLayoutConfig

The main configuration object that controls all aspects of the force-directed layout:

```typescript
interface ForceLayoutConfig {
  // Simulation Parameters
  alphaDecay: number;              // Rate of cooling (0-1, default: 0.0228)
  alphaMin: number;                // Minimum alpha before stopping (0-1, default: 0.001)
  velocityDecay: number;           // Velocity damping (0-1, default: 0.4)
  
  // Force Strengths
  linkDistance: number;            // Target distance between connected nodes (default: 200)
  linkStrength: number;            // Strength of link constraints (0-1, default: 0.7)
  chargeStrength: number;          // Node repulsion force (negative values, default: -800)
  centerStrength: number;          // Attraction to layout center (0-1, default: 0.1)
  collisionRadius: number;         // Node collision radius (default: 160)
  collisionStrength: number;       // Collision force strength (0-1, default: 0.8)
  
  // Layout Dimensions
  width: number;                   // Layout width in pixels (default: 1400)
  height: number;                  // Layout height in pixels (default: 800)
  
  // Active Task Focus
  activeTaskId?: number | null;    // ID of currently focused task
  focusStrength?: number;          // Link strength multiplier around active task (default: 2)
  
  // Smart Spacing Parameters
  enableSmartSpacing?: boolean;           // Enable enhanced spacing algorithms (default: true)
  prioritySpacingMultiplier?: number;     // Extra space for high-priority tasks (default: 1.3)
  clusterSpacing?: number;                // Spacing between clusters (default: 150)
  minNodeSeparation?: number;             // Minimum distance between any nodes (default: 180)
  densityAdaptation?: boolean;            // Adapt spacing based on local density (default: true)
  edgeBundling?: boolean;                 // Bundle multiple edges (future enhancement)

  // Performance Options
  enablePerformanceMonitoring?: boolean;    // Enable performance tracking (default: true)
  useWebWorkers?: boolean;                  // Use Web Workers for calculations (default: true)
  maxFrameRate?: number;                    // Target FPS cap (default: 60)
  emergencyThrottleThreshold?: number;      // Node count for emergency throttling (default: 500)
  adaptiveQuality?: boolean;                // Reduce quality for performance (default: true)
  memoryUsageLimit?: number;                // Memory limit in MB (default: 200)
}
```

## Core API Methods

### Constructor

```typescript
constructor(config: ForceLayoutConfig)
```

Creates a new ForceDirectedLayout instance with the specified configuration.

### Configuration Management

#### `updateConfig(newConfig: Partial<ForceLayoutConfig>): void`

Updates the layout configuration with new parameters. Changes are applied immediately and the simulation continues with new settings.

```typescript
layout.updateConfig({
  chargeStrength: -1000,
  linkDistance: 250,
  collisionRadius: 180
});
```

#### `getConfig(): ForceLayoutConfig`

Returns a deep copy of the current configuration.

```typescript
const currentConfig = layout.getConfig();
console.log('Current charge strength:', currentConfig.chargeStrength);
```

#### `resetToDefaults(preserveData: boolean = false): void`

Resets configuration to default values. If `preserveData` is false, also clears current nodes and links.

```typescript
// Reset everything to defaults
layout.resetToDefaults();

// Reset config but keep current data
layout.resetToDefaults(true);
```

#### `exportConfig(includePerformanceMetrics: boolean = false): string`

Exports current configuration as a JSON string, optionally including performance metrics.

```typescript
const configJson = layout.exportConfig(true);
localStorage.setItem('layoutConfig', configJson);
```

#### `validateConfig(config: Partial<ForceLayoutConfig>): ValidationResult`

Validates configuration parameters and returns validation results.

```typescript
const validation = layout.validateConfig({
  alphaDecay: 1.5,  // Invalid: > 1
  linkDistance: -50 // Invalid: negative
});

if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
console.warn('Configuration warnings:', validation.warnings);
```

### Layout Transitions

#### `transitionToNewLayout(newConfig: Partial<ForceLayoutConfig>, duration: number = 500): void`

Smoothly transitions from current configuration to new configuration over specified duration.

```typescript
// Transition to new layout over 1 second
layout.transitionToNewLayout({
  chargeStrength: -1200,
  linkDistance: 300
}, 1000);
```

## Performance & Monitoring

### Performance Metrics

#### `getPerformanceMetrics(): PerformanceMetrics`

Returns comprehensive performance information:

```typescript
interface PerformanceMetrics {
  frameRate: number;              // Current FPS
  avgFrameTime: number;           // Average frame time in ms
  cpuUsage: number;               // CPU usage percentage
  memoryUsage: number;            // Memory usage in MB
  simulationSteps: number;        // Total simulation steps
  throttleLevel: number;          // Current throttling level (0-5)
  activeOptimizations: string[];  // List of active optimizations
  lastMeasurement: number;        // Timestamp of last measurement
}

const metrics = layout.getPerformanceMetrics();
console.log(`FPS: ${metrics.frameRate}, Memory: ${metrics.memoryUsage}MB`);
```

#### `optimizePerformance(): void`

Triggers performance optimization based on current conditions.

```typescript
layout.optimizePerformance();
```

### Large Dataset Optimization

#### `optimizeForLargeDataset(nodeCount: number): void`

Applies optimizations specifically for large datasets.

```typescript
// Optimize for 1000+ nodes
layout.optimizeForLargeDataset(1200);
```

## Layout Control

### Simulation Control

#### `start(): void`

Starts the force simulation.

```typescript
layout.start();
```

#### `stop(): void`

Stops the force simulation.

```typescript
layout.stop();
```

#### `restartSimulation(): void`

Restarts the simulation with current configuration. Useful for applying changes that require a fresh start.

```typescript
layout.restartSimulation();
```

#### `alpha(value?: number): number | void`

Gets or sets the simulation's alpha (cooling) value.

```typescript
// Get current alpha
const currentAlpha = layout.alpha();

// Set alpha to restart cooling
layout.alpha(1.0);
```

### Event Callbacks

#### `onTickUpdate(callback: (nodes: PhysicsNode[]) => void): void`

Sets callback for simulation tick updates.

```typescript
layout.onTickUpdate((nodes) => {
  // Update visualization
  updateNodePositions(nodes);
});
```

#### `onSimulationEnd(callback: (nodes: PhysicsNode[]) => void): void`

Sets callback for when simulation reaches equilibrium.

```typescript
layout.onSimulationEnd((nodes) => {
  console.log('Layout stabilized');
  saveLayout(nodes);
});
```

## Data Management

### Data Input

#### `setData(tasks: Task[], customPositions?: Map<string, {x: number, y: number}>): void`

Sets the tasks data for the layout. Optionally accepts custom initial positions.

```typescript
// Basic usage
layout.setData(tasks);

// With custom positions
const positions = new Map();
positions.set('task-1', { x: 100, y: 200 });
layout.setData(tasks, positions);
```

### Data Access

#### `getNodes(): PhysicsNode[]`

Returns current node data.

```typescript
const nodes = layout.getNodes();
console.log('Current node count:', nodes.length);
```

#### `getLinks(): PhysicsLink[]`

Returns current link data.

```typescript
const links = layout.getLinks();
console.log('Current link count:', links.length);
```

## Position Manipulation

### Fixed Positions

#### `setFixedPosition(nodeId: string, x: number, y: number): void`

Fixes a node at a specific position.

```typescript
// Pin important node at center
layout.setFixedPosition('important-task', 700, 400);
```

#### `releaseFixedPositions(): void`

Releases all fixed position constraints.

```typescript
layout.releaseFixedPositions();
```

## Diagnostics & Testing

### Collision Detection

#### `testCollisionDetection(): CollisionTestResult`

Tests the collision detection system and returns diagnostic information.

```typescript
interface CollisionTestResult {
  totalNodes: number;
  collisionPairs: Array<{
    nodeA: string;
    nodeB: string;
    distance: number;
    minDistance: number;
  }>;
  overlapCount: number;
  averageDistance: number;
  recommendations: string[];
}

const test = layout.testCollisionDetection();
if (test.overlapCount > 0) {
  console.warn(`Found ${test.overlapCount} overlapping nodes`);
}
```

### Comprehensive Analysis

#### `generateCollisionReport(): CollisionReport`

Generates a comprehensive analysis of layout spacing and performance.

```typescript
const report = layout.generateCollisionReport();
console.log('Layout quality:', report.performance.layoutQuality);
console.log('Spacing efficiency:', report.spacing.spacingEfficiency);
```

### Spacing Metrics

#### `getSpacingMetrics(): SpacingMetrics`

Returns detailed spacing analysis.

```typescript
const metrics = layout.getSpacingMetrics();
console.log('Average separation:', metrics.averageNodeSeparation);
```

## Usage Examples

### Basic Setup

```typescript
import { ForceDirectedLayout, DEFAULT_FORCE_CONFIG } from './forceLayout';

// Create layout with default configuration
const layout = new ForceDirectedLayout(DEFAULT_FORCE_CONFIG);

// Set up event handlers
layout.onTickUpdate((nodes) => {
  updateVisualization(nodes);
});

// Load data and start
layout.setData(tasks);
layout.start();
```

### Custom Configuration

```typescript
const customConfig = {
  ...DEFAULT_FORCE_CONFIG,
  chargeStrength: -1200,      // Stronger repulsion
  linkDistance: 300,          // Larger spacing
  collisionRadius: 200,       // Larger nodes
  enablePerformanceMonitoring: true
};

const layout = new ForceDirectedLayout(customConfig);
```

### Performance Monitoring

```typescript
// Monitor performance
setInterval(() => {
  const metrics = layout.getPerformanceMetrics();
  if (metrics.frameRate < 30) {
    console.warn('Low performance detected');
    layout.optimizePerformance();
  }
}, 5000);
```

### Dynamic Configuration

```typescript
// Adjust layout based on data size
const nodeCount = tasks.length;
if (nodeCount > 500) {
  layout.updateConfig({
    chargeStrength: -500,       // Reduce repulsion for large graphs
    enablePerformanceMonitoring: true,
    useWebWorkers: true
  });
}
```

### Layout Quality Assessment

```typescript
// Check layout quality after stabilization
layout.onSimulationEnd(() => {
  const report = layout.generateCollisionReport();
  
  if (report.performance.layoutQuality === 'poor') {
    console.warn('Poor layout quality detected');
    
    // Apply recommendations
    for (const rec of report.recommendations) {
      console.log('Recommendation:', rec);
    }
    
    // Try optimization
    layout.optimizePerformance();
    layout.restartSimulation();
  }
});
```

### Configuration Export/Import

```typescript
// Export configuration for later use
const configJson = layout.exportConfig(true);
localStorage.setItem('savedLayout', configJson);

// Validate before applying new configuration
const newConfig = { chargeStrength: -2000 };
const validation = layout.validateConfig(newConfig);

if (validation.valid) {
  layout.updateConfig(newConfig);
} else {
  console.error('Invalid configuration:', validation.errors);
}
```

## Best Practices

### Performance Optimization

1. **Large Datasets (500+ nodes):**
   - Enable `useWebWorkers: true`
   - Set `emergencyThrottleThreshold` appropriately
   - Monitor performance with `enablePerformanceMonitoring: true`

2. **Real-time Updates:**
   - Use `transitionToNewLayout()` for smooth changes
   - Validate configurations before applying
   - Monitor frame rate and optimize when needed

3. **Memory Management:**
   - Call `cleanup()` when disposing of layout
   - Set appropriate `memoryUsageLimit`
   - Monitor memory usage in performance metrics

### Configuration Guidelines

1. **Force Balance:**
   - `chargeStrength` should be negative for repulsion
   - `linkStrength` between 0.5-1.0 for stable layouts
   - `collisionRadius` should be larger than visual node size

2. **Spacing:**
   - `minNodeSeparation` should be at least `collisionRadius * 1.1`
   - Use `prioritySpacingMultiplier` to emphasize important nodes
   - Enable `densityAdaptation` for better distribution

3. **Simulation Tuning:**
   - Lower `alphaDecay` for slower cooling
   - Adjust `velocityDecay` to control damping
   - Use `focusStrength` to emphasize active elements

### Troubleshooting

1. **Overlapping Nodes:**
   - Increase `collisionRadius` or `collisionStrength`
   - Check with `testCollisionDetection()`
   - Consider `restartSimulation()`

2. **Poor Performance:**
   - Enable performance monitoring
   - Use `optimizeForLargeDataset()` for large graphs
   - Reduce `maxFrameRate` if needed

3. **Unstable Layout:**
   - Adjust `alphaDecay` and `velocityDecay`
   - Check force balance with diagnostics
   - Use `generateCollisionReport()` for analysis

## Default Configuration

The `DEFAULT_FORCE_CONFIG` provides a well-tested starting point:

```typescript
export const DEFAULT_FORCE_CONFIG: ForceLayoutConfig = {
  alphaDecay: 0.0228,
  alphaMin: 0.001,
  velocityDecay: 0.4,
  linkDistance: 200,
  linkStrength: 0.7,
  chargeStrength: -800,
  centerStrength: 0.1,
  collisionRadius: 160,
  collisionStrength: 0.8,
  width: 1400,
  height: 800,
  focusStrength: 2,
  enableSmartSpacing: true,
  prioritySpacingMultiplier: 1.3,
  clusterSpacing: 150,
  minNodeSeparation: 180,
  densityAdaptation: true,
  edgeBundling: false,
  enablePerformanceMonitoring: true,
  useWebWorkers: true,
  maxFrameRate: 60,
  emergencyThrottleThreshold: 500,
  adaptiveQuality: true,
  memoryUsageLimit: 200
};
```

This configuration has been optimized for typical task visualization scenarios with good performance and visual quality.
