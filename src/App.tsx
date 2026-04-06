import { useState, useRef, useCallback, useEffect } from 'react';
import YamlEditor from './components/diagram/YamlEditor';
import DiagramCanvas from './components/diagram/DiagramCanvas';
import Toolbar from './components/diagram/Toolbar';
import InterviewSetup from './components/interview/InterviewSetup';
import InterviewerModal from './components/interview/InterviewerModal';
import SettingsPage from './components/settings/SettingsPage';
import { parseYaml } from './utils/yamlParser';
import { gridLayout, tieredLayout } from './utils/layoutEngine';
import { exportSvgToFile, copyYamlToClipboard } from './utils/exportSvg';
import { useSettings } from './hooks/useSettings';
import { useInterview } from './hooks/useInterview';
import { useCanvasMonitor } from './hooks/useCanvasMonitor';
import { buildSummaryFromState } from './services/interview/SummaryBuilder';
import { getMonologueLevel, buildNudgeMessage } from './services/interview/MonologueDetector';
import type { DiagramData, Theme, NodeType, ConnectionType } from './types/diagram';
import { DEFAULT_YAML } from './types/diagram';
import './App.css';

interface StrokeData {
  points: number[][];
  color: string;
  size: number;
}

interface SavedDiagram {
  id: string;
  name: string;
  yaml: string;
  notes: string;
  lastModified: number;
  positions?: Record<string, { x: number; y: number }>;
  strokes?: StrokeData[];
}

const STORAGE_KEY = 'sysdesign-diagrams';
const ACTIVE_KEY = 'sysdesign-active';

