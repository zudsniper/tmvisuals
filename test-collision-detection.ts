// Test file for validating collision detection system
import { ForceDirectedLayout, DEFAULT_FORCE_CONFIG } from '../src/utils/forceLayout';
import { Task } from '../src/types/task';

// Generate a dense graph for testing collision detection
function generateDenseTestGraph(nodeCount: number, connectionDensity: number = 0.3): Task[] {
  const tasks: Task[] = [];
  
  // Create nodes
  for (let i = 1; i <= nodeCount; i++) {
    tasks.push({
      id: i,
      title: `Task ${i}`,
      description: `Test task ${i} for collision detection`,
      details: 'Testing dense graph layout with collision detection',
      testStrategy: 'Verify no overlaps occur',
      priority: i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low',
      status: i % 5 === 0 ? 'in-progress' : i % 3 === 0 ? 'done' : 'pending',
      dependencies: [],
      subtasks: []
    });
  }
  
  // Add dense connections
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const numConnections = Math.floor(Math.random() * (nodeCount * connectionDensity));
    
    for (let j = 0; j < numConnections; j++) {
      const targetId = Math.floor(Math.random() * nodeCount) + 1;
      if (targetId !== task.id && !task.dependencies.includes(targetId)) {
        task.dependencies.push(targetId);
      }
    }
  }
  
  return tasks;
}

// Test collision detection system
function testCollisionDetection() {
  console.log('=== Testing Collision Detection System ===\n');
  
  const testCases = [
    { nodeCount: 50, density: 0.2, name: 'Medium density (50 nodes, 20% connections)' },
    { nodeCount: 100, density: 0.3, name: 'High density (100 nodes, 30% connections)' },
    { nodeCount: 200, density: 0.4, name: 'Very high density (200 nodes, 40% connections)' },
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test Case ${index + 1}: ${testCase.name} ---`);
    
    // Generate test data
    const tasks = generateDenseTestGraph(testCase.nodeCount, testCase.density);
    console.log(`Generated ${tasks.length} tasks with ${tasks.reduce((sum, t) => sum + t.dependencies.length, 0)} total connections`);
    
    // Create force layout with enhanced collision detection
    const config = {
      ...DEFAULT_FORCE_CONFIG,
      width: 1400,
      height: 800,
      enableSmartSpacing: true,
      densityAdaptation: true,
      minNodeSeparation: 180,
      collisionRadius: 160,
      collisionStrength: 0.8,
    };
    
    const layout = new ForceDirectedLayout(config);
    layout.optimizeForLargeDataset(tasks.length);
    layout.setData(tasks);
    
    // Run collision detection test
    const testResult = layout.testCollisionDetection();
    
    console.log(`Test Result: ${testResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Overlaps detected: ${testResult.details.overlapsDetected}`);
    console.log(`Overlaps resolved: ${testResult.details.overlapsResolved ? 'Yes' : 'No'}`);
    console.log(`Spacing violations: ${testResult.details.spacingMetrics.spacingViolations}`);
    console.log(`Average distance: ${testResult.details.spacingMetrics.averageNodeDistance.toFixed(2)}px`);
    console.log(`Min distance: ${testResult.details.spacingMetrics.minNodeDistance.toFixed(2)}px`);
    console.log(`Density score: ${(testResult.details.spacingMetrics.densityScore * 100).toFixed(2)}%`);
    console.log(`Performance - Detection: ${testResult.details.performance.detectionTime.toFixed(2)}ms, Resolution: ${testResult.details.performance.resolutionTime.toFixed(2)}ms`);
    
    // Generate full report
    console.log('\n--- Detailed Report ---');
    console.log(layout.generateCollisionReport());
    
    layout.cleanup();
  });
  
  console.log('\n=== Testing Complete ===');
}

// Export for running the test
if (typeof window === 'undefined') {
  // Node.js environment
  testCollisionDetection();
} else {
  // Browser environment - attach to window for manual testing
  (window as any).testCollisionDetection = testCollisionDetection;
  console.log('Collision detection test available as window.testCollisionDetection()');
}
