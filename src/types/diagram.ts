export type NodeType =
  | 'client' | 'cdn' | 'loadbalancer' | 'gateway'
  | 'service' | 'worker' | 'database' | 'nosql'
  | 'cache' | 'queue' | 'stream' | 'storage'
  | 'search' | 'notification' | 'dns' | 'external'
  | 'firewall' | 'analytics' | 'ml' | 'scheduler';

export type ConnectionType = 'sync' | 'async' | 'pubsub' | 'websocket' | 'grpc' | 'stream';

export interface DiagramNode {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
  type?: ConnectionType;
}

export interface DiagramData {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

export interface RawNode {
  id: string;
  label: string;
  type?: string;
}

export interface RawConnection {
  from: string;
  to: string;
  label?: string;
  type?: string;
}

export interface RawDiagram {
  nodes?: RawNode[];
  connections?: RawConnection[];
}

export type Theme = 'dark' | 'light' | 'blueprint';

export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 70;

export const NODE_COLORS: Record<NodeType, string> = {
  client:       '#6B8EB5',
  cdn:          '#7BA7BC',
  dns:          '#8899AA',
  loadbalancer: '#5BA3A3',
  gateway:      '#6BB5A0',
  firewall:     '#B56B6B',
  service:      '#6BAF7A',
  worker:       '#8AB872',
  scheduler:    '#5A9E8F',
  database:     '#5B9EC4',
  nosql:        '#6DB3C4',
  storage:      '#7CAAB5',
  cache:        '#C4A35B',
  queue:        '#C49060',
  stream:       '#B88A6B',
  search:       '#8B7DB5',
  analytics:    '#9B85B5',
  ml:           '#7B6BA5',
  notification: '#B57878',
  external:     '#8A8A9A',
};

export const NODE_ICONS: Record<NodeType, string> = {
  client:       '🖥️',
  cdn:          '🌍',
  loadbalancer: '⚖️',
  gateway:      '🚪',
  firewall:     '🛡️',
  service:      '⚙️',
  worker:       '👷',
  scheduler:    '⏲️',
  database:     '🗄️',
  nosql:        '📄',
  storage:      '📦',
  cache:        '⚡',
  queue:        '📨',
  stream:       '🌊',
  search:       '🔍',
  analytics:    '📊',
  ml:           '🧠',
  notification: '🔔',
  dns:          '🏷️',
  external:     '🌐',
};

export const CONNECTION_STYLES: Record<ConnectionType, { stroke: string; dasharray: string; label: string }> = {
  sync:      { stroke: '#e0e0e0', dasharray: '',          label: 'HTTP/REST' },
  async:     { stroke: '#9B59B6', dasharray: '8 4',       label: 'Async' },
  pubsub:    { stroke: '#AB47BC', dasharray: '4 4',       label: 'Pub/Sub' },
  websocket: { stroke: '#4A90D9', dasharray: '12 4 4 4',  label: 'WebSocket' },
  grpc:      { stroke: '#50C878', dasharray: '2 2',       label: 'gRPC' },
  stream:    { stroke: '#FF8A65', dasharray: '6 3',       label: 'Stream' },
};

export const THEME_STYLES: Record<Theme, { bg: string; surface: string; text: string; grid: string }> = {
  dark: { bg: '#1a1a2e', surface: '#16213e', text: '#e0e0e0', grid: '#2a2a4a' },
  light: { bg: '#f5f5f5', surface: '#ffffff', text: '#333333', grid: '#e0e0e0' },
  blueprint: { bg: '#1b3a5c', surface: '#1e4976', text: '#c8ddf0', grid: '#2a5a8c' },
};

export const DEFAULT_YAML = `nodes:

  - id: client
    label: Web Client
    type: client

  - id: api
    label: API Server
    type: service

  - id: db
    label: PostgreSQL
    type: database

  - id: cache
    label: Redis Cache
    type: cache

connections:

  - from: client
    to: api
    label: REST API
    type: sync

  - from: api
    to: cache
    label: Cache Lookup
    type: sync

  - from: api
    to: db
    label: SQL Queries
    type: sync
`;
