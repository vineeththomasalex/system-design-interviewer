/**
 * Interview history — save/load/delete past interviews in localStorage.
 */

import type { InterviewConfig, TranscriptEntry, TokenUsage } from '../types/interview';

export interface SavedInterview {
  id: string;
  timestamp: number;
  config: InterviewConfig;
  transcript: TranscriptEntry[];
  tokenUsage: TokenUsage;
  elapsedSeconds: number;
  summary: string;
}

const HISTORY_KEY = 'sdi-interview-history';
const MAX_HISTORY = 50;

export function loadInterviewHistory(): SavedInterview[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveHistory(history: SavedInterview[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function saveInterview(interview: Omit<SavedInterview, 'id' | 'timestamp'>): SavedInterview {
  const history = loadInterviewHistory();
  const saved: SavedInterview = {
    ...interview,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
  };
  history.unshift(saved); // newest first
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  saveHistory(history);
  return saved;
}

export function deleteInterview(id: string): void {
  const history = loadInterviewHistory().filter(h => h.id !== id);
  saveHistory(history);
}

export function clearInterviewHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
