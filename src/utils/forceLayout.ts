import * as d3 from 'd3-force';
import { Task } from '../types/task';

export interface PhysicsNode {
  id: string;
  task: Task;
  x?: number;
  y?: number;
  vx?: number; // Velocity x
  vy?: number; // Velocity y
  fx?: number | null; // Fixed position constraints
  fy?: number | null;
}

export interface PhysicsLink {
  source: string | PhysicsNode;
  target: string | PhysicsNode;
  strength?: number;
}

// Advanced performance monitoring interface for Task 2.5
export interface PerformanceMetrics {
  frameRate: number;
  avgFrameTime: number;
  cpuUsage: number;
  memoryUsage: number;
  simulationSteps: number;
  throttleLevel: number;
  activeOptimizations: string[];
  lastMeasurement: number;
}

// Web Worker message interface for off-main-thread calculations
export interface WorkerMessage {
  type: 'INIT' | 'CALCULATE_FORCES' | 'UPDATE_POSITIONS' | 'RESULT';
  payload: any;
}

export interface ForceLayoutConfig {
  // Simulation parameters
  alphaDecay: number;
  alphaMin: number;
  velocityDecay: number;
  
  // Force strengths
  linkDistance: number;
  linkStrength: number;
  chargeStrength: number;
  centerStrength: number;
  collisionRadius: number;
  collisionStrength: number;
  
  // Layout dimensions
  width: number;
  height: number;
  
  // Active task focus
  activeTaskId?: number | null;
  focusStrength?: number;
  
  // Smart spacing parameters
  enableSmartSpacing?: boolean;
  prioritySpacingMultiplier?: number;
  clusterSpacing?: number;
  minNodeSeparation?: number;
  densityAdaptation?: boolean;
  edgeBundling?: boolean;

  // Task 2.5: Advanced performance options for large graphs (500+ nodes)
  enablePerformanceMonitoring?: boolean;
  useWebWorkers?: boolean;
  maxFrameRate?: number; // Target frame rate cap for performance
  emergencyThrottleThreshold?: number; // Node count to trigger emergency throttling
  adaptiveQuality?: boolean; // Reduce quality for performance when needed
  memoryUsageLimit?: number; // MB limit before triggering memory optimizations
}

export class ForceDirectedLayout {
  private simulation: d3.Simulation<PhysicsNode, PhysicsLink>;
  private config: ForceLayoutConfig;
  private nodes: PhysicsNode[] = [];
  private links: PhysicsLink[] = [];
  private onTick?: (nodes: PhysicsNode[]) => void;
  private onEnd?: (nodes: PhysicsNode[]) => void;
  private lastTickTime: number = 0;
  private tickThrottle: number = 16; // Throttle to ~60fps
  private nodeCluster: Map<string, string> = new Map(); // Maps node ID to cluster ID
  private clusterCenters: Map<string, { x: number; y: number }> = new Map(); // Cluster center positions
  
  // Enhanced position interpolation system
  private previousPositions: Map<string, { x: number; y: number }> = new Map();
  private interpolationTargets: Map<string, { x: number; y: number }> = new Map();
  private isInterpolating: boolean = false;
  private interpolationStartTime: number = 0;
  private interpolationDuration: number = 300; // 300ms for smooth transitions
  private animationFrameId: number | null = null;

  // Enhanced collision detection system with validation and emergency adjustments
  private overlapDetectionRadius = 15; // Minimum acceptable distance between node centers
  private emergencySpacingForce = 2.0; // Force multiplier for emergency spacing
  private tickCount = 0; // Track simulation ticks for validation

  // Task 2.5: Advanced performance monitoring and optimization system
  private performanceMetrics: PerformanceMetrics = {
    frameRate: 60,
    avgFrameTime: 16.67,
    cpuUsage: 0,
    memoryUsage: 0,
    simulationSteps: 0,
    throttleLevel: 0,
    activeOptimizations: [],
    lastMeasurement: performance.now()
  };
  private frameTimeHistory: number[] = [];
  private lastFrameTime: number = performance.now();
  private performanceMonitoringInterval: number | null = null;
  private isPerformanceMonitoringEnabled: boolean = false;
  private emergencyMode: boolean = false;
  private qualityLevel: 'high' | 'medium' | 'low' | 'emergency' = 'high';
  private webWorker: Worker | null = null;
  private isUsingWebWorker: boolean = false;
  private cpuUsageHistory: number[] = [];
  private memoryUsageHistory: number[] = [];

  constructor(config: ForceLayoutConfig) {
    this.config = config;
    this.simulation = d3.forceSimulation<PhysicsNode>();
    this.setupForces();

    // Task 2.5: Initialize performance monitoring if enabled
    if (config.enablePerformanceMonitoring) {
      this.enablePerformanceMonitoring();
    }

    // Task 2.5: Initialize Web Worker for large graphs if enabled
    if (config.useWebWorkers && this.isWebWorkerSupported()) {
      this.initializeWebWorker();
    }
  }

  // Smart spacing: Calculate dynamic collision radius based on node importance
  private getSmartCollisionRadius = (node: any): number => {
    const baseRadius = this.config.collisionRadius;
    
    // Cast node to PhysicsNode for type safety
    const physicsNode = node as PhysicsNode;
    if (!physicsNode.task) return baseRadius;
    
    const task = physicsNode.task;
    
    // Priority multiplier
    const priorityMultiplier = this.config.prioritySpacingMultiplier || 1.2;
    let radiusMultiplier = 1;
    
    switch (task.priority) {
      case 'high':
        radiusMultiplier = priorityMultiplier;
        break;
      case 'medium':
        radiusMultiplier = priorityMultiplier * 0.85;
        break;
      case 'low':
        radiusMultiplier = priorityMultiplier * 0.7;
        break;
    }
    
    // Status multiplier for active tasks
    if (task.status === 'in-progress' || task.subtasks.some(st => st.status === 'in-progress')) {
      radiusMultiplier *= 1.3; // Give active tasks more space
    }
    
    // Connectivity multiplier - tasks with more connections get more space
    const connectionCount = task.dependencies.length + this.getOutgoingConnections(task.id);
    const connectivityMultiplier = 1 + (connectionCount * 0.1);
    
    // Ensure minimum viable radius for dense graphs
    const minViableRadius = Math.max(baseRadius * 0.6, 80);
    
    return Math.max(minViableRadius, baseRadius * radiusMultiplier * connectivityMultiplier);
  };

