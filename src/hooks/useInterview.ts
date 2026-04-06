import { useState, useRef, useCallback, useEffect } from 'react';
import type { InterviewState, InterviewConfig, AIStatus, TranscriptEntry, TokenUsage } from '../types/interview';
import { GeminiLiveProvider } from '../services/gemini/GeminiLiveProvider';
import type { GeminiConfig } from '../services/gemini/types';
import { GEMINI_LIVE_MODEL } from '../services/gemini/types';
import { AudioCapture } from '../services/audio/AudioCapture';
import { AudioPlayback } from '../services/audio/AudioPlayback';
import { SessionRecorder } from '../services/audio/SessionRecorder';
import { buildSystemPrompt, detectQuestionTemplate } from '../utils/promptBuilder';
import type { AppSettings } from '../types/interview';

interface InterviewHookState {
  state: InterviewState;
  status: AIStatus;
  subtitle: string;
  transcript: TranscriptEntry[];
  tokenUsage: TokenUsage;
  elapsedSeconds: number;
  isMuted: boolean;
  isRecording: boolean;
  monologueSeconds: number;
  canvasSyncAgo: number;
  sessionResumeCount: number;
  config: InterviewConfig | null;
}

interface InterviewActions {
  startSetup: () => void;
  cancelSetup: () => void;
  beginInterview: (config: InterviewConfig) => void;
  pause: () => void;
  resume: () => void;
  toggleMute: () => void;
  endInterview: () => void;
  dismissReport: () => void;
  sendCanvasUpdate: (yaml: string, notes: string) => void;
  sendCanvasImage: (jpegData: ArrayBuffer) => void;
  sendSummary: (summary: string) => void;
}

const RECONNECT_DELAYS = [1000, 3000, 5000];