function loadDiagrams(): SavedDiagram[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveDiagrams(diagrams: SavedDiagram[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diagrams));
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function App() {
  // Settings & Interview hooks
  const { settings, updateSettings } = useSettings();
  const [interview, interviewActions] = useInterview(settings);
  const [showSettings, setShowSettings] = useState(false);
  const [modalExpanded, setModalExpanded] = useState(false);
  const [diagrams, setDiagrams] = useState<SavedDiagram[]>(() => {
    const saved = loadDiagrams();
    if (saved.length > 0) return saved;
    return [{ id: newId(), name: 'My Design', yaml: DEFAULT_YAML, notes: '', lastModified: Date.now() }];
  });

  const [activeId, setActiveId] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_KEY);
    const ids = loadDiagrams().map((d) => d.id);
    if (saved && ids.includes(saved)) return saved;
    return diagrams[0].id;
  });

  const activeDiagram = diagrams.find((d) => d.id === activeId) || diagrams[0];
  const yaml = activeDiagram.yaml;
  const notes = activeDiagram.notes || '';
  const strokes = activeDiagram.strokes || [];

  const [diagram, setDiagram] = useState<DiagramData>({ nodes: [], connections: [] });
  const [parseError, setParseError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [highlightLines, setHighlightLines] = useState<{ start: number; end: number } | null>(null);
  const [flashLines, setFlashLines] = useState<{ start: number; end: number } | null>(null);
  const [editorTab, setEditorTab] = useState<'yaml' | 'notes'>('yaml');
  const [drawMode, setDrawMode] = useState<'none' | 'pencil' | 'eraser' | 'laser'>('none');
  const [penColor, setPenColor] = useState('#e0e0e0');
  const [panelWidth, setPanelWidth] = useState(360);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const isResizing = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const initialLayoutDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo/redo stacks for drawing strokes
  const undoStack = useRef<StrokeData[][]>([]);
  const redoStack = useRef<StrokeData[][]>([]);

  // Canvas monitor — sends YAML/notes/image to AI during interview
  const isInterviewActive = interview.state === 'active';
  useCanvasMonitor({
    yaml,
    notes,
    svgRef,
    enabled: isInterviewActive && settings.canvasSharing,
    intervalMs: settings.canvasUpdateInterval,
    imageEnabled: settings.canvasImageSharing,
    onYamlUpdate: (yamlText) => interviewActions.sendCanvasUpdate(yamlText, notes),
    onNotesUpdate: (notesText) => interviewActions.sendCanvasUpdate(yaml, notesText),
    onImageUpdate: (jpegData) => interviewActions.sendCanvasImage(jpegData),
  });

  // Summary builder — generates and injects interview summary every 5 min
  const lastSummaryRef = useRef(0);
  useEffect(() => {
    if (!isInterviewActive || !interview.config) return;
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastSummaryRef.current < 5 * 60 * 1000) return; // Only every 5 min
      lastSummaryRef.current = now;

      const summary = buildSummaryFromState(
        interview.config!.question,
        interview.transcript,
        yaml,
        now - interview.elapsedSeconds * 1000,
      );
      interviewActions.sendSummary(summary);
    }, 30_000); // Check every 30s
    return () => clearInterval(interval);
  }, [isInterviewActive, interview.config, interview.transcript, yaml, interview.elapsedSeconds, interviewActions]);

  // Monologue nudge — inject text when candidate speaks too long
  const lastNudgeRef = useRef(0);
  useEffect(() => {
    if (!isInterviewActive) return;
    const level = getMonologueLevel(interview.monologueSeconds);
    if (level === 'warn' || level === 'critical') {
      const now = Date.now();
      if (now - lastNudgeRef.current > 120_000) { // Max one nudge every 2 min
        const nudge = buildNudgeMessage(interview.monologueSeconds);
        if (nudge) {
          interviewActions.sendCanvasUpdate(nudge, '');
          lastNudgeRef.current = now;
        }
      }
    }
  }, [isInterviewActive, interview.monologueSeconds, interviewActions]);

  const updateStrokes = useCallback((newStrokes: StrokeData[]) => {
    undoStack.current.push([...strokes]);
    redoStack.current = []; // Clear redo on new action
    setDiagrams(prev => prev.map(d =>
      d.id === activeId ? { ...d, strokes: newStrokes } : d
    ));
  }, [strokes, activeId, setDiagrams]);

  const undoStroke = useCallback(() => {
    if (undoStack.current.length === 0) return;
    redoStack.current.push([...strokes]);
    const prev = undoStack.current.pop()!;
    setDiagrams(p => p.map(d =>
      d.id === activeId ? { ...d, strokes: prev } : d
    ));
  }, [strokes, activeId, setDiagrams]);

  const redoStroke = useCallback(() => {
    if (redoStack.current.length === 0) return;
    undoStack.current.push([...strokes]);
    const next = redoStack.current.pop()!;
    setDiagrams(p => p.map(d =>
      d.id === activeId ? { ...d, strokes: next } : d
    ));
  }, [strokes, activeId, setDiagrams]);

  // Reset undo/redo when switching diagrams
  useEffect(() => {
    undoStack.current = [];
    redoStack.current = [];
  }, [activeId]);

  // Keyboard shortcut: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (only for drawing, not when editing text)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input, textarea, contentEditable, or CodeMirror
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable ||
        (e.target as HTMLElement)?.closest('.cm-editor');
      if (isEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoStroke();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoStroke();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStroke, redoStroke]);

  // Persist active tab
  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  // Debounced auto-save
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDiagrams(diagrams);
    }, 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [diagrams]);

  // Sync node positions back to the diagram record so they persist
  useEffect(() => {
    if (diagram.nodes.length === 0) return;
    const positions: Record<string, { x: number; y: number }> = {};
    diagram.nodes.forEach(n => { positions[n.id] = { x: n.x, y: n.y }; });
    setDiagrams(prev => prev.map(d =>
      d.id === activeId ? { ...d, positions } : d
    ));
  }, [diagram.nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Parse YAML whenever it changes
  useEffect(() => {
    const { data, error } = parseYaml(yaml);
    setParseError(error);
    if (data) {
      setDiagram((prev) => {
        // Use saved positions from the diagram if available (tab switch), else from prev state
        const savedPositions = activeDiagram.positions || {};
        const posMap = new Map<string, { x: number; y: number }>();

        if (initialLayoutDone.current) {
          // Normal editing — preserve current positions
          prev.nodes.forEach(n => posMap.set(n.id, { x: n.x, y: n.y }));
        }
        // Overlay saved positions (from tab switch)
        Object.entries(savedPositions).forEach(([id, pos]) => posMap.set(id, pos));

        const hasNewNodes = data.nodes.some((n) => !posMap.has(n.id));

        let nodes = data.nodes.map((n) => {
          const existing = posMap.get(n.id);
          return existing ? { ...n, x: existing.x, y: existing.y } : n;
        });

        if (!initialLayoutDone.current) {
          // First load or tab switch — use saved positions if we have them, otherwise do layout
          if (Object.keys(savedPositions).length > 0) {
            // We already applied saved positions above
          } else {
            nodes = tieredLayout(nodes, 800);
          }
          initialLayoutDone.current = true;
        } else if (hasNewNodes) {
          const existingNodes = nodes.filter((n) => posMap.has(n.id));
          const avgX = existingNodes.length > 0
            ? existingNodes.reduce((s, n) => s + n.x, 0) / existingNodes.length
            : 400;
          const avgY = existingNodes.length > 0
            ? existingNodes.reduce((s, n) => s + n.y, 0) / existingNodes.length
            : 300;
          nodes = nodes.map((n) =>
            n.x === 0 && n.y === 0 && !posMap.has(n.id)
              ? { ...n, x: avgX + (Math.random() - 0.5) * 200, y: avgY + (Math.random() - 0.5) * 150 }
              : n
          );
        }

        return { nodes, connections: data.connections };
      });
    }
  }, [yaml]);

  const setYaml = useCallback((newYaml: string) => {
    setDiagrams((prev) =>
      prev.map((d) =>
        d.id === activeId ? { ...d, yaml: newYaml, lastModified: Date.now() } : d
      )
    );
  }, [activeId]);

  const setNotes = useCallback((newNotes: string) => {
    setDiagrams((prev) =>
      prev.map((d) =>
        d.id === activeId ? { ...d, notes: newNotes, lastModified: Date.now() } : d
      )
    );
  }, [activeId]);

  const handleNewDiagram = useCallback(() => {
    const id = newId();
    setDiagrams((prev) => {
      const name = `Diagram ${prev.length + 1}`;
      return [...prev, { id, name, yaml: DEFAULT_YAML, notes: '', lastModified: Date.now() }];
    });
    setActiveId(id);
    initialLayoutDone.current = false;
  }, []);

  const handleDeleteDiagram = useCallback((id: string) => {
    setDiagrams((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((d) => d.id !== id);
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
    initialLayoutDone.current = false;
  }, [activeId]);

  // Save current diagram's positions and drawing before switching
  const saveCurrentDiagramState = useCallback(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    diagram.nodes.forEach(n => { positions[n.id] = { x: n.x, y: n.y }; });
    setDiagrams(prev => prev.map(d =>
      d.id === activeId ? { ...d, positions } : d
    ));
  }, [activeId, diagram.nodes]);

  const handleSelectTab = useCallback((id: string) => {
    if (id === activeId) return;
    saveCurrentDiagramState();
    setActiveId(id);
    initialLayoutDone.current = false;
  }, [activeId, saveCurrentDiagramState]);

  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleStartRename = useCallback((id: string, currentName: string) => {
    setRenamingTabId(id);
    setRenameValue(currentName);
  }, []);

  const handleFinishRename = useCallback(() => {
    if (renamingTabId && renameValue.trim()) {
      setDiagrams((prev) =>
        prev.map((d) =>
          d.id === renamingTabId ? { ...d, name: renameValue.trim() } : d
        )
      );
    }
    setRenamingTabId(null);
  }, [renamingTabId, renameValue]);

  const handleNodeMove = useCallback((id: string, x: number, y: number) => {
    setDiagram((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
  }, []);

  const handleAutoLayout = useCallback((mode: 'grid' | 'tiered') => {
    setDiagram((prev) => {
      let nodes: typeof prev.nodes;
      switch (mode) {
        case 'grid':
          nodes = gridLayout(prev.nodes, 800);
          break;
        case 'tiered':
        default:
          nodes = tieredLayout(prev.nodes, 800);
          break;
      }
      return { ...prev, nodes };
    });
  }, []);

  const handleExportSvg = useCallback(() => {
    if (svgRef.current) exportSvgToFile(svgRef.current);
  }, []);

  const handleCopyYaml = useCallback(() => {
    copyYamlToClipboard(yaml).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  }, [yaml]);

  // Find YAML line range for a node by id
  const findNodeLines = useCallback((nodeId: string): { start: number; end: number } | null => {
    const lines = yaml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.match(new RegExp(`^-?\\s*id:\\s*${nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`))) {
        // Found the id line, now find the block boundaries
        // Walk backward to find the "- id:" start if id is not on the dash line
        let blockStart = i;
        for (let j = i - 1; j >= 0; j--) {
          if (lines[j].trim().startsWith('- ')) { blockStart = j; break; }
          if (!lines[j].trim().startsWith('') || lines[j].trim() === '' || lines[j].trim().startsWith('nodes:') || lines[j].trim().startsWith('connections:')) break;
        }
        if (lines[i].trim().startsWith('- ')) blockStart = i;
        // Walk forward to find block end
        let blockEnd = blockStart;
        for (let j = blockStart + 1; j < lines.length; j++) {
          const t = lines[j].trim();
          if (t === '' || t.startsWith('- ') || t === 'nodes:' || t === 'connections:') break;
          blockEnd = j;
        }
        return { start: blockStart, end: blockEnd };
      }
    }
    return null;
  }, [yaml]);

  // Find YAML line range for a connection by from/to
  const findConnectionLines = useCallback((from: string, to: string): { start: number; end: number } | null => {
    const lines = yaml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.match(new RegExp(`^-?\\s*from:\\s*${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`))) {
        // Check if next few lines have matching "to:"
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          if (lines[j].trim().match(new RegExp(`^to:\\s*${to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`))) {
            let blockStart = i;
            if (lines[i].trim().startsWith('- ')) blockStart = i;
            else {
              for (let k = i - 1; k >= 0; k--) {
                if (lines[k].trim().startsWith('- ')) { blockStart = k; break; }
                if (lines[k].trim() === '' || lines[k].trim().startsWith('connections:')) break;
              }
            }
            let blockEnd = j;
            for (let k = j + 1; k < lines.length; k++) {
              const t = lines[k].trim();
              if (t === '' || t.startsWith('- ') || t === 'nodes:' || t === 'connections:') break;
              blockEnd = k;
            }
            return { start: blockStart, end: blockEnd };
          }
        }
      }
    }
    return null;
  }, [yaml]);

  const handleNodeClick = useCallback((id: string) => {
    const range = findNodeLines(id);
    setHighlightLines(range);
  }, [findNodeLines]);

  const handleConnectionClick = useCallback((from: string, to: string) => {
    const range = findConnectionLines(from, to);
    setHighlightLines(range);
  }, [findConnectionLines]);

  const handleAddNode = useCallback((type: NodeType) => {
    const lines = yaml.split('\n');
    // Find the "connections:" line
    let connectionsIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === 'connections:') {
        connectionsIdx = i;
        break;
      }
    }
    const newId = `${type}${Date.now().toString(36).slice(-4)}`;
    const nodeLines = [
      `  - id: ${newId}`,
      `    label: New ${type}`,
      `    type: ${type}`,
    ];

    if (connectionsIdx >= 0) {
      // Insert before connections: with a blank line separator
      // Check if there's already a blank line before connections:
      const hasBlankBefore = connectionsIdx > 0 && lines[connectionsIdx - 1].trim() === '';
      const insertAt = hasBlankBefore ? connectionsIdx - 1 : connectionsIdx;
      const toInsert = hasBlankBefore
        ? [...nodeLines, '']
        : ['', ...nodeLines, ''];
      lines.splice(insertAt, 0, ...toInsert);
    } else {
      // No connections section — just append
      lines.push('', ...nodeLines);
    }

    const newYaml = lines.join('\n');
    setYaml(newYaml);
    // Flash the new lines
    const newLines = newYaml.split('\n');
    const startLine = newLines.findIndex(l => l.includes(`id: ${newId}`));
    if (startLine >= 0) {
      setFlashLines({ start: startLine, end: startLine + 2 });
    }
  }, [yaml, setYaml]);

  const handleAddConnection = useCallback((type: ConnectionType) => {
    const lines = yaml.split('\n');
    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    // Add blank line separator + new connection entry
    const insertStart = lines.length + 1; // after the blank line
    const connLines = [
      '',
      `  - from: source`,
      `    to: target`,
      `    label: connection`,
      `    type: ${type}`,
    ];
    lines.push(...connLines, '');
    const newYaml = lines.join('\n');
    setYaml(newYaml);
    // Flash the newly added lines (skip the blank line, flash the 4 content lines)
    setFlashLines({ start: insertStart, end: insertStart + 3 });
  }, [yaml, setYaml]);

  return (
    <div className={`app-container theme-${theme}`}>
      <header className="app-header">
        <h1>System Design Interviewer 🎤</h1>
        <div className="header-actions">
          <Toolbar
            theme={theme}
            onThemeChange={setTheme}
            onAutoLayout={handleAutoLayout}
            onExportSvg={handleExportSvg}
            onCopyYaml={handleCopyYaml}
          />
          <div className="header-separator" />
          <button
            className="toolbar-btn toolbar-btn-interview"
            onClick={interviewActions.startSetup}
            disabled={interview.state !== 'idle'}
            title={!settings.geminiApiKey ? 'Set up API key in Settings first' : 'Start a mock interview'}
          >
            🎤 Interview
          </button>
          <button
            className="toolbar-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>
      <div className="tab-bar">
        {diagrams.map((d) => (
          <div
            key={d.id}
            className={`tab ${d.id === activeId ? 'tab-active' : ''}`}
            onClick={() => handleSelectTab(d.id)}
            onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(d.id, d.name); }}
          >
            {renamingTabId === d.id ? (
              <input
                className="tab-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishRename();
                  if (e.key === 'Escape') setRenamingTabId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="tab-name">{d.name}</span>
            )}
            {diagrams.length > 1 && renamingTabId !== d.id && (
              <button
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); handleDeleteDiagram(d.id); }}
                title="Close tab"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className="tab-add" onClick={handleNewDiagram} title="New diagram">
          +
        </button>
        <div className="tab-bar-spacer" />
        <div className="draw-tools">
          <button
            className={`draw-btn ${drawMode === 'laser' ? 'draw-btn-active' : ''}`}
            onClick={() => setDrawMode(drawMode === 'laser' ? 'none' : 'laser')}
            title="Laser pointer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="2" y1="22" x2="16" y2="8"/>
              <circle cx="18" cy="6" r="3" fill="#ff2222" stroke="none"/>
              <line x1="18" y1="2" x2="18" y2="0" opacity="0.5"/>
              <line x1="22" y1="6" x2="24" y2="6" opacity="0.5"/>
              <line x1="21" y1="3" x2="22.5" y2="1.5" opacity="0.5"/>
            </svg>
          </button>
          <div className="draw-btn-wrapper">
            <button
              className={`draw-btn ${drawMode === 'pencil' ? 'draw-btn-active' : ''}`}
              onClick={() => setDrawMode(drawMode === 'pencil' ? 'none' : 'pencil')}
              title="Draw (pencil)"
              style={{ borderBottomColor: drawMode === 'pencil' ? penColor : undefined }}
            >
              ✏️
            </button>
            <div className="color-picker-popup">
              {['#e0e0e0', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'].map(c => (
                <button
                  key={c}
                  className={`color-dot ${penColor === c ? 'color-dot-active' : ''}`}
                  style={{ background: c }}
                  onClick={(e) => { e.stopPropagation(); setPenColor(c); setDrawMode('pencil'); }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <button
            className={`draw-btn ${drawMode === 'eraser' ? 'draw-btn-active' : ''}`}
            onClick={() => setDrawMode(drawMode === 'eraser' ? 'none' : 'eraser')}
            title="Erase drawing"
          >
            🧹
          </button>
          <button
            className="draw-btn"
            onClick={() => {
              updateStrokes([]);
            }}
            title="Clear all drawings"
          >
            🗑️
          </button>
        </div>
      </div>
      <main className="app-main">
        {!panelCollapsed && (
          <div className="editor-wrapper" style={{ width: panelWidth }}>
            <YamlEditor value={yaml} onChange={setYaml} error={parseError} highlightLines={highlightLines} flashLines={flashLines} onAddNode={handleAddNode} onAddConnection={handleAddConnection} notes={notes} onNotesChange={setNotes} activeEditorTab={editorTab} onEditorTabChange={setEditorTab} />
            <div
              className="resize-handle"
              onPointerDown={(e) => {
                e.preventDefault();
                isResizing.current = true;
                const startX = e.clientX;
                const startWidth = panelWidth;
                const handleMove = (me: PointerEvent) => {
                  if (!isResizing.current) return;
                  const newWidth = startWidth + (me.clientX - startX);
                  if (newWidth < 150) {
                    setPanelCollapsed(true);
                    isResizing.current = false;
                  } else {
                    setPanelWidth(Math.max(200, Math.min(700, newWidth)));
                  }
                };
                const handleUp = () => {
                  isResizing.current = false;
                  window.removeEventListener('pointermove', handleMove);
                  window.removeEventListener('pointerup', handleUp);
                };
                window.addEventListener('pointermove', handleMove);
                window.addEventListener('pointerup', handleUp);
              }}
            />
          </div>
        )}
        {panelCollapsed && (
          <button
            className="panel-expand-btn"
            onClick={() => setPanelCollapsed(false)}
            title="Show editor panel"
          >
            ☰
          </button>
        )}
        <DiagramCanvas
          data={diagram}
          theme={theme}
          onNodeMove={handleNodeMove}
          onNodeClick={handleNodeClick}
          onConnectionClick={handleConnectionClick}
          svgRef={svgRef}
          drawMode={drawMode}
          penColor={penColor}
          activeDiagramId={activeId}
          strokes={strokes}
          onStrokesChange={updateStrokes}
        />
      </main>
      {copyFeedback && <div className="copy-toast">📋 YAML copied to clipboard!</div>}

      {/* Interview Setup Dialog */}
      {interview.state === 'setup' && (
        <InterviewSetup
          settings={settings}
          onStart={interviewActions.beginInterview}
          onCancel={interviewActions.cancelSetup}
        />
      )}

      {/* Interviewer Modal (visible during active interview) */}
      {(interview.state === 'connecting' || interview.state === 'active' || interview.state === 'paused' || interview.state === 'reconnecting') && (
        <InterviewerModal
          status={interview.status}
          subtitle={interview.subtitle}
          elapsedSeconds={interview.elapsedSeconds}
          durationMinutes={interview.config?.duration || 50}
          tokenUsage={interview.tokenUsage}
          isRecording={interview.isRecording}
          isMuted={interview.isMuted}
          monologueSeconds={interview.monologueSeconds}
          canvasSyncAgo={interview.canvasSyncAgo}
          sessionResumeCount={interview.sessionResumeCount}
          expanded={modalExpanded}
          onToggleExpanded={() => setModalExpanded(!modalExpanded)}
          onPause={interviewActions.pause}
          onResume={interviewActions.resume}
          onMuteToggle={interviewActions.toggleMute}
          onEnd={interviewActions.endInterview}
          isPaused={interview.state === 'paused'}
        />
      )}

      {/* Settings Page */}
      {showSettings && (
        <SettingsPage
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
