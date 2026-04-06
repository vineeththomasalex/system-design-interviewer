import type { DiagramNode, DiagramConnection, NodeType } from '../types/diagram';
import { NODE_WIDTH, NODE_HEIGHT } from '../types/diagram';

const PADDING = 60;
const H_GAP = 80;
const V_GAP = 60;

/** Arrange nodes in a grid layout */
export function gridLayout(nodes: DiagramNode[], canvasWidth: number): DiagramNode[] {
  const cols = Math.max(1, Math.floor((canvasWidth - PADDING * 2) / (NODE_WIDTH + H_GAP)));
  return nodes.map((node, i) => ({
    ...node,
    x: PADDING + (i % cols) * (NODE_WIDTH + H_GAP),
    y: PADDING + Math.floor(i / cols) * (NODE_HEIGHT + V_GAP),
  }));
}

/** Simple force-directed layout simulation */
export function forceLayout(
  nodes: DiagramNode[],
  connections: DiagramConnection[],
  canvasWidth: number,
  canvasHeight: number,
  iterations = 100
): DiagramNode[] {
  if (nodes.length === 0) return [];

  // Initialize positions in a circle
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const radius = Math.min(canvasWidth, canvasHeight) * 0.3;

  let positioned = nodes.map((node, i) => ({
    ...node,
    x: cx + radius * Math.cos((2 * Math.PI * i) / nodes.length) - NODE_WIDTH / 2,
    y: cy + radius * Math.sin((2 * Math.PI * i) / nodes.length) - NODE_HEIGHT / 2,
    vx: 0,
    vy: 0,
  }));

  const idxMap = new Map(positioned.map((n, i) => [n.id, i]));

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;
    const forces = positioned.map(() => ({ fx: 0, fy: 0 }));

    // Repulsion between all pairs
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const dx = positioned[i].x - positioned[j].x;
        const dy = positioned[i].y - positioned[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const repulse = 50000 / (dist * dist);
        const fx = (dx / dist) * repulse;
        const fy = (dy / dist) * repulse;
        forces[i].fx += fx;
        forces[i].fy += fy;
        forces[j].fx -= fx;
        forces[j].fy -= fy;
      }
    }

    // Attraction along connections
    for (const conn of connections) {
      const si = idxMap.get(conn.from);
      const ti = idxMap.get(conn.to);
      if (si === undefined || ti === undefined) continue;
      const dx = positioned[ti].x - positioned[si].x;
      const dy = positioned[ti].y - positioned[si].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const ideal = NODE_WIDTH * 2;
      const attract = (dist - ideal) * 0.05;
      const fx = (dx / dist) * attract;
      const fy = (dy / dist) * attract;
      forces[si].fx += fx;
      forces[si].fy += fy;
      forces[ti].fx -= fx;
      forces[ti].fy -= fy;
    }

    // Center gravity
    for (let i = 0; i < positioned.length; i++) {
      forces[i].fx += (cx - NODE_WIDTH / 2 - positioned[i].x) * 0.01;
      forces[i].fy += (cy - NODE_HEIGHT / 2 - positioned[i].y) * 0.01;
    }

    // Apply forces
    positioned = positioned.map((n, i) => ({
      ...n,
      x: Math.max(PADDING, Math.min(canvasWidth - NODE_WIDTH - PADDING,
        n.x + forces[i].fx * cooling)),
      y: Math.max(PADDING, Math.min(canvasHeight - NODE_HEIGHT - PADDING,
        n.y + forces[i].fy * cooling)),
    }));
  }

  return positioned.map(({ vx: _, vy: __, ...rest }) => rest);
}

/** Tier mapping: each node type → a logical tier (top to bottom) */
const TIER_MAP: Record<NodeType, number> = {
  client: 0, cdn: 0, dns: 0, external: 0,
  loadbalancer: 1, gateway: 1, firewall: 1,
  service: 2, worker: 2, scheduler: 2, cache: 2,
  queue: 3, stream: 3, notification: 3,
  search: 4, analytics: 4, ml: 4,
  database: 5, nosql: 5, storage: 5,
};

const TIER_GAP = 110;

/** Arrange nodes in logical architecture tiers (top to bottom) */
export function tieredLayout(nodes: DiagramNode[], canvasWidth: number): DiagramNode[] {
  if (nodes.length === 0) return [];

  // Group nodes by tier
  const tiers = new Map<number, DiagramNode[]>();
  for (const node of nodes) {
    const tier = TIER_MAP[node.type] ?? 2;
    if (!tiers.has(tier)) tiers.set(tier, []);
    tiers.get(tier)!.push(node);
  }

  // Sort tiers by tier number, filter empty
  const activeTiers = [...tiers.entries()].sort((a, b) => a[0] - b[0]);

  const result: DiagramNode[] = [];

  activeTiers.forEach(([, tierNodes], tierIdx) => {
    const tierY = PADDING + tierIdx * (NODE_HEIGHT + TIER_GAP);
    const totalWidth = tierNodes.length * NODE_WIDTH + (tierNodes.length - 1) * H_GAP;
    const startX = Math.max(PADDING, (canvasWidth - totalWidth) / 2);

    tierNodes.forEach((node, i) => {
      result.push({
        ...node,
        x: startX + i * (NODE_WIDTH + H_GAP),
        y: tierY,
      });
    });
  });

  return result;
}
