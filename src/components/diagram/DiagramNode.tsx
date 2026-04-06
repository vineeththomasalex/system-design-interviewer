import React from 'react';
import { NODE_WIDTH, NODE_HEIGHT, NODE_COLORS, NODE_ICONS, type DiagramNode as DiagramNodeType, type NodeType } from '../../types/diagram';

interface Props {
  node: DiagramNodeType;
  onDragStart: (id: string, e: React.MouseEvent | React.PointerEvent) => void;
  onClick?: (id: string) => void;
  textColor: string;
  interactive?: boolean;
}

const W = NODE_WIDTH;
const H = NODE_HEIGHT;

function getNodeShape(type: NodeType, color: string): React.ReactElement {
  switch (type) {
    // Rounded rect — client, dns, notification, analytics, ml, scheduler
    case 'client':
    case 'dns':
    case 'notification':
    case 'analytics':
    case 'ml':
    case 'scheduler':
      return <rect x="0" y="0" width={W} height={H} rx="14" ry="14" fill={color} />;

    // Cloud shape — cdn
    case 'cdn':
      return (
        <g>
          <ellipse cx={W * 0.35} cy={H * 0.35} rx={W * 0.28} ry={H * 0.3} fill={color} />
          <ellipse cx={W * 0.65} cy={H * 0.3} rx={W * 0.25} ry={H * 0.28} fill={color} />
          <ellipse cx={W * 0.5} cy={H * 0.25} rx={W * 0.2} ry={H * 0.25} fill={color} />
          <rect x={W * 0.1} y={H * 0.35} width={W * 0.8} height={H * 0.45} rx="8" fill={color} />
        </g>
      );

    // Wide/short rect — loadbalancer, gateway
    case 'loadbalancer':
    case 'gateway':
      return <rect x="-10" y="6" width={W + 20} height={H - 12} rx="6" ry="6" fill={color} />;

    // Shield/octagon — firewall
    case 'firewall': {
      const cx = W / 2, topY = 2, botY = H - 2, midY = H * 0.15;
      return (
        <path
          d={`M ${cx} ${topY} L ${W - 4} ${midY} L ${W - 4} ${H * 0.65} L ${cx} ${botY} L 4 ${H * 0.65} L 4 ${midY} Z`}
          fill={color}
        />
      );
    }

    // Standard rect — service, worker, search
    case 'service':
    case 'worker':
    case 'search':
      return <rect x="0" y="0" width={W} height={H} rx="4" ry="4" fill={color} />;

    // Cylinder — database, nosql
    case 'database':
    case 'nosql':
      return (
        <g>
          <rect x="0" y="8" width={W} height={H - 16} fill={color} />
          <ellipse cx={W / 2} cy="8" rx={W / 2} ry="10" fill={color} />
          <ellipse cx={W / 2} cy={H - 8} rx={W / 2} ry="10" fill={color} />
          <rect x="0" y="8" width={W} height={H - 16} fill={color} opacity="0.8" />
          <ellipse cx={W / 2} cy="8" rx={W / 2} ry="10" fill={color} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        </g>
      );

    // Barrel/bucket — storage
    case 'storage':
      return (
        <g>
          <rect x="8" y="6" width={W - 16} height={H - 12} fill={color} />
          <ellipse cx={W / 2} cy="6" rx={W / 2 - 8} ry="8" fill={color} />
          <ellipse cx={W / 2} cy={H - 6} rx={W / 2 - 8} ry="8" fill={color} />
          <rect x="8" y="6" width={W - 16} height={H - 12} fill={color} opacity="0.85" />
          <ellipse cx={W / 2} cy="6" rx={W / 2 - 8} ry="8" fill={color} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <ellipse cx={W / 2} cy={H / 2} rx={W / 2 - 8} ry="6" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        </g>
      );

    // Parallelogram — cache
    case 'cache': {
      const skew = 16;
      return (
        <polygon
          points={`${skew},0 ${W},0 ${W - skew},${H} 0,${H}`}
          fill={color}
        />
      );
    }

    // Hexagon — queue
    case 'queue': {
      const inset = 20;
      return (
        <polygon
          points={`${inset},0 ${W - inset},0 ${W},${H / 2} ${W - inset},${H} ${inset},${H} 0,${H / 2}`}
          fill={color}
        />
      );
    }

    // Parallelogram — stream
    case 'stream': {
      const skew = 16;
      return (
        <polygon
          points={`${skew},0 ${W},0 ${W - skew},${H} 0,${H}`}
          fill={color}
        />
      );
    }

    // Dashed border — external
    case 'external':
      return (
        <rect
          x="0" y="0" width={W} height={H} rx="4" ry="4"
          fill="transparent" stroke={color} strokeWidth="2" strokeDasharray="8 4"
        />
      );

    default:
      return <rect x="0" y="0" width={W} height={H} rx="4" ry="4" fill={color} />;
  }
}

const DiagramNodeComponent: React.FC<Props> = ({ node, onDragStart, onClick, textColor, interactive = true }) => {
  const color = NODE_COLORS[node.type];
  const icon = NODE_ICONS[node.type];
  const isExternal = node.type === 'external';
  const labelColor = isExternal ? textColor : '#fff';

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    // Pen tablet should never drag nodes — pen is for drawing
    if (e.pointerType === 'pen') return;
    onDragStart(node.id, e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!interactive) return;
    e.preventDefault();
    if (onClick) onClick(node.id);
  };

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      style={{ pointerEvents: interactive ? 'auto' : 'none', touchAction: 'none' }}
      className={`diagram-node ${interactive ? 'diagram-node-interactive' : ''}`}
    >
      {getNodeShape(node.type, color)}
      <text
        x={W / 2}
        y={H / 2 - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={labelColor}
        fontSize="13"
        fontWeight="600"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {icon} {node.label}
      </text>
      <text
        x={W / 2}
        y={H / 2 + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={labelColor}
        fontSize="10"
        opacity="0.7"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {node.type}
      </text>
    </g>
  );
};

export default DiagramNodeComponent;
