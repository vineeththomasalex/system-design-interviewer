import React, { useRef, useCallback, useEffect, useState } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';
import { type NodeType, type ConnectionType } from '../../types/diagram';
import ReferencePanel from './ReferencePanel';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  highlightLines?: { start: number; end: number } | null;
  flashLines?: { start: number; end: number } | null;
  onAddNode?: (type: NodeType) => void;
  onAddConnection?: (type: ConnectionType) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  activeEditorTab: 'yaml' | 'notes';
  onEditorTabChange: (tab: 'yaml' | 'notes') => void;
}

// Dark theme matching the app
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: '#c8d6e5',
    fontSize: '13px',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    caretColor: '#e0e0e0',
    padding: '8px 0',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '1px solid #2a2a3e',
    color: '#4a4a6a',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  '.cm-cursor': {
    borderLeftColor: '#e0e0e0',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(74, 144, 217, 0.35) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(74, 144, 217, 0.35) !important',
  },
  '.cm-line': {
    padding: '0 8px',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
}, { dark: true });

const cmExtensions = [yaml(), darkTheme];

const YamlEditor: React.FC<Props> = ({
  value, onChange, error, highlightLines, flashLines: flashLinesProp,
  onAddNode, onAddConnection, notes, onNotesChange, activeEditorTab, onEditorTabChange,
}) => {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const notesInitialized = useRef(false);
  const [flashLines, setFlashLines] = useState<{ start: number; end: number } | null>(null);

  // Double-click node/connection in diagram → scroll to & select YAML block
  useEffect(() => {
    if (!highlightLines) return;
    onEditorTabChange('yaml');
    setTimeout(() => {
      const view = cmRef.current?.view;
      if (!view) return;
      const doc = view.state.doc;
      const startLine = Math.min(highlightLines.start + 1, doc.lines);
      const endLine = Math.min(highlightLines.end + 1, doc.lines);
      const from = doc.line(startLine).from;
      const to = doc.line(endLine).to;
      view.dispatch({
        selection: { anchor: from, head: to },
        scrollIntoView: true,
      });
      view.focus();
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightLines]);

  // Flash animation for newly added entries
  useEffect(() => {
    if (flashLinesProp) setFlashLines(flashLinesProp);
  }, [flashLinesProp]);

  useEffect(() => {
    if (!flashLines) return;
    const timer = setTimeout(() => setFlashLines(null), 1200);
    return () => clearTimeout(timer);
  }, [flashLines]);

  useEffect(() => {
    if (!flashLines) return;
    const view = cmRef.current?.view;
    if (!view) return;
    const doc = view.state.doc;
    const startLine = Math.min(flashLines.start + 1, doc.lines);
    const from = doc.line(startLine).from;
    view.dispatch({ scrollIntoView: true, selection: { anchor: from } });
  }, [flashLines]);

  // Notes
  useEffect(() => {
    if (activeEditorTab === 'notes' && notesRef.current && !notesInitialized.current) {
      notesRef.current.innerHTML = notes;
      notesInitialized.current = true;
    }
    if (activeEditorTab !== 'notes') {
      notesInitialized.current = false;
    }
  }, [activeEditorTab, notes]);

  const handleNotesInput = useCallback(() => {
    if (notesRef.current) onNotesChange(notesRef.current.innerHTML);
  }, [onNotesChange]);

  const handleNotesKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '7') { e.preventDefault(); document.execCommand('insertOrderedList'); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '8') { e.preventDefault(); document.execCommand('insertUnorderedList'); }
  }, []);

  const handleCmChange = useCallback((val: string) => {
    onChange(val);
  }, [onChange]);

  return (
    <div className="editor-panel">
      <div className="editor-tabs">
        <button
          className={`editor-tab ${activeEditorTab === 'yaml' ? 'editor-tab-active' : ''}`}
          onClick={() => onEditorTabChange('yaml')}
        >
          📝 YAML
        </button>
        <button
          className={`editor-tab ${activeEditorTab === 'notes' ? 'editor-tab-active' : ''}`}
          onClick={() => onEditorTabChange('notes')}
        >
          📓 Notes
        </button>
      </div>
      <div className="editor-body" style={{ display: activeEditorTab === 'yaml' ? 'flex' : 'none' }}>
        <CodeMirror
          ref={cmRef}
          value={value}
          onChange={handleCmChange}
          extensions={cmExtensions}
          theme="none"
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            bracketMatching: false,
            closeBrackets: false,
            autocompletion: false,
            indentOnInput: true,
          }}
          style={{ flex: 1, overflow: 'auto' }}
        />
      </div>
      {activeEditorTab === 'yaml' && error && <div className="editor-error">⚠ {error}</div>}
      {activeEditorTab === 'yaml' && <ReferencePanel onAddNode={onAddNode} onAddConnection={onAddConnection} />}
      <div className="notes-body" style={{ display: activeEditorTab === 'notes' ? 'flex' : 'none' }}>
        <div
          ref={notesRef}
          className="notes-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={handleNotesInput}
          onKeyDown={handleNotesKeyDown}
          data-placeholder="Design notes, trade-offs, assumptions, interview talking points..."
        />
      </div>
    </div>
  );
};

export default YamlEditor;
