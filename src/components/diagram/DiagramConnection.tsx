import React from 'react';
import type { DiagramNode, DiagramConnection as DiagramConnectionType } from '../../types/diagram';
import { NODE_WIDTH, NODE_HEIGHT, CONNECTION_STYLES } from '../../types/diagram';

interface Props {
  connection: DiagramConnectionType;
  nodes: DiagramNode[];
  textColor: string;
  onClick?: (from: string, to: string) => void;
}

const DiagramConnection: React.FC<Props> = ({ connection, nodes, textColor, onClick }) => {
  const source = nodes.find((n) => n.id === connection.from);
  const target = nodes.find((n) => n.id === connection.to);
  if (!source || !target) return null;

  const connType = connection.type || 'sync';
  const style = CONNECTION_STYLES[connType] || CONNECTION_STYLES.sync;

  const sx = source.x + NODE_WIDTH / 2;
  const sy = source.y + NODE_HEIGHT / 2;
  const tx = target.x + NODE_WIDTH / 2;
  const ty = target.y + NODE_HEIGHT / 2;

  const angle = Math.atan2(ty - sy, tx - sx);
  const startX = sx + Math.cos(angle) * (NODE_WIDTH / 2);
  const startY = sy + Math.sin(angle) * (NODE_HEIGHT / 2);
  const endX = tx - Math.cos(angle) * (NODE_WIDTH / 2);
  const endY = ty - Math.sin(angle) * (NODE_HEIGHT / 2);

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy + 1);
  const offset = Math.min(30, dist * 0.15);
  const cpX = midX - (dy / dist) * offset;
  const cpY = midY + (dx / dist) * offset;

  const pathD = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;
  const markerId = `arrowhead-${connType}`;

  return (
    <g className="diagram-connection" onDoubleClick={() => { console.log("[Connection] Double-clicked:", connection.from, "→", connection.to); onClick?.(connection.from, connection.to); }} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <defs>
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={style.stroke} opacity="0.8" />
        </marker>
      </defs>
      {/* Wider invisible hit area for easier clicking */}
      <path
        d={pathD}
        stroke="transparent"
        strokeWidth="12"
        fill="none"
      />
      <path
        d={pathD}
        stroke={style.stroke}
        strokeWidth="1.5"
        strokeDasharray={style.dasharray}
        fill="none"
        opacity="0.7"
        markerEnd={`url(#${markerId})`}
      />
      {connection.label && (
        <text
          x={cpX}
          y={cpY - 8}
          textAnchor="middle"
          fill={textColor}
          fontSize="11"
          opacity="0.8"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {connection.label}
        </text>
      )}
    </g>
  );
};

export default DiagramConnection;
