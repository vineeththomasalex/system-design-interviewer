import { useState } from 'react';
import type { TranscriptEntry, TokenUsage, InterviewConfig } from '../../types/interview';
import TranscriptViewer from './TranscriptViewer';

interface Props {
  transcript: TranscriptEntry[];
  tokenUsage: TokenUsage;
  elapsedSeconds: number;
  summary: string;
  config: InterviewConfig;
  onDismiss: () => void;
  onExport: () => void;
}

type ReportTab = 'transcript' | 'summary';

// --- Helpers (same logic as InterviewerModal) ---

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

const DIFFICULTY_EMOJI: Record<string, string> = {
  Easy: '🟢',
  Medium: '🟡',
  Hard: '🔴',
};

export default function InterviewReport({
  transcript,
  tokenUsage,
  elapsedSeconds,
  summary,
  config,
  onDismiss,
  onExport,
}: Props) {
  const [activeTab, setActiveTab] = useState<ReportTab>('transcript');

  return (
    <div className="report-overlay">
      <div className="report-dialog">
        {/* Header */}
        <div className="report-header">
          <h2>Interview Report — {config.question}</h2>
          <div className="report-header-actions">
            <button onClick={onExport} title="Export as Markdown">
              📥 Export
            </button>
            <button onClick={onDismiss} title="Close report">
              ✕
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="report-stats">
          <div className="report-stat-card">
            <span className="report-stat-label">Duration</span>
            <span className="report-stat-value">⏱️ {formatTime(elapsedSeconds)}</span>
          </div>
          <div className="report-stat-card">
            <span className="report-stat-label">Total Tokens</span>
            <span className="report-stat-value">📊 {formatTokens(tokenUsage.totalTokens)}</span>
          </div>
          <div className="report-stat-card">
            <span className="report-stat-label">Est. Cost</span>
            <span className="report-stat-value">💰 {estimateCost(tokenUsage)}</span>
          </div>
          <div className="report-stat-card">
            <span className="report-stat-label">Difficulty</span>
            <span className="report-stat-value">
              {DIFFICULTY_EMOJI[config.difficulty] ?? '⚪'} {config.difficulty}
            </span>
          </div>
        </div>

        {/* Assessment placeholder */}
        <div className="report-assessment">
          Assessment will appear here after AI debrief is implemented.
        </div>

        {/* Tabs */}
        <div className="report-tabs">
          <button
            className={`report-tab ${activeTab === 'transcript' ? 'report-tab-active' : ''}`}
            onClick={() => setActiveTab('transcript')}
          >
            Transcript
          </button>
          <button
            className={`report-tab ${activeTab === 'summary' ? 'report-tab-active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
        </div>

        {/* Body */}
        <div className="report-body">
          {activeTab === 'transcript' && <TranscriptViewer transcript={transcript} />}
          {activeTab === 'summary' && (
            <pre className="report-summary-block">{summary || 'No summary available.'}</pre>
          )}
        </div>

        {/* Footer */}
        <div className="report-footer">
          <button onClick={onExport}>📥 Export as Markdown</button>
          <button onClick={onDismiss}>Close</button>
        </div>
      </div>
    </div>
  );
}
