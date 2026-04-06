import yaml from 'js-yaml';
import type { DiagramData, RawDiagram, NodeType, ConnectionType } from '../types/diagram';
import { NODE_COLORS, CONNECTION_STYLES } from '../types/diagram';

const VALID_TYPES = Object.keys(NODE_COLORS) as NodeType[];
const VALID_CONN_TYPES = Object.keys(CONNECTION_STYLES) as ConnectionType[];

export function parseYaml(input: string): { data: DiagramData | null; error: string | null } {
  try {
    const raw = yaml.load(input) as RawDiagram;
    if (!raw || typeof raw !== 'object') {
      return { data: { nodes: [], connections: [] }, error: null };
    }

    const nodes = (raw.nodes || []).map((n, i) => ({
      id: n.id || `node-${i}`,
      label: n.label || n.id || `Node ${i}`,
      type: (VALID_TYPES.includes(n.type as NodeType) ? n.type : 'service') as NodeType,
      x: 0,
      y: 0,
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const connections = (raw.connections || [])
      .filter((c) => nodeIds.has(c.from) && nodeIds.has(c.to))
      .map((c) => ({
        from: c.from,
        to: c.to,
        label: c.label,
        type: (VALID_CONN_TYPES.includes(c.type as ConnectionType) ? c.type : 'sync') as ConnectionType,
      }));

    return { data: { nodes, connections }, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}
