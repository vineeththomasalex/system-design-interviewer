export interface GeminiConfig {
  apiKey: string;
  model: string;
  systemInstruction: string;
  responseModalities: string[];
  enableInputTranscription: boolean;
  enableOutputTranscription: boolean;
}

export interface GeminiEvents {
  onAudio: (pcmData: ArrayBuffer) => void;
  onInputTranscript: (text: string) => void;
  onOutputTranscript: (text: string) => void;
  onStatus: (status: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'disconnected' | 'reconnecting') => void;
  onError: (error: Error) => void;
  onTokenUsage: (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => void;
  onInterrupted: () => void;
  onGoAway: (timeLeftMs: number) => void;
  onResumeHandle: (handle: string) => void;
}

export const GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
