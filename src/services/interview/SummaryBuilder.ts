/**
 * SummaryBuilder — builds a structured markdown summary of the current interview.
 * Updated periodically and injected into the model's context to prevent contradictions.
 */

import type { TranscriptEntry } from '../../types/interview';

export interface InterviewSummaryData {
  question: string;
  elapsedMinutes: number;
  requirements: string[];
  decisions: { text: string; timestampMin: number }[];
  currentArchitecture: { nodes: string[]; connections: string[] };
  openGaps: string[];
  interviewerNotes: string[];
}

/**
 * Extract requirements from transcript — look for affirmative exchanges
 * about functional/non-functional requirements.
 */
function extractRequirements(transcript: TranscriptEntry[]): string[] {
  const requirements: string[] = [];
  const reqKeywords = [
    /should (?:support|handle|be able|allow|provide)/i,
    /(?:functional|non-functional) requirement/i,
    /(?:need|must|require)s? (?:to|that)/i,
    /(?:users?|clients?|system) (?:should|must|can|will)/i,
    /(?:latency|throughput|availability|scale|uptime)/i,
    /(?:million|billion|thousand|per second|per day|QPS|TPS|RPM)/i,
  ];

  for (const entry of transcript) {
    if (entry.role === 'system') continue;
    for (const pattern of reqKeywords) {
      if (pattern.test(entry.text)) {
        // Take the first sentence or up to 120 chars
        const sentence = entry.text.split(/[.!?]/)[0].trim();
        if (sentence.length > 10 && sentence.length < 200) {
          requirements.push(sentence);
        }
        break;
      }
    }
  }

  // Deduplicate by similarity (simple: skip if >60% overlap with existing)
  const unique: string[] = [];
  for (const req of requirements) {
    const isDuplicate = unique.some(existing => {
      const words1 = new Set(existing.toLowerCase().split(/\s+/));
      const words2 = new Set(req.toLowerCase().split(/\s+/));
      const overlap = [...words1].filter(w => words2.has(w)).length;
      return overlap / Math.max(words1.size, words2.size) > 0.6;
    });
    if (!isDuplicate) unique.push(req);
  }

  return unique.slice(0, 10); // Cap at 10 requirements
}

/**
 * Extract design decisions from transcript — affirmative statements about choices.
 */
function extractDecisions(transcript: TranscriptEntry[], _startTime: number): { text: string; timestampMin: number }[] {
  const decisions: { text: string; timestampMin: number }[] = [];
  const decisionKeywords = [
    /(?:let's|I'll|we should|I would|I'd) use/i,
    /(?:chose|choose|pick|go with|decided|opting for)/i,
    /(?:for (?:the|this), (?:I'll|we|let's))/i,
    /(?:the (?:database|cache|queue|storage|service) (?:will be|is|would be))/i,
    /(?:SQL|NoSQL|Redis|PostgreSQL|MongoDB|Kafka|RabbitMQ|S3|DynamoDB)/i,
  ];

  for (const entry of transcript) {
    if (entry.role !== 'user') continue;
    for (const pattern of decisionKeywords) {
      if (pattern.test(entry.text)) {
        const sentence = entry.text.split(/[.!?]/)[0].trim();
        if (sentence.length > 10 && sentence.length < 200) {
          decisions.push({
            text: sentence,
            timestampMin: Math.round(entry.timestamp / 60000),
          });
        }
        break;
      }
    }
  }

  return decisions.slice(0, 15); // Cap at 15 decisions
}

/**
 * Build structured summary markdown from interview state.
 */
export function buildInterviewSummary(
  data: InterviewSummaryData
): string {
  const lines: string[] = [];

  lines.push(`# Interview Summary — ${data.question}`);
  lines.push(`## Duration: ${data.elapsedMinutes} min`);
  lines.push('');

  if (data.requirements.length > 0) {
    lines.push('### Requirements Established');
    for (const req of data.requirements) {
      lines.push(`- ${req}`);
    }
    lines.push('');
  }

  if (data.decisions.length > 0) {
    lines.push('### Design Decisions Made');
    for (const dec of data.decisions) {
      lines.push(`- ${dec.text} (at ${dec.timestampMin} min)`);
    }
    lines.push('');
  }

  if (data.currentArchitecture.nodes.length > 0) {
    lines.push('### Current Architecture');
    lines.push(`- Nodes: ${data.currentArchitecture.nodes.join(', ')}`);
    if (data.currentArchitecture.connections.length > 0) {
      lines.push(`- Connections: ${data.currentArchitecture.connections.join(', ')}`);
    }
    lines.push('');
  }

  if (data.openGaps.length > 0) {
    lines.push('### Open Questions / Gaps');
    for (const gap of data.openGaps) {
      lines.push(`- ${gap}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build summary from raw interview data.
 */
export function buildSummaryFromState(
  question: string,
  transcript: TranscriptEntry[],
  yaml: string,
  startTime: number,
  expectedComponents?: string[]
): string {
  // Parse YAML for architecture
  const nodes: string[] = [];
  const connections: string[] = [];
  const nodeRegex = /- id:\s*(\S+)/g;
  const connRegex = /- from:\s*(\S+)[\s\S]*?to:\s*(\S+)/g;
  let match;
  while ((match = nodeRegex.exec(yaml)) !== null) {
    nodes.push(match[1]);
  }
  while ((match = connRegex.exec(yaml)) !== null) {
    connections.push(`${match[1]}→${match[2]}`);
  }

  // Detect gaps: expected components not yet in YAML
  const openGaps: string[] = [];
  if (expectedComponents) {
    for (const comp of expectedComponents) {
      const compLower = comp.toLowerCase().replace(/[_-]/g, '');
      const found = nodes.some(n => n.toLowerCase().replace(/[_-]/g, '').includes(compLower));
      if (!found) {
        openGaps.push(`No ${comp} component yet`);
      }
    }
  }

  const elapsedMinutes = Math.round((Date.now() - startTime) / 60000);

  return buildInterviewSummary({
    question,
    elapsedMinutes,
    requirements: extractRequirements(transcript),
    decisions: extractDecisions(transcript, startTime),
    currentArchitecture: { nodes, connections },
    openGaps,
    interviewerNotes: [],
  });
}