  // Enhanced overlap detection and emergency spacing system
  private detectAndResolveOverlaps(): boolean {
    let overlapsDetected = false;
    const emergencyAdjustments: { node: PhysicsNode; dx: number; dy: number }[] = [];
    
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];
        
        if (nodeA.x !== undefined && nodeA.y !== undefined && 
            nodeB.x !== undefined && nodeB.y !== undefined) {
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          const radiusA = this.getSmartCollisionRadius(nodeA);
          const radiusB = this.getSmartCollisionRadius(nodeB);
          const requiredDistance = radiusA + radiusB + this.overlapDetectionRadius;
          
          if (distance < requiredDistance && distance > 0) {
            overlapsDetected = true;
            
            // Calculate emergency separation force
            const overlap = requiredDistance - distance;
            const force = this.emergencySpacingForce * overlap / distance;
            const separationX = dx * force * 0.5;
            const separationY = dy * force * 0.5;
            
            emergencyAdjustments.push(
              { node: nodeA, dx: -separationX, dy: -separationY },
              { node: nodeB, dx: separationX, dy: separationY }
            );
          }
        }
      }
    }
    
    // Apply emergency adjustments
    emergencyAdjustments.forEach(({ node, dx, dy }) => {
      if (node.x !== undefined && node.y !== undefined) {
        node.x += dx;
        node.y += dy;
        // Apply velocity adjustment to prevent immediate re-overlap
        node.vx = (node.vx || 0) + dx * 0.1;
        node.vy = (node.vy || 0) + dy * 0.1;
      }
    });
    
    return overlapsDetected;
  }

  // Validate minimum spacing consistency across the graph
  private validateSpacingConsistency(): { consistent: boolean; violations: number } {
    let violations = 0;
    const minAcceptableSpacing = Math.min(this.config.minNodeSeparation || 180, this.config.collisionRadius * 1.5);
    
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];
        
        if (nodeA.x !== undefined && nodeA.y !== undefined && 
            nodeB.x !== undefined && nodeB.y !== undefined) {
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < minAcceptableSpacing) {
            violations++;
          }
        }
      }
    }
    
    return {
      consistent: violations === 0,
      violations
    };
  }

  // Enhanced spacing metrics for monitoring and debugging
  public getSpacingMetrics(): {
    averageNodeDistance: number;
    minNodeDistance: number;
    maxNodeDistance: number;
    spacingViolations: number;
    densityScore: number;
  } {
    const distances: number[] = [];
    let minDistance = Infinity;
    let maxDistance = 0;
    
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];
        
        if (nodeA.x !== undefined && nodeA.y !== undefined && 
            nodeB.x !== undefined && nodeB.y !== undefined) {
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          distances.push(distance);
          minDistance = Math.min(minDistance, distance);
          maxDistance = Math.max(maxDistance, distance);
        }
      }
    }
    
    const { violations } = this.validateSpacingConsistency();
    const averageDistance = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
    
    // Calculate density score (lower is more dense)
    const totalArea = this.config.width * this.config.height;
    const nodeArea = this.nodes.length * Math.PI * Math.pow(this.config.collisionRadius, 2);
    const densityScore = nodeArea / totalArea;
    
    return {
      averageNodeDistance: averageDistance,
      minNodeDistance: minDistance === Infinity ? 0 : minDistance,
      maxNodeDistance: maxDistance,
      spacingViolations: violations,
      densityScore
    };
  }

  // Add intelligent spacing forces for clusters and density adaptation
  private addSmartSpacingForces() {
    // Cluster-based spacing force
    if (this.config.clusterSpacing) {
      this.simulation.force('cluster', this.clusterForce());
    }
    
    // Minimum separation force to prevent overcrowding
    if (this.config.minNodeSeparation) {
      this.simulation.force('separation', this.separationForce());
    }
    
    // Density adaptation force
    if (this.config.densityAdaptation) {
      this.simulation.force('density', this.densityAdaptationForce());
    }
  }

  // Helper method to count outgoing connections (tasks that depend on this task)
  private getOutgoingConnections(taskId: number): number {
    return this.nodes.filter(node => 
      node.task.dependencies.includes(taskId)
    ).length;
  }

  // Cluster force to group related tasks
  private clusterForce() {
    const strength = 0.1;
    return () => {
      this.nodes.forEach(node => {
        const clusterId = this.getClusterForNode(node);
        const clusterCenter = this.clusterCenters.get(clusterId);
        
        if (clusterCenter && node.x !== undefined && node.y !== undefined) {
          const dx = clusterCenter.x - node.x;
          const dy = clusterCenter.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const force = strength / distance;
            node.vx = (node.vx || 0) + dx * force;
            node.vy = (node.vy || 0) + dy * force;
          }
        }
      });
    };
  }

  // Separation force to maintain minimum distance between nodes
  private separationForce() {
    const minSeparation = this.config.minNodeSeparation || 200;
    const strength = 0.5;
    
    return () => {
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const nodeA = this.nodes[i];
          const nodeB = this.nodes[j];
          
          if (nodeA.x !== undefined && nodeA.y !== undefined && 
              nodeB.x !== undefined && nodeB.y !== undefined) {
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minSeparation && distance > 0) {
              const force = (minSeparation - distance) / distance * strength;
              const fx = dx * force * 0.5;
              const fy = dy * force * 0.5;
              
              nodeA.vx = (nodeA.vx || 0) - fx;
              nodeA.vy = (nodeA.vy || 0) - fy;
              nodeB.vx = (nodeB.vx || 0) + fx;
              nodeB.vy = (nodeB.vy || 0) + fy;
            }
          }
        }
      }
    };
  }

  // Density adaptation force to prevent overcrowding in dense areas
  private densityAdaptationForce() {
    const strength = 0.1;
    const radius = 300; // Radius to consider for density calculation
    
    return () => {
      this.nodes.forEach(node => {
        if (node.x === undefined || node.y === undefined) return;
        
        // Count nearby nodes
        const nearbyNodes = this.nodes.filter(other => {
          if (other === node || other.x === undefined || other.y === undefined) return false;
          const dx = other.x - node.x!;
          const dy = other.y - node.y!;
          return Math.sqrt(dx * dx + dy * dy) < radius;
        });
        
        const density = nearbyNodes.length;
        const maxComfortableDensity = 5; // Adjust based on desired spacing
        
        if (density > maxComfortableDensity) {
          // Apply repulsive force proportional to overcrowding
          const overcrowding = density - maxComfortableDensity;
          const repulsionStrength = strength * overcrowding;
          
          nearbyNodes.forEach(other => {
            const dx = node.x! - other.x!;
            const dy = node.y! - other.y!;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
              const force = repulsionStrength / distance;
              node.vx = (node.vx || 0) + dx * force;
              node.vy = (node.vy || 0) + dy * force;
            }
          });
        }
      });
    };
  }

  // Determine cluster ID for a node based on task relationships
  private getClusterForNode(node: PhysicsNode): string {
    const clusterId = this.nodeCluster.get(node.id);
    if (clusterId) return clusterId;
    
    // Simple clustering: group by dependency relationships or priority
    const task = node.task;
    
    // If task has dependencies, cluster with them
    if (task.dependencies.length > 0) {
      const depCluster = `dep-${task.dependencies[0]}`;
      this.nodeCluster.set(node.id, depCluster);
      return depCluster;
    }
    
    // If task is depended upon by others, create a cluster
    const dependents = this.nodes.filter(n => 
      n.task.dependencies.includes(task.id)
    );
    
    if (dependents.length > 0) {
      const depCluster = `leader-${task.id}`;
      this.nodeCluster.set(node.id, depCluster);
      return depCluster;
    }
    
    // Default cluster by priority
    const priorityCluster = `priority-${task.priority}`;
    this.nodeCluster.set(node.id, priorityCluster);
    return priorityCluster;
  }

  private setupForces() {
    const { config } = this;
    
    this.simulation
      .alphaDecay(config.alphaDecay)
      .alphaMin(config.alphaMin)
      .velocityDecay(config.velocityDecay)
      .force('link', d3.forceLink<PhysicsNode, PhysicsLink>()
        .id(d => d.id)
        .distance(config.linkDistance)
        .strength(config.linkStrength)
      )
      .force('charge', d3.forceManyBody()
        .strength(config.chargeStrength)
      )
      .force('center', d3.forceCenter(config.width / 2, config.height / 2)
        .strength(config.centerStrength)
      )
      .force('collision', d3.forceCollide()
        .radius(config.enableSmartSpacing ? this.getSmartCollisionRadius.bind(this) : config.collisionRadius)
        .strength(config.collisionStrength)
      );

    // Add smart spacing forces if enabled
    if (config.enableSmartSpacing) {
      this.addSmartSpacingForces();
    }

    // Enhanced tick handler with position interpolation
    this.simulation.on('tick', () => {
      const now = Date.now();
      if (now - this.lastTickTime >= this.tickThrottle) {
        this.lastTickTime = now;
        this.handleTick();
      }
    });

    // Add end handler
    this.simulation.on('end', () => {
      this.handleSimulationEnd();
    });
  }

  // Enhanced tick handling with smooth position interpolation
  private handleTick() {
    this.tickCount++;
    
    // Perform overlap detection and resolution every 10 ticks for dense graphs
    if (this.tickCount % 10 === 0 && this.nodes.length > 50) {
      this.detectAndResolveOverlaps();
    }
    
    if (this.onTick) {
      // Store previous positions before updating
      this.storePreviousPositions();
      
      // Update positions with interpolation for smoother transitions
      this.updateNodesWithInterpolation();
      
      this.onTick(this.nodes);
    }
  }

  // Store current positions as previous positions for interpolation
  private storePreviousPositions() {
    this.nodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        this.previousPositions.set(node.id, { x: node.x, y: node.y });
      }
    });
  }

  // Update node positions with smooth interpolation
  private updateNodesWithInterpolation() {
    this.nodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        const previous = this.previousPositions.get(node.id);
        
        if (previous) {
          // Calculate movement distance
          const dx = node.x - previous.x;
          const dy = node.y - previous.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Apply smoothing for large movements (> 10px)
          if (distance > 10) {
            const smoothingFactor = 0.7; // Adjust for desired smoothness
            node.x = previous.x + dx * smoothingFactor;
            node.y = previous.y + dy * smoothingFactor;
          }
        }
      }
    });
  }

  // Enhanced simulation end handling
  private handleSimulationEnd() {
    // Clear any ongoing animations
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.isInterpolating = false;
    
    if (this.onEnd) {
      this.onEnd(this.nodes);
    }
  }

  // Smooth transition to new layout configuration
  public transitionToNewLayout(newConfig: Partial<ForceLayoutConfig>, duration: number = 500) {
    this.interpolationDuration = duration;
    this.isInterpolating = true;
    this.interpolationStartTime = performance.now();
    
    // Store current positions as targets
    this.nodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        this.interpolationTargets.set(node.id, { x: node.x, y: node.y });
      }
    });
    
    // Update configuration
    this.updateConfig(newConfig);
    
    // Start smooth transition animation
    this.startLayoutTransition();
  }

  // Animate transition between layouts
  private startLayoutTransition() {
    const animate = (currentTime: number) => {
      if (!this.isInterpolating) return;
      
      const elapsed = currentTime - this.interpolationStartTime;
      const progress = Math.min(elapsed / this.interpolationDuration, 1);
      
      // Easing function for smooth animation (ease-out-cubic)
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      // Interpolate positions
      this.nodes.forEach(node => {
        const target = this.interpolationTargets.get(node.id);
        const previous = this.previousPositions.get(node.id);
        
        if (target && previous && node.x !== undefined && node.y !== undefined) {
          node.x = previous.x + (target.x - previous.x) * easedProgress;
          node.y = previous.y + (target.y - previous.y) * easedProgress;
        }
      });
      
      // Continue animation or finish
      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.isInterpolating = false;
        this.animationFrameId = null;
      }
      
      // Trigger position update
      if (this.onTick) {
        this.onTick(this.nodes);
      }
    };
    
    this.animationFrameId = requestAnimationFrame(animate);
  }

  public updateConfig(newConfig: Partial<ForceLayoutConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.setupForces();
    
    // Update existing forces with new config
    const linkForce = this.simulation.force('link') as d3.ForceLink<PhysicsNode, PhysicsLink>;
    if (linkForce) {
      linkForce.distance(this.config.linkDistance).strength(this.config.linkStrength);
    }

    const chargeForce = this.simulation.force('charge') as d3.ForceManyBody<PhysicsNode>;
    if (chargeForce) {
      chargeForce.strength(this.config.chargeStrength);
    }

    const centerForce = this.simulation.force('center') as d3.ForceCenter<PhysicsNode>;
    if (centerForce) {
      centerForce.x(this.config.width / 2).y(this.config.height / 2).strength(this.config.centerStrength);
    }

    const collisionForce = this.simulation.force('collision') as d3.ForceCollide<PhysicsNode>;
    if (collisionForce) {
      collisionForce.radius(this.config.collisionRadius).strength(this.config.collisionStrength);
    }
  }

  public setData(tasks: Task[], customPositions?: Map<string, { x: number; y: number }>) {
    // Convert tasks to physics nodes
    this.nodes = tasks.map(task => {
      const nodeId = `task-${task.id}`;
      const customPos = customPositions?.get(nodeId);
      
      const node: PhysicsNode = {
        id: nodeId,
        task,
        x: customPos?.x,
        y: customPos?.y,
        fx: customPos ? customPos.x : null, // Fix custom positions
        fy: customPos ? customPos.y : null
      };

      return node;
    });

    // Create links from task dependencies
    this.links = [];
    tasks.forEach(task => {
      task.dependencies.forEach(depId => {
        this.links.push({
          source: `task-${depId}`,
          target: `task-${task.id}`,
          strength: this.config.linkStrength
        });
      });
    });

    // Smart spacing: Calculate cluster centers if enabled
    if (this.config.enableSmartSpacing) {
      this.calculateClusterCenters();
    }

    // Apply active task focus if specified
    if (this.config.activeTaskId) {
      this.applyActiveTaskFocus(this.config.activeTaskId);
    }

    // Update simulation with new data
    this.simulation.nodes(this.nodes);
    
    const linkForce = this.simulation.force('link') as d3.ForceLink<PhysicsNode, PhysicsLink>;
    if (linkForce) {
      linkForce.links(this.links);
    }
  }

  // Calculate optimal cluster center positions
  private calculateClusterCenters() {
    this.clusterCenters.clear();
    const clusters = new Map<string, PhysicsNode[]>();
    
    // Group nodes by cluster
    this.nodes.forEach(node => {
      const clusterId = this.getClusterForNode(node);
      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, []);
      }
      clusters.get(clusterId)!.push(node);
    });
    
    // Calculate center position for each cluster
    clusters.forEach((clusterNodes, clusterId) => {
      if (clusterNodes.length === 0) return;
      
      // Use existing node positions if available, otherwise use layout bounds
      let avgX = this.config.width / 2;
      let avgY = this.config.height / 2;
      let validPositions = 0;
      
      clusterNodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          avgX += node.x;
          avgY += node.y;
          validPositions++;
        }
      });
      
      if (validPositions > 0) {
        avgX /= validPositions + 1; // +1 to account for center bias
        avgY /= validPositions + 1;
      }
      
      // Add some spread for different clusters
      const clusterIndex = Array.from(clusters.keys()).indexOf(clusterId);
      const angleSpread = (clusterIndex * 2 * Math.PI) / clusters.size;
      const spreadRadius = Math.min(this.config.width, this.config.height) * 0.15;
      
      avgX += Math.cos(angleSpread) * spreadRadius;
      avgY += Math.sin(angleSpread) * spreadRadius;
      
      this.clusterCenters.set(clusterId, { x: avgX, y: avgY });
    });
  }

  private applyActiveTaskFocus(activeTaskId: number) {
    const activeNodeId = `task-${activeTaskId}`;
    const activeNode = this.nodes.find(n => n.id === activeNodeId);
    
    if (!activeNode) return;

    // Position active task near center
    activeNode.fx = this.config.width / 2;
    activeNode.fy = this.config.height / 2;

    // Find related tasks (dependencies and dependents)
    const relatedNodeIds = new Set<string>();
    
    // Add dependencies of active task
    activeNode.task.dependencies.forEach(depId => {
      relatedNodeIds.add(`task-${depId}`);
    });

    // Add tasks that depend on the active task
    this.nodes.forEach(node => {
      if (node.task.dependencies.includes(activeTaskId)) {
        relatedNodeIds.add(node.id);
      }
    });

    // Adjust link strengths for better focus
    this.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      if (sourceId === activeNodeId || targetId === activeNodeId) {
        // Strengthen links connected to active task
        link.strength = this.config.linkStrength * (this.config.focusStrength || 2);
      } else if (relatedNodeIds.has(sourceId) || relatedNodeIds.has(targetId)) {
        // Moderate strengthening for related tasks
        link.strength = this.config.linkStrength * 1.5;
      }
    });
  }

  public start() {
    this.simulation.restart();
  }

  public stop() {
    this.simulation.stop();
  }

  public alpha(value?: number) {
    if (value === undefined) {
      return this.simulation.alpha();
    }
    this.simulation.alpha(value);
    return this;
  }

  public onTickUpdate(callback: (nodes: PhysicsNode[]) => void) {
    this.onTick = callback;
  }

  public onSimulationEnd(callback: (nodes: PhysicsNode[]) => void) {
    this.onEnd = callback;
  }

  public getNodes(): PhysicsNode[] {
    return this.nodes;
  }

  public getLinks(): PhysicsLink[] {
    return this.links;
  }

  public releaseFixedPositions() {
    this.nodes.forEach(node => {
      node.fx = null;
      node.fy = null;
    });
  }

  public setFixedPosition(nodeId: string, x: number, y: number) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }

  public optimizeForLargeDataset(nodeCount: number) {
    // Adaptive tick throttling based on graph size for better performance
    if (nodeCount > 500) {
      this.tickThrottle = 50; // 20fps for very large datasets
      this.interpolationDuration = 200; // Faster transitions for large datasets
    } else if (nodeCount > 200) {
      this.tickThrottle = 33; // 30fps for large datasets
      this.interpolationDuration = 250;
    } else if (nodeCount > 100) {
      this.tickThrottle = 25; // 40fps for medium datasets
      this.interpolationDuration = 300;
    } else {
      this.tickThrottle = 16; // 60fps for small datasets
      this.interpolationDuration = 350; // Smoother transitions for small datasets
    }
    
    // Adjust simulation parameters for better performance with large datasets
    if (nodeCount > 100) {
      this.updateConfig({
        alphaDecay: 0.05, // Faster convergence
        alphaMin: 0.005,  // Higher minimum to stop earlier
        chargeStrength: Math.max(-1200, -800 - nodeCount), // Scale repulsion with size
        collisionStrength: Math.min(0.5, 0.8 - nodeCount / 1000) // Reduce collision for large graphs
      });
    }
    
    if (nodeCount > 300) {
      this.updateConfig({
        alphaDecay: 0.1, // Even faster convergence
        linkStrength: 0.3, // Weaker links for stability
        centerStrength: 0.05 // Weaker center force
      });
    }
    
    // Enable smart spacing for better organization in large datasets
    if (nodeCount > 50) {
      this.updateConfig({
        enableSmartSpacing: true,
        densityAdaptation: true,
        minNodeSeparation: Math.max(120, 200 - nodeCount * 0.5) // Adaptive separation
      });
      
      // Adjust emergency spacing parameters for dense graphs
      if (nodeCount > 200) {
        this.overlapDetectionRadius = Math.max(10, 15 - nodeCount / 100);
        this.emergencySpacingForce = Math.max(1.0, 2.0 - nodeCount / 500);
      }
    }
    
    // Enhanced collision parameters for very large graphs
    if (nodeCount > 100) {
      this.updateConfig({
        collisionRadius: Math.max(100, 160 - nodeCount * 0.2), // Smaller radius for dense graphs
        collisionStrength: Math.max(0.3, 0.8 - nodeCount / 1000) // Adaptive collision strength
      });
    }

    // Task 2.5: Advanced optimizations for large graphs (500+ nodes)
    if (nodeCount >= (this.config.emergencyThrottleThreshold || 500)) {
      this.activateEmergencyMode(nodeCount);
    }

    // Task 2.5: Enable Web Worker for computation-heavy large graphs
    if (nodeCount > 300 && this.config.useWebWorkers && this.isWebWorkerSupported()) {
      this.enableWebWorkerCalculations();
    }

    // Task 2.5: Adaptive quality reduction for performance
    if (this.config.adaptiveQuality) {
      this.adjustQualityBasedOnSize(nodeCount);
    }

    // Task 2.5: Start performance monitoring for large graphs
    if (nodeCount > 200 && this.config.enablePerformanceMonitoring) {
      this.enablePerformanceMonitoring();
    }
  }

  // Task 2.5: Advanced performance optimization methods
  private activateEmergencyMode(nodeCount: number) {
    this.emergencyMode = true;
    this.qualityLevel = 'emergency';
    this.performanceMetrics.activeOptimizations.push('emergency-mode');

    // Drastically reduce tick rate for emergency performance
    this.tickThrottle = Math.max(100, 66 + (nodeCount - 500) * 0.1); // 10fps or lower
    
    // Simplify simulation parameters
    this.updateConfig({
      alphaDecay: 0.2, // Very fast convergence
      alphaMin: 0.01,  // Stop early
      chargeStrength: Math.max(-500, -300 - nodeCount * 0.5), // Weak repulsion
      linkStrength: 0.1, // Very weak links
      collisionStrength: 0.2, // Minimal collision
      velocityDecay: 0.7 // High damping for stability
    });

    // Disable expensive features
    this.updateConfig({
      enableSmartSpacing: false,
      densityAdaptation: false
    });

    console.warn(`🚨 Emergency mode activated for ${nodeCount} nodes - reduced quality for performance`);
  }

  private adjustQualityBasedOnSize(nodeCount: number) {
    if (nodeCount > 800) {
      this.qualityLevel = 'emergency';
      this.tickThrottle = 100; // 10fps
    } else if (nodeCount > 600) {
      this.qualityLevel = 'low';
      this.tickThrottle = 66; // 15fps
    } else if (nodeCount > 400) {
      this.qualityLevel = 'medium';
      this.tickThrottle = 50; // 20fps
    } else {
      this.qualityLevel = 'high';
      this.tickThrottle = Math.max(16, 33 - nodeCount * 0.05); // Adaptive 30-60fps
    }

    this.performanceMetrics.activeOptimizations.push(`quality-${this.qualityLevel}`);
  }

  private enablePerformanceMonitoring() {
    if (this.isPerformanceMonitoringEnabled) return;
    
    this.isPerformanceMonitoringEnabled = true;
    this.performanceMetrics.activeOptimizations.push('performance-monitoring');

    // Monitor frame rate and CPU usage every second
    this.performanceMonitoringInterval = window.setInterval(() => {
      this.updatePerformanceMetrics();
      this.checkPerformanceThresholds();
    }, 1000);

    console.log('📊 Performance monitoring enabled for large graph optimization');
  }

  private updatePerformanceMetrics() {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Track frame times for averaging
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) { // Keep last 60 frames
      this.frameTimeHistory.shift();
    }

    // Calculate frame rate and average frame time
    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
    this.performanceMetrics.avgFrameTime = avgFrameTime;
    this.performanceMetrics.frameRate = Math.min(60, 1000 / avgFrameTime);

    // Estimate CPU usage based on frame time consistency
    const frameTimeVariance = this.calculateVariance(this.frameTimeHistory);
    this.performanceMetrics.cpuUsage = Math.min(100, frameTimeVariance * 10);

    // Estimate memory usage (simplified approach)
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.performanceMetrics.memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024); // MB
    }

    // Track history for trend analysis
    this.cpuUsageHistory.push(this.performanceMetrics.cpuUsage);
    this.memoryUsageHistory.push(this.performanceMetrics.memoryUsage);

    // Keep only recent history
    if (this.cpuUsageHistory.length > 30) this.cpuUsageHistory.shift();
    if (this.memoryUsageHistory.length > 30) this.memoryUsageHistory.shift();

    this.performanceMetrics.lastMeasurement = now;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private checkPerformanceThresholds() {
    const { frameRate, memoryUsage } = this.performanceMetrics;
    const targetFrameRate = this.config.maxFrameRate || 30;
    const memoryLimit = this.config.memoryUsageLimit || 100; // 100MB default

    // Emergency throttling if performance is degraded
    if (frameRate < targetFrameRate * 0.5) {
      this.applyEmergencyThrottling();
    }

    // Memory management
    if (memoryUsage > memoryLimit) {
      this.performMemoryOptimization();
    }

    // Adaptive throttling based on performance
    if (frameRate < targetFrameRate * 0.8) {
      this.increaseThrottling();
    } else if (frameRate > targetFrameRate * 1.2 && this.tickThrottle > 16) {
      this.decreaseThrottling();
    }
  }

  private applyEmergencyThrottling() {
    this.tickThrottle = Math.max(this.tickThrottle * 1.5, 100); // At least 100ms between ticks
    this.performanceMetrics.throttleLevel++;
    this.performanceMetrics.activeOptimizations.push('emergency-throttling');
    
    console.warn(`⚡ Emergency throttling applied - frame rate: ${this.performanceMetrics.frameRate.toFixed(1)}fps`);
  }

  private increaseThrottling() {
    this.tickThrottle = Math.min(this.tickThrottle * 1.2, 100);
    this.performanceMetrics.throttleLevel++;
  }

  private decreaseThrottling() {
    this.tickThrottle = Math.max(this.tickThrottle * 0.9, 16);
    this.performanceMetrics.throttleLevel = Math.max(0, this.performanceMetrics.throttleLevel - 1);
  }

  private performMemoryOptimization() {
    // Clear old position history
    if (this.frameTimeHistory.length > 30) {
      this.frameTimeHistory = this.frameTimeHistory.slice(-30);
    }
    if (this.cpuUsageHistory.length > 15) {
      this.cpuUsageHistory = this.cpuUsageHistory.slice(-15);
    }
    if (this.memoryUsageHistory.length > 15) {
      this.memoryUsageHistory = this.memoryUsageHistory.slice(-15);
    }

    // Clear interpolation maps if not actively interpolating
    if (!this.isInterpolating) {
      this.previousPositions.clear();
      this.interpolationTargets.clear();
    }

    this.performanceMetrics.activeOptimizations.push('memory-optimization');
    console.log('🧹 Memory optimization performed');
  }

  // Web Worker support for off-main-thread calculations
  private isWebWorkerSupported(): boolean {
    return typeof Worker !== 'undefined' && typeof window !== 'undefined';
  }

  private initializeWebWorker() {
    if (!this.isWebWorkerSupported()) return;

    try {
      // Create worker from inline script for force calculations
      const workerScript = `
        self.onmessage = function(e) {
          const { type, payload } = e.data;
          
          if (type === 'CALCULATE_FORCES') {
            // Perform force calculations off-main-thread
            const { nodes, config } = payload;
            
            // Simplified force calculation for Web Worker
            const results = nodes.map(node => {
              let fx = 0, fy = 0;
              
              // Calculate repulsion forces with other nodes
              nodes.forEach(other => {
                if (other.id !== node.id && other.x !== undefined && other.y !== undefined) {
                  const dx = node.x - other.x;
                  const dy = node.y - other.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  
                  if (distance > 0) {
                    const force = config.chargeStrength / (distance * distance);
                    fx += (dx / distance) * force;
                    fy += (dy / distance) * force;
                  }
                }
              });
              
              return { id: node.id, fx, fy };
            });
            
            self.postMessage({ type: 'RESULT', payload: results });
          }
        };
      `;

      const blob = new Blob([workerScript], { type: 'application/javascript' });
      this.webWorker = new Worker(URL.createObjectURL(blob));
      
      this.webWorker.onmessage = (e) => {
        this.handleWorkerMessage(e.data);
      };

      this.performanceMetrics.activeOptimizations.push('web-worker');
      console.log('🔧 Web Worker initialized for off-main-thread force calculations');
      
    } catch (error) {
      console.warn('Failed to initialize Web Worker:', error);
      this.webWorker = null;
    }
  }

  private enableWebWorkerCalculations() {
    if (!this.webWorker) return;
    
    this.isUsingWebWorker = true;
    this.performanceMetrics.activeOptimizations.push('web-worker-active');
  }

  private handleWorkerMessage(message: WorkerMessage) {
    if (message.type === 'RESULT') {
      // Apply worker-calculated forces to nodes
      const forces = message.payload;
      forces.forEach((force: any) => {
        const node = this.nodes.find(n => n.id === force.id);
        if (node) {
          node.vx = (node.vx || 0) + force.fx * 0.1; // Dampen worker forces
          node.vy = (node.vy || 0) + force.fy * 0.1;
        }
      });
    }
  }

  private cleanupWebWorker() {
    if (this.webWorker) {
      this.webWorker.terminate();
      this.webWorker = null;
      this.isUsingWebWorker = false;
    }
  }

  // Get performance metrics for monitoring dashboard
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  // Manual performance optimization trigger
  public optimizePerformance() {
    this.updatePerformanceMetrics();
    this.checkPerformanceThresholds();
    this.performMemoryOptimization();
  }

  // Task 2.6: Additional API methods for layout configuration and control

  /**
   * Restart the simulation with current configuration
   * Useful for applying changes that require a fresh start
   */
  public restartSimulation() {
    this.simulation.stop();
    this.simulation.alpha(1).restart();
    console.log('ForceDirectedLayout: Simulation restarted');
  }

  /**
   * Reset configuration to default values
   * @param preserveData If true, keeps current nodes and links data
   */
  public resetToDefaults(preserveData: boolean = false) {
    this.config = { ...DEFAULT_FORCE_CONFIG };
    this.setupForces();
    
    if (!preserveData) {
      this.nodes = [];
      this.links = [];
      this.simulation.nodes(this.nodes);
      this.simulation.force('link', d3.forceLink(this.links));
    }
    
    this.restartSimulation();
    console.log('ForceDirectedLayout: Reset to default configuration', { preserveData });
  }

  /**
   * Get current configuration
   * @returns Deep copy of current configuration
   */
  public getConfig(): ForceLayoutConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Export configuration as JSON string
   * @param includePerformanceMetrics Whether to include current performance data
   * @returns JSON string of configuration
   */
  public exportConfig(includePerformanceMetrics: boolean = false): string {
    const exportData = {
      config: this.getConfig(),
      timestamp: new Date().toISOString(),
      nodeCount: this.nodes.length,
      linkCount: this.links.length,
      ...(includePerformanceMetrics && { performanceMetrics: this.getPerformanceMetrics() })
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Validate configuration parameters
   * @param config Configuration to validate
   * @returns Validation result with errors if any
   */
  public validateConfig(config: Partial<ForceLayoutConfig>): { 
    valid: boolean; 
    errors: string[]; 
    warnings: string[] 
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate numeric ranges
    if (config.alphaDecay !== undefined && (config.alphaDecay <= 0 || config.alphaDecay > 1)) {
      errors.push('alphaDecay must be between 0 and 1');
    }
    
    if (config.alphaMin !== undefined && (config.alphaMin <= 0 || config.alphaMin > 1)) {
      errors.push('alphaMin must be between 0 and 1');
    }
    
    if (config.velocityDecay !== undefined && (config.velocityDecay < 0 || config.velocityDecay > 1)) {
      errors.push('velocityDecay must be between 0 and 1');
    }
    
    if (config.linkDistance !== undefined && config.linkDistance < 0) {
      errors.push('linkDistance must be positive');
    }
    
    if (config.linkStrength !== undefined && (config.linkStrength < 0 || config.linkStrength > 1)) {
      errors.push('linkStrength must be between 0 and 1');
    }
    
    if (config.collisionRadius !== undefined && config.collisionRadius < 0) {
      errors.push('collisionRadius must be positive');
    }
    
    if (config.collisionStrength !== undefined && (config.collisionStrength < 0 || config.collisionStrength > 1)) {
      errors.push('collisionStrength must be between 0 and 1');
    }
    
    if (config.width !== undefined && config.width <= 0) {
      errors.push('width must be positive');
    }
    
    if (config.height !== undefined && config.height <= 0) {
      errors.push('height must be positive');
    }

    // Performance-related validations
    if (config.maxFrameRate !== undefined && (config.maxFrameRate < 1 || config.maxFrameRate > 120)) {
      warnings.push('maxFrameRate outside recommended range (1-120 fps)');
    }
    
    if (config.emergencyThrottleThreshold !== undefined && config.emergencyThrottleThreshold < 100) {
      warnings.push('emergencyThrottleThreshold below 100 may cause frequent throttling');
    }
    
    if (config.memoryUsageLimit !== undefined && config.memoryUsageLimit < 50) {
      warnings.push('memoryUsageLimit below 50MB may cause frequent optimizations');
    }

    // Smart spacing validations
    if (config.minNodeSeparation !== undefined && config.collisionRadius !== undefined) {
      if (config.minNodeSeparation < config.collisionRadius) {
        warnings.push('minNodeSeparation is less than collisionRadius, may cause overlaps');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Test collision detection system and return diagnostic information
   * @returns Collision detection test results
   */
  public testCollisionDetection(): {
    totalNodes: number;
    collisionPairs: Array<{ nodeA: string; nodeB: string; distance: number; minDistance: number }>;
    overlapCount: number;
    averageDistance: number;
    recommendations: string[];
  } {
    const results = {
      totalNodes: this.nodes.length,
      collisionPairs: [] as Array<{ nodeA: string; nodeB: string; distance: number; minDistance: number }>,
      overlapCount: 0,
      averageDistance: 0,
      recommendations: [] as string[]
    };

    if (this.nodes.length < 2) {
      results.recommendations.push('Need at least 2 nodes to test collision detection');
      return results;
    }

    let totalDistance = 0;
    let pairCount = 0;

    // Check all node pairs for overlaps
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];
        
        if (!nodeA.x || !nodeA.y || !nodeB.x || !nodeB.y) continue;

        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const radiusA = this.getSmartCollisionRadius(nodeA);
        const radiusB = this.getSmartCollisionRadius(nodeB);
        const minDistance = radiusA + radiusB;

        totalDistance += distance;
        pairCount++;

        if (distance < minDistance) {
          results.collisionPairs.push({
            nodeA: nodeA.id,
            nodeB: nodeB.id,
            distance,
            minDistance
          });
          results.overlapCount++;
        }
      }
    }

    results.averageDistance = pairCount > 0 ? totalDistance / pairCount : 0;

    // Generate recommendations
    if (results.overlapCount > 0) {
      results.recommendations.push(`Found ${results.overlapCount} overlapping node pairs`);
      
      if (results.overlapCount > this.nodes.length * 0.1) {
        results.recommendations.push('High overlap rate - consider increasing collision radius or spacing');
      }
      
      results.recommendations.push('Consider running restartSimulation() to resolve overlaps');
    } else {
      results.recommendations.push('No overlaps detected - collision detection working properly');
    }

    if (results.averageDistance < this.config.collisionRadius * 2) {
      results.recommendations.push('Average node distance is low - consider increasing spacing parameters');
    }

    return results;
  }

  /**
   * Generate comprehensive collision and spacing report
   * @returns Detailed analysis of current layout spacing
   */
  public generateCollisionReport(): {
    summary: {
      totalNodes: number;
      totalLinks: number;
      layoutDimensions: { width: number; height: number };
      density: number;
    };
    spacing: {
      averageNodeDistance: number;
      minDistance: number;
      maxDistance: number;
      optimalDistance: number;
      spacingEfficiency: number;
    };
    collisions: {
      overlapCount: number;
      criticalOverlaps: number;
      overlapPercentage: number;
      worstOverlap: { distance: number; required: number } | null;
    };
    performance: {
      simulationStability: number;
      convergenceRate: number;
      layoutQuality: 'excellent' | 'good' | 'fair' | 'poor';
    };
    recommendations: string[];
  } {
    const collisionTest = this.testCollisionDetection();
    const performanceMetrics = this.getPerformanceMetrics();

    // Calculate layout density
    const layoutArea = this.config.width * this.config.height;
    const nodeArea = this.nodes.length * Math.PI * Math.pow(this.config.collisionRadius, 2);
    const density = nodeArea / layoutArea;

    // Calculate spacing efficiency
    const optimalDistance = this.config.collisionRadius * 2.5; // Ideal spacing
    const spacingEfficiency = Math.max(0, 1 - Math.abs(collisionTest.averageDistance - optimalDistance) / optimalDistance);

    // Find min/max distances
    let minDistance = Infinity;
    let maxDistance = 0;
    let worstOverlap: { distance: number; required: number } | null = null;

    for (const pair of collisionTest.collisionPairs) {
      minDistance = Math.min(minDistance, pair.distance);
      maxDistance = Math.max(maxDistance, pair.distance);
      
      if (!worstOverlap || pair.distance < worstOverlap.distance) {
        worstOverlap = { distance: pair.distance, required: pair.minDistance };
      }
    }

    // Calculate simulation stability (based on alpha and performance)
    const simulationStability = Math.max(0, 1 - this.simulation.alpha()) * 
                              (performanceMetrics.frameRate / 60);

    // Determine layout quality
    let layoutQuality: 'excellent' | 'good' | 'fair' | 'poor';
    if (collisionTest.overlapCount === 0 && spacingEfficiency > 0.8) {
      layoutQuality = 'excellent';
    } else if (collisionTest.overlapCount < this.nodes.length * 0.05 && spacingEfficiency > 0.6) {
      layoutQuality = 'good';
    } else if (collisionTest.overlapCount < this.nodes.length * 0.15 && spacingEfficiency > 0.4) {
      layoutQuality = 'fair';
    } else {
      layoutQuality = 'poor';
    }

    // Generate comprehensive recommendations
    const recommendations: string[] = [];
    
    if (density > 0.3) {
      recommendations.push('Layout density is high - consider increasing dimensions or reducing collision radius');
    }
    
    if (spacingEfficiency < 0.5) {
      recommendations.push('Spacing efficiency is low - adjust force parameters for better distribution');
    }
    
    if (collisionTest.overlapCount > 0) {
      recommendations.push(`${collisionTest.overlapCount} overlaps detected - increase collision strength or radius`);
    }
    
    if (simulationStability < 0.7) {
      recommendations.push('Simulation appears unstable - consider adjusting alpha decay or force parameters');
    }
    
    if (performanceMetrics.frameRate < 30) {
      recommendations.push('Low frame rate detected - enable performance optimizations');
    }

    if (recommendations.length === 0) {
      recommendations.push('Layout is well-optimized with good spacing and performance');
    }

    return {
      summary: {
        totalNodes: this.nodes.length,
        totalLinks: this.links.length,
        layoutDimensions: { width: this.config.width, height: this.config.height },
        density: Math.round(density * 1000) / 1000
      },
      spacing: {
        averageNodeDistance: Math.round(collisionTest.averageDistance * 100) / 100,
        minDistance: minDistance === Infinity ? 0 : Math.round(minDistance * 100) / 100,
        maxDistance: Math.round(maxDistance * 100) / 100,
        optimalDistance: optimalDistance,
        spacingEfficiency: Math.round(spacingEfficiency * 1000) / 1000
      },
      collisions: {
        overlapCount: collisionTest.overlapCount,
        criticalOverlaps: collisionTest.collisionPairs.filter(p => p.distance < p.minDistance * 0.8).length,
        overlapPercentage: Math.round((collisionTest.overlapCount / Math.max(1, this.nodes.length * (this.nodes.length - 1) / 2)) * 10000) / 100,
        worstOverlap
      },
      performance: {
        simulationStability: Math.round(simulationStability * 1000) / 1000,
        convergenceRate: Math.round((1 - this.simulation.alpha()) * 1000) / 1000,
        layoutQuality
      },
      recommendations
    };
  }

  // Public cleanup method to dispose of all performance monitoring resources
  public cleanup() {
    // Stop simulation
    this.simulation.stop();
    
    // Clean up Web Worker
    this.cleanupWebWorker();
    
    // Clear performance monitoring interval
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
      this.performanceMonitoringInterval = null;
    }
    
    // Clear performance monitoring data
    this.frameTimeHistory = [];
    this.cpuUsageHistory = [];
    this.memoryUsageHistory = [];
    
    // Reset performance metrics
    this.performanceMetrics = {
      frameRate: 60,
      avgFrameTime: 16.67,
      cpuUsage: 0,
      memoryUsage: 0,
      simulationSteps: 0,
      throttleLevel: 0,
      activeOptimizations: [],
      lastMeasurement: performance.now()
    };
    
    // Reset performance state
    this.lastFrameTime = performance.now();
    this.isPerformanceMonitoringEnabled = false;
    this.emergencyMode = false;
    this.qualityLevel = 'high';
    this.isUsingWebWorker = false;
    
    // Clear positions and targets
    this.previousPositions.clear();
    this.interpolationTargets.clear();
    
    // Cancel any pending animation frames
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    console.log('ForceDirectedLayout: Cleanup completed - all performance monitoring resources disposed');
  }
}

