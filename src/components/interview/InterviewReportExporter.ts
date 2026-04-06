import type { InterviewConfig, TranscriptEntry, TokenUsage } from '../../types/interview';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  return formatTime(totalSeconds);
}

function estimateCost(usage: TokenUsage): string {
  const inputCost = (usage.inputTokens / 1_000_000) * 0.75;
  const outputCost = (usage.outputTokens / 1_000_000) * 4.5;
  return `$${(inputCost + outputCost).toFixed(2)}`;
}

function speakerLabel(role: TranscriptEntry['role']): string {
  switch (role) {
    case 'user':
      return 'User';
    case 'model':
      return 'Interviewer';
    case 'system':
      return 'System';
  }
}

export function exportReportAsMarkdown(
  config: InterviewConfig,
  transcript: TranscriptEntry[],
  tokenUsage: TokenUsage,
  elapsedSeconds: number,
  summary: string,
): void {
  const lines: string[] = [];

  lines.push('# Interview Report');
  lines.push('');
  lines.push(`## Question: ${config.question}`);
  lines.push('');
  lines.push(
    `**Company:** ${config.company} | **Difficulty:** ${config.difficulty} | **Duration:** ${formatTime(elapsedSeconds)}`,
  );
  lines.push(
    `**Tokens:** ${tokenUsage.inputTokens} in / ${tokenUsage.outputTokens} out / ${tokenUsage.totalTokens} total | **Est. Cost:** ${estimateCost(tokenUsage)}`,
  );
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(summary || '_No summary available._');
  lines.push('');

  // Transcript table
  lines.push('## Transcript');
  lines.push('');
  lines.push('| Time | Speaker | Text |');
  lines.push('| ---- | ------- | ---- |');
  for (const entry of transcript) {
    // Escape pipe characters in text so the table doesn't break
    const safeText = entry.text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(
      `| ${formatTimestamp(entry.timestamp)} | ${speakerLabel(entry.role)} | ${safeText} |`,
    );
  }
  lines.push('');

  const md = lines.join('\n');
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `interview-report-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
