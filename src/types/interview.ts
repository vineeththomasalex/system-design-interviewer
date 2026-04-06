// Interview-related type definitions

export type InterviewState =
  | 'idle'
  | 'setup'
  | 'connecting'
  | 'active'
  | 'paused'
  | 'reconnecting'
  | 'ending'
  | 'report';

export type InterviewMode = 'voice' | 'text';
export type InterviewDifficulty = 'Easy' | 'Medium' | 'Hard';
export type InterviewerPersonality = 'friendly-coach' | 'faang-bar-raiser' | 'silent-observer' | 'stress-tester' | 'teaching-interviewer' | 'custom';

export interface InterviewerPersonalityPreset {
  id: InterviewerPersonality;
  label: string;
  emoji: string;
  description: string;
  promptModifier: string;
}

export const PERSONALITY_PRESETS: InterviewerPersonalityPreset[] = [
  {
    id: 'friendly-coach',
    label: 'Friendly Coach',
    emoji: '🤝',
    description: 'Warm and encouraging. Gives hints when stuck. Focus on learning.',
    promptModifier: 'You are warm and encouraging. When the candidate is stuck, offer gentle hints. Focus on making this a learning experience. Praise good ideas.',
  },
  {
    id: 'faang-bar-raiser',
    label: 'FAANG Bar Raiser',
    emoji: '🎯',
    description: 'High expectations. Probes deeply. Industry-standard bar.',
    promptModifier: 'You hold high expectations. Probe deeply on every design choice. Expect strong trade-off analysis and justification. Maintain an industry-standard hiring bar. Do not give hints unless the candidate is completely stuck.',
  },
  {
    id: 'silent-observer',
    label: 'Silent Observer',
    emoji: '🧊',
    description: 'Speaks minimally. Lets the candidate drive completely.',
    promptModifier: 'Speak as little as possible. Let the candidate drive the entire conversation. Only ask follow-up questions when they pause. Never offer hints or suggestions. Evaluate silently.',
  },
  {
    id: 'stress-tester',
    label: 'Stress Tester',
    emoji: '🔥',
    description: 'Challenges every decision. Tests how candidate handles pushback.',
    promptModifier: 'Challenge every design decision the candidate makes. Play devil\'s advocate. Ask "what if this fails?" frequently. Test how the candidate handles pushback and defends their choices. Be respectful but relentless.',
  },
  {
    id: 'teaching-interviewer',
    label: 'Teaching Interviewer',
    emoji: '📚',
    description: 'Explains concepts the candidate misses. Turns gaps into learning.',
    promptModifier: 'When the candidate misses an important concept, briefly explain it and ask them to incorporate it. Turn knowledge gaps into learning moments. Still evaluate, but prioritize education.',
  },
];

export interface InterviewConfig {
  question: string;
  questionTemplateId?: string;
  company: string;
  personality: InterviewerPersonality;
  customPersonality?: string;
  duration: number; // minutes
  difficulty: InterviewDifficulty;
  mode: InterviewMode;
}

export type AIStatus = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'disconnected' | 'paused' | 'reconnecting';

export interface TranscriptEntry {
  timestamp: number; // ms since interview start
  role: 'user' | 'model' | 'system';
  text: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface InterviewSession {
  id: string;
  config: InterviewConfig;
  startTime: number;
  endTime?: number;
  transcript: TranscriptEntry[];
  tokenUsage: TokenUsage;
  summary?: string; // structured MD summary
  report?: InterviewReport;
  audioUrl?: string; // blob URL for recording
}

export interface RubricScore {
  axis: string;
  score: number; // 1-10
  justification: string;
}

export interface InterviewReport {
  overallScore: number; // 1-10
  recommendation: 'Strong Hire' | 'Hire' | 'Lean Hire' | 'Lean No Hire' | 'No Hire';
  rubricScores: RubricScore[];
  strengths: string[];
  improvements: string[];
  suggestedStudyTopics: string[];
  rawAssessment: string; // full AI text
}

export interface AppSettings {
  // API
  geminiApiKey: string;
  // Candidate
  candidateName: string;
  currentRole: string;
  experienceLevel: 'Junior' | 'Mid' | 'Senior' | 'Staff' | 'Principal';
  firstLanguage: string;
  // Interview defaults
  defaultPersonality: InterviewerPersonality;
  customPersonalityPrompt: string;
  defaultDuration: number;
  autoRecord: boolean;
  canvasSharing: boolean;
  canvasImageSharing: boolean;
  canvasUpdateInterval: number; // seconds
}

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  candidateName: '',
  currentRole: 'Software Engineer',
  experienceLevel: 'Mid',
  firstLanguage: 'English',
  defaultPersonality: 'friendly-coach',
  customPersonalityPrompt: '',
  defaultDuration: 50,
  autoRecord: true,
  canvasSharing: true,
  canvasImageSharing: true,
  canvasUpdateInterval: 30,
};

export interface QuestionTemplate {
  id: string;
  title: string;
  description: string;
  difficulty: InterviewDifficulty;
  expectedDuration: number;
  keyTopics: string[];
  starterYaml?: string;
  rubricHints: string[];
  followUpPatterns: string[];
  expectedComponents: string[];
}

export interface KeyValidationResult {
  valid: boolean;
  modelAccessible: boolean;
  liveApiSupported: boolean;
  errorMessage?: string;
}