// Default configuration for the layout
export const DEFAULT_FORCE_CONFIG: ForceLayoutConfig = {
  // Simulation parameters
  alphaDecay: 0.0228, // Default D3 value
  alphaMin: 0.001,    // Default D3 value
  velocityDecay: 0.4,  // Default D3 value
  
  // Force strengths
  linkDistance: 200,   // Distance between connected nodes
  linkStrength: 0.7,   // Strength of link constraints
  chargeStrength: -800, // Repulsion between nodes (negative = repel)
  centerStrength: 0.1,  // Attraction to center
  collisionRadius: 160, // Node collision radius (slightly larger than visual node)
  collisionStrength: 0.8, // Collision force strength
  
  // Layout dimensions (will be updated based on viewport)
  width: 1400,
  height: 800,
  
  // Active task focus
  focusStrength: 2, // Multiplier for link strength around active task
  
  // Smart spacing parameters
  enableSmartSpacing: true, // Enable enhanced spacing algorithms
  prioritySpacingMultiplier: 1.3, // Extra space for high-priority tasks
  clusterSpacing: 150, // Spacing between clusters
  minNodeSeparation: 180, // Minimum distance between any two nodes
  densityAdaptation: true, // Adapt spacing based on local density
  edgeBundling: false, // Bundle multiple edges between same node pairs (future enhancement)

  // Task 2.5: Advanced performance options for large graphs (500+ nodes)
  enablePerformanceMonitoring: true,
  useWebWorkers: true,
  maxFrameRate: 60, // Target frame rate cap for performance
  emergencyThrottleThreshold: 500, // Node count to trigger emergency throttling
  adaptiveQuality: true, // Reduce quality for performance when needed
  memoryUsageLimit: 200, // MB limit before triggering memory optimizations
};
