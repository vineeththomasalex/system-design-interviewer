import React, { useState } from 'react';
import { NODE_COLORS, NODE_ICONS, CONNECTION_STYLES, type NodeType, type ConnectionType } from '../../types/diagram';

const connTypes = Object.keys(CONNECTION_STYLES) as ConnectionType[];

// Node types grouped by tier for the reference panel
const NODE_TIERS: { label: string; types: NodeType[] }[] = [
  { label: 'Clients & External', types: ['client', 'cdn', 'dns', 'external'] },
  { label: 'Ingress & Security', types: ['loadbalancer', 'gateway', 'firewall'] },
  { label: 'Application', types: ['service', 'worker', 'scheduler', 'cache'] },
  { label: 'Async & Eventing', types: ['queue', 'stream', 'notification'] },
  { label: 'Intelligence', types: ['search', 'analytics', 'ml'] },
  { label: 'Data & Storage', types: ['database', 'nosql', 'storage'] },
];

interface Props {
  onAddNode?: (type: NodeType) => void;
  onAddConnection?: (type: ConnectionType) => void;
}

const ReferencePanel: React.FC<Props> = ({ onAddNode, onAddConnection }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="reference-panel">
      <button
        className="reference-toggle"
        onClick={() => setCollapsed(!collapsed)}
      >
        📖 Reference {collapsed ? '▸' : '▾'}
      </button>
      {!collapsed && (
        <div className="reference-content">
          <div className="reference-section">
            <div className="reference-section-title">Node Types <span className="reference-hint">click to add</span></div>
            {NODE_TIERS.map((tier, tierIdx) => (
              <React.Fragment key={tier.label}>
                {tierIdx > 0 && <div className="reference-tier-divider" />}
                <div className="reference-grid">
                  {tier.types.map((t) => (
                    <div
                      key={t}
                      className="reference-item reference-item-clickable"
                      onClick={() => onAddNode?.(t)}
                      title={`Add ${t} node`}
                    >
                      <span
                        className="reference-dot"
                        style={{ background: NODE_COLORS[t] }}
                      />
                      <span className="reference-icon">{NODE_ICONS[t]}</span>
                      <span className="reference-type">{t}</span>
                    </div>
                  ))}
                </div>
              </React.Fragment>
            ))}
          </div>
          <div className="reference-section">
            <div className="reference-section-title">Connection Types <span className="reference-hint">click to add</span></div>
            <div className="reference-conn-list">
              {connTypes.map((ct) => {
                const s = CONNECTION_STYLES[ct];
                return (
                  <div
                    key={ct}
                    className="reference-conn-item reference-item-clickable"
                    onClick={() => onAddConnection?.(ct)}
                    title={`Add ${ct} connection`}
                  >
                    <svg width="40" height="12" viewBox="0 0 40 12">
                      <line
                        x1="0" y1="6" x2="40" y2="6"
                        stroke={s.stroke}
                        strokeWidth="2"
                        strokeDasharray={s.dasharray}
                      />
                    </svg>
                    <span className="reference-conn-label" style={{ color: s.stroke }}>
                      {ct}
                    </span>
                    <span className="reference-conn-desc">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferencePanel;
