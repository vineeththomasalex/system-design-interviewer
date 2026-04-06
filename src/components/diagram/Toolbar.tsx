import React from 'react';
import type { Theme } from '../../types/diagram';

interface Props {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onAutoLayout: (mode: 'grid' | 'tiered') => void;
  onExportSvg: () => void;
  onCopyYaml: () => void;
}

const Toolbar: React.FC<Props> = ({ theme, onThemeChange, onAutoLayout, onExportSvg, onCopyYaml }) => {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="toolbar-label">Theme</span>
        <select
          value={theme}
          onChange={(e) => onThemeChange(e.target.value as Theme)}
          className="toolbar-select"
        >
          <option value="dark">🌙 Dark</option>
          <option value="light">☀️ Light</option>
          <option value="blueprint">📘 Blueprint</option>
        </select>
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">Layout</span>
        <button className="toolbar-btn" onClick={() => onAutoLayout('grid')} title="Grid layout">
          ⊞ Grid
        </button>
        <button className="toolbar-btn" onClick={() => onAutoLayout('tiered')} title="Tiered architecture layout">
          🏗️ Tiered
        </button>
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">Export</span>
        <button className="toolbar-btn" onClick={onExportSvg} title="Download as SVG">
          💾 SVG
        </button>
        <button className="toolbar-btn" onClick={onCopyYaml} title="Copy YAML to clipboard">
          📋 YAML
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
