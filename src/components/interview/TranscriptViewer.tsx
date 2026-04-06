import { useState, useEffect, useRef } from 'react';
import type { TranscriptEntry } from '../../types/interview';

interface Props {
  transcript: TranscriptEntry[];
  onClose?: () => void;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SPEAKER_ICON: Record<TranscriptEntry['role'], string> = {
  user: '🧑',
  model: '🤖',
  system: '⚙️',
};

const ENTRY_CLASS: Record<TranscriptEntry['role'], string> = {
  user: 'transcript-entry-user',
  model: 'transcript-entry-model',
  system: 'transcript-entry-system',
};

export default function TranscriptViewer({ transcript, onClose }: Props) {
  const [filter, setFilter] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(transcript.length);

  // Auto-scroll when new entries arrive
  useEffect(() => {
    if (transcript.length > prevLengthRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevLengthRef.current = transcript.length;
  }, [transcript.length]);

  const lowerFilter = filter.toLowerCase();
  const visible = lowerFilter
    ? transcript.filter((e) => e.text.toLowerCase().includes(lowerFilter))
    : transcript;

  return (
    <div className="transcript-viewer">
      <div className="transcript-search">
        <input
          type="text"
          placeholder="Search transcript…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {onClose && (
          <button onClick={onClose} title="Close transcript">
            ✕
          </button>
        )}
      </div>

      <div className="transcript-list" ref={listRef}>
        {visible.map((entry, i) => (
          <div key={i} className={`transcript-entry ${ENTRY_CLASS[entry.role]}`}>
            <span className="transcript-time">{formatTimestamp(entry.timestamp)}</span>
            <span className="transcript-speaker">{SPEAKER_ICON[entry.role]}</span>
            <span className="transcript-text">{entry.text}</span>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="transcript-entry transcript-entry-system">
            <span className="transcript-text">
              {filter ? 'No matching entries.' : 'No transcript entries yet.'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
