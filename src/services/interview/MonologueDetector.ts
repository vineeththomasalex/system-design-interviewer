/**
 * MonologueDetector — tracks candidate speaking time since the model last spoke.
 * Returns threshold levels for UI indicators and optional auto-nudge.
 */

export type MonologueLevel = 'none' | 'info' | 'warn' | 'critical';

const THRESHOLDS = {
  info: 180,     // 3 minutes
  warn: 300,     // 5 minutes  
  critical: 420, // 7 minutes
};

export function getMonologueLevel(secondsSinceModelSpoke: number): MonologueLevel {
  if (secondsSinceModelSpoke >= THRESHOLDS.critical) return 'critical';
  if (secondsSinceModelSpoke >= THRESHOLDS.warn) return 'warn';
  if (secondsSinceModelSpoke >= THRESHOLDS.info) return 'info';
  return 'none';
}

export function getMonologueMessage(level: MonologueLevel): string {
  switch (level) {
    case 'info': return 'Interviewer has a question';
    case 'warn': return 'Pause to let the interviewer respond';
    case 'critical': return 'The interviewer would like to interject';
    default: return '';
  }
}

/**
 * Build a nudge text message to inject into the AI context
 * when the candidate has been speaking for too long.
 */
export function buildNudgeMessage(secondsSinceModelSpoke: number): string | null {
  if (secondsSinceModelSpoke < THRESHOLDS.warn) return null;
  
  return `[System: The candidate has been speaking for ${Math.floor(secondsSinceModelSpoke / 60)}+ minutes without pausing. When they pause next, please ask a focused follow-up question to guide the discussion and keep the interview on track.]`;
}