export function useInterview(settings: AppSettings): [InterviewHookState, InterviewActions] {
  const [state, setState] = useState<InterviewState>('idle');
  const [status, setStatus] = useState<AIStatus>('disconnected');
  const [subtitle, setSubtitle] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [monologueSeconds, setMonologueSeconds] = useState(0);
  const [canvasSyncAgo, setCanvasSyncAgo] = useState(0);
  const [sessionResumeCount, setSessionResumeCount] = useState(0);
  const [config, setConfig] = useState<InterviewConfig | null>(null);

  const provider = useRef<GeminiLiveProvider | null>(null);
  const audioCapture = useRef<AudioCapture | null>(null);
  const audioPlayback = useRef<AudioPlayback | null>(null);
  const recorder = useRef<SessionRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const monologueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const lastModelSpokeRef = useRef(0);
  const lastCanvasSyncRef = useRef(0);
  const reconnectAttempt = useRef(0);
  const isPausedRef = useRef(false);

  // Timer tick
  useEffect(() => {
    if (state === 'active') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        setMonologueSeconds(Math.floor((Date.now() - lastModelSpokeRef.current) / 1000));
        setCanvasSyncAgo(Math.floor((Date.now() - lastCanvasSyncRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  const addTranscriptEntry = useCallback((role: 'user' | 'model' | 'system', text: string) => {
    const entry: TranscriptEntry = {
      timestamp: Date.now() - startTimeRef.current,
      role,
      text,
    };
    setTranscript(prev => [...prev, entry]);
  }, []);

  const connectToGemini = useCallback((interviewConfig: InterviewConfig, resumeHandle?: string) => {
    const template = interviewConfig.questionTemplateId
      ? undefined // template already applied via prompt builder
      : detectQuestionTemplate(interviewConfig.question);

    const systemPrompt = buildSystemPrompt(interviewConfig, settings, template);

    const geminiConfig: GeminiConfig = {
      apiKey: settings.geminiApiKey,
      model: GEMINI_LIVE_MODEL,
      systemInstruction: systemPrompt,
      responseModalities: ['AUDIO'],
      enableInputTranscription: true,
      enableOutputTranscription: true,
    };

    const liveProvider = new GeminiLiveProvider({
      onAudio: (pcmData) => {
        audioPlayback.current?.playChunk(pcmData);
        lastModelSpokeRef.current = Date.now();
      },
      onInputTranscript: (text) => {
        addTranscriptEntry('user', text);
        setSubtitle(text);
      },
      onOutputTranscript: (text) => {
        addTranscriptEntry('model', text);
        setSubtitle(text);
      },
      onStatus: (newStatus) => {
        setStatus(newStatus);
        if (newStatus === 'listening' && state === 'connecting') {
          setState('active');
          reconnectAttempt.current = 0;
        }
        if (newStatus === 'disconnected' && state === 'active') {
          handleDisconnect();
        }
      },
      onError: (error) => {
        console.error('[Interview] Gemini error:', error);
        if (state === 'active' || state === 'reconnecting') {
          handleDisconnect();
        }
      },
      onTokenUsage: (usage) => {
        setTokenUsage(usage);
      },
      onInterrupted: () => {
        audioPlayback.current?.clearQueue();
      },
      onGoAway: (_timeLeftMs) => {
        // Server is about to disconnect — preemptively reconnect
        handleDisconnect();
      },
      onResumeHandle: (_handle) => {
        // Handle stored internally by provider
      },
    });

    provider.current = liveProvider;
    liveProvider.connect(geminiConfig, resumeHandle);
  }, [settings, addTranscriptEntry]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDisconnect = useCallback(() => {
    if (isPausedRef.current || state === 'ending' || state === 'report' || state === 'idle') return;

    const handle = provider.current?.getLastResumeHandle();
    if (handle && reconnectAttempt.current < RECONNECT_DELAYS.length) {
      setState('reconnecting');
      setStatus('reconnecting');
      const delay = RECONNECT_DELAYS[reconnectAttempt.current];
      reconnectAttempt.current++;
      setSessionResumeCount(prev => prev + 1);

      setTimeout(() => {
        if (config) {
          connectToGemini(config, handle);
        }
      }, delay);
    } else {
      // All retries exhausted
      setStatus('disconnected');
      addTranscriptEntry('system', 'Connection lost. Interview can be continued in text mode or ended.');
    }
  }, [config, connectToGemini, addTranscriptEntry, state]);

  const startSetup = useCallback(() => {
    setState('setup');
  }, []);

  const cancelSetup = useCallback(() => {
    setState('idle');
  }, []);

  const beginInterview = useCallback(async (interviewConfig: InterviewConfig) => {
    setConfig(interviewConfig);
    setState('connecting');
    setStatus('connecting');
    setTranscript([]);
    setTokenUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    setElapsedSeconds(0);
    setMonologueSeconds(0);
    setCanvasSyncAgo(0);
    setSessionResumeCount(0);
    setSubtitle('');
    setIsMuted(false);
    startTimeRef.current = Date.now();
    lastModelSpokeRef.current = Date.now();
    lastCanvasSyncRef.current = Date.now();
    reconnectAttempt.current = 0;
    isPausedRef.current = false;

    // Start audio
    if (interviewConfig.mode === 'voice') {
      try {
        const capture = new AudioCapture();
        await capture.start((pcmData) => {
          provider.current?.sendAudio(pcmData);
        });
        audioCapture.current = capture;

        const playback = new AudioPlayback();
        playback.start();
        audioPlayback.current = playback;

        // Start recording if enabled
        if (settings.autoRecord) {
          const rec = new SessionRecorder();
          const micStream = capture.getMediaStream();
          const aiStream = playback.getOutputStream();
          if (micStream) {
            rec.start(micStream, aiStream || undefined);
            recorder.current = rec;
            setIsRecording(true);
          }
        }
      } catch (err) {
        console.error('[Interview] Audio setup failed:', err);
        addTranscriptEntry('system', 'Microphone access denied. Falling back to text mode.');
        interviewConfig = { ...interviewConfig, mode: 'text' };
      }
    }

    // Connect to Gemini
    connectToGemini(interviewConfig);
  }, [settings, connectToGemini, addTranscriptEntry]);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    setState('paused');
    setStatus('paused');
    audioCapture.current?.setMuted(true);
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    setState('active');
    setStatus('listening');
    audioCapture.current?.setMuted(false);
    lastModelSpokeRef.current = Date.now(); // Reset monologue timer
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioCapture.current?.setMuted(newMuted);
  }, [isMuted]);

  const endInterview = useCallback(() => {
    setState('ending');

    // Stop audio
    audioCapture.current?.stop();
    audioCapture.current = null;
    audioPlayback.current?.stop();
    audioPlayback.current = null;

    // Stop recording
    if (recorder.current) {
      recorder.current.stop();
      recorder.current.downloadRecording('interview-recording.webm');
      recorder.current = null;
      setIsRecording(false);
    }

    // Disconnect Gemini
    provider.current?.disconnect();
    provider.current = null;

    // Transition to report
    setState('report');
    setStatus('disconnected');
  }, []);

  const dismissReport = useCallback(() => {
    setState('idle');
    setConfig(null);
  }, []);

  const sendCanvasUpdate = useCallback((yaml: string, notes: string) => {
    provider.current?.sendContextUpdate(yaml, notes);
    lastCanvasSyncRef.current = Date.now();
  }, []);

  const sendCanvasImage = useCallback((jpegData: ArrayBuffer) => {
    provider.current?.sendImage(jpegData);
  }, []);

  const sendSummary = useCallback((summary: string) => {
    provider.current?.sendSummaryUpdate(summary);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioCapture.current?.stop();
      audioPlayback.current?.stop();
      recorder.current?.stop();
      provider.current?.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
      if (monologueTimerRef.current) clearInterval(monologueTimerRef.current);
    };
  }, []);

  const hookState: InterviewHookState = {
    state,
    status,
    subtitle,
    transcript,
    tokenUsage,
    elapsedSeconds,
    isMuted,
    isRecording,
    monologueSeconds,
    canvasSyncAgo,
    sessionResumeCount,
    config,
  };

  const actions: InterviewActions = {
    startSetup,
    cancelSetup,
    beginInterview,
    pause,
    resume,
    toggleMute,
    endInterview,
    dismissReport,
    sendCanvasUpdate,
    sendCanvasImage,
    sendSummary,
  };

  return [hookState, actions];
}
