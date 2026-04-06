import { useCallback } from 'react';
import type { AIStatus, TokenUsage } from '../../types/interview';

interface Props {
  status: AIStatus;
  subtitle: string;
  elapsedSeconds: number;
  durationMinutes: number;
  tokenUsage: TokenUsage;
  isRecording: boolean;
  isMuted: boolean;
  monologueSeconds: number;
  canvasSyncAgo: number;
  sessionResumeCount: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onPause: () => void;
  onResume: () => void;
  onMuteToggle: () => void;
  onEnd: () => void;
  isPaused: boolean;
}

// --- Helpers ---

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

function estimateCost(usage: TokenUsage): string {
  const inputCost = (usage.inputTokens / 1_000_000) * 0.75;
  const outputCost = (usage.outputTokens / 1_000_000) * 4.5;
  return `$${(inputCost + outputCost).toFixed(2)}`;
}

const STATUS_LABELS: Record<AIStatus, string> = {
  connecting: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  disconnected: 'Disconnected',
  paused: 'Paused',
  reconnecting: 'Reconnecting…',
};

const STATUS_DOT_CLASS: Record<AIStatus, string> = {
  listening: 'dot-listening',
  thinking: 'dot-thinking',
  speaking: 'dot-speaking',
  disconnected: 'dot-disconnected',
  paused: 'dot-paused',
  reconnecting: 'dot-reconnecting',
  connecting: 'dot-connecting',
};

function monologueLevel(seconds: number): 'none' | 'info' | 'warn' | 'danger' {
  if (seconds > 420) return 'danger';
  if (seconds > 300) return 'warn';
  if (seconds > 180) return 'info';
  return 'none';
}

// --- Component ---

export default function InterviewerModal({
  status,
  subtitle,
  elapsedSeconds,
  durationMinutes,
  tokenUsage,
  isRecording,
  isMuted,
  monologueSeconds,
  canvasSyncAgo,
  sessionResumeCount,
  expanded,
  onToggleExpanded,
  onPause,
  onResume,
  onMuteToggle,
  onEnd,
  isPaused,
}: Props) {
  const monoLevel = monologueLevel(monologueSeconds);

  const truncatedSubtitle = useCallback(
    (text: string) => (text.length > 200 ? text.slice(0, 197) + '…' : text),
    [],
  );

  const modalClass = [
    'interviewer-modal',
    expanded ? 'interviewer-modal-expanded' : '',
    monoLevel !== 'none' ? `modal-monologue-warning mono-${monoLevel}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={modalClass}>
      {/* Row 1: Status */}
      <div className="modal-status-row">
        <span className={`modal-status-dot ${STATUS_DOT_CLASS[status]}`} />
        <span className="modal-status-label">{STATUS_LABELS[status]}</span>

        <button
          className="modal-btn-icon"
          onClick={onToggleExpanded}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▲' : '▼'}
        </button>
        <button className="modal-btn-icon modal-btn-close" onClick={onEnd} title="End interview">
          ✕
        </button>
      </div>

      {/* Row 2: Subtitle */}
      <div className="modal-subtitle">{truncatedSubtitle(subtitle)}</div>

      {/* Row 3: Controls */}
      <div className="modal-controls">
        {isPaused ? (
          <button className="modal-btn" onClick={onResume} title="Resume">
            ▶️
          </button>
        ) : (
          <button className="modal-btn" onClick={onPause} title="Pause">
            ⏸️
          </button>
        )}
        <button className="modal-btn" onClick={onMuteToggle} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? '🔇' : '🎙️'}
        </button>
        <button className="modal-btn modal-btn-end" onClick={onEnd} title="End">
          ⏹️
        </button>
      </div>

      {/* Monologue warning text */}
      {monoLevel === 'warn' && (
        <div className="modal-mono-text">Pause to let interviewer respond</div>
      )}
      {monoLevel === 'danger' && (
        <div className="modal-mono-text danger">Pause to let interviewer respond</div>
      )}

      {/* Expanded stats */}
      {expanded && (
        <div className="modal-stats">
          <div>⏱️ {formatTime(elapsedSeconds)} / {formatTime(durationMinutes * 60)}</div>
          <div>
            📊 Canvas sync: {canvasSyncAgo}s ago {canvasSyncAgo > 60 ? '⚠️' : '✅'}
          </div>
          <div>
            ⚡ Tokens: {formatTokens(tokenUsage.inputTokens)} in /{' '}
            {formatTokens(tokenUsage.outputTokens)} out
          </div>
          <div>💰 Est. cost: {estimateCost(tokenUsage)}</div>
          <div>🎤 Recording: {isRecording ? 'ON' : 'OFF'}</div>
          <div>🔗 Session: resumed {sessionResumeCount}x</div>
        </div>
      )}
    </div>
  );
}
