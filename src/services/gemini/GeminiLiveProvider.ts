import type { GeminiConfig, GeminiEvents } from './types';
import { GEMINI_WS_URL } from './types';

export class GeminiLiveProvider {
  private ws: WebSocket | null = null;
  private events: GeminiEvents;
  private lastResumeHandle: string | null = null;

  constructor(events: GeminiEvents) {
    this.events = events;
  }

  connect(config: GeminiConfig, resumeHandle?: string): void {
    console.log('[Gemini] Connecting...', { model: config.model, hasResume: !!resumeHandle });
    this.events.onStatus('connecting');

    const url = `${GEMINI_WS_URL}?key=${config.apiKey}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[Gemini] WebSocket OPEN — sending setup message');
      this.sendSetupMessage(config, resumeHandle);
      this.events.onStatus('listening');
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[Gemini] Failed to parse message:', err, event.data);
        this.events.onError(new Error(`Failed to parse message: ${err}`));
      }
    };

    this.ws.onerror = (ev) => {
      console.error('[Gemini] WebSocket ERROR:', ev);
      this.events.onError(new Error('WebSocket error'));
    };

    this.ws.onclose = (ev) => {
      console.warn('[Gemini] WebSocket CLOSED:', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
      this.events.onStatus('disconnected');
      this.ws = null;
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  sendAudio(pcmData: ArrayBuffer): void {
    if (!this.isConnected()) return;

    const base64 = arrayBufferToBase64(pcmData);
    this.ws!.send(JSON.stringify({
      realtimeInput: {
        audio: {
          data: base64,
          mimeType: 'audio/pcm;rate=16000',
        },
      },
    }));
  }

  sendText(text: string): void {
    if (!this.isConnected()) return;
    console.log('[Gemini] Sending text:', text.slice(0, 80) + (text.length > 80 ? '...' : ''));

    this.ws!.send(JSON.stringify({
      realtimeInput: {
        text: text,
      },
    }));
  }

  sendImage(jpegData: ArrayBuffer): void {
    if (!this.isConnected()) return;
    console.log('[Gemini] Sending canvas JPEG:', (jpegData.byteLength / 1024).toFixed(1) + 'KB');

    const base64 = arrayBufferToBase64(jpegData);
    this.ws!.send(JSON.stringify({
      realtimeInput: {
        video: {
          data: base64,
          mimeType: 'image/jpeg',
        },
      },
    }));
  }

  sendContextUpdate(yaml: string, notes: string): void {
    if (!this.isConnected()) return;

    const contextText = [
      '[CONTEXT_UPDATE]',
      '--- YAML Diagram ---',
      yaml,
      '--- Notes ---',
      notes,
      '[/CONTEXT_UPDATE]',
    ].join('\n');

    this.ws!.send(JSON.stringify({
      realtimeInput: {
        text: contextText,
      },
    }));
  }

  sendSummaryUpdate(summary: string): void {
    if (!this.isConnected()) return;

    this.ws!.send(JSON.stringify({
      realtimeInput: {
        text: `[INTERVIEW_SUMMARY]\n${summary}\n[/INTERVIEW_SUMMARY]`,
      },
    }));
  }

  getLastResumeHandle(): string | null {
    return this.lastResumeHandle;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // --- Private ---

  private sendSetupMessage(config: GeminiConfig, resumeHandle?: string): void {
    const sessionResumption: Record<string, unknown> = resumeHandle
      ? { handle: resumeHandle }
      : {};

    const setupMessage: Record<string, unknown> = {
      setup: {
        model: config.model,
        generationConfig: {
          responseModalities: config.responseModalities,
        },
        systemInstruction: {
          parts: [{ text: config.systemInstruction }],
        },
        contextWindowCompression: {
          slidingWindow: {},
        },
        sessionResumption,
        ...(config.enableInputTranscription ? { inputAudioTranscription: {} } : {}),
        ...(config.enableOutputTranscription ? { outputAudioTranscription: {} } : {}),
      },
    };

    console.log('[Gemini] Setup message:', JSON.stringify(setupMessage).slice(0, 300) + '...');
    this.ws!.send(JSON.stringify(setupMessage));
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const keys = Object.keys(msg);
    // Log all messages except pure audio chunks (too noisy)
    if (!msg.serverContent || !(msg.serverContent as Record<string, unknown>).modelTurn) {
      console.log('[Gemini] Received:', keys.join(', '), JSON.stringify(msg).slice(0, 200));
    }
    // Server content (audio, transcripts, interruption)
    if (msg.serverContent) {
      this.handleServerContent(msg.serverContent as Record<string, unknown>);
    }

    // Usage metadata
    if (msg.usageMetadata) {
      const meta = msg.usageMetadata as Record<string, number>;
      this.events.onTokenUsage({
        inputTokens: meta.promptTokenCount ?? 0,
        outputTokens: meta.candidatesTokenCount ?? 0,
        totalTokens: meta.totalTokenCount ?? 0,
      });
    }

    // GoAway signal — server will disconnect soon
    if (msg.goAway) {
      const goAway = msg.goAway as Record<string, string>;
      const timeLeftStr = goAway.timeLeft ?? '0s';
      const timeLeftMs = parseTimeToMs(timeLeftStr);
      this.events.onGoAway(timeLeftMs);
    }

    // Session resumption handle
    if (msg.sessionResumptionUpdate) {
      const update = msg.sessionResumptionUpdate as Record<string, unknown>;
      const handle = update.newHandle as string | undefined;
      if (handle) {
        this.lastResumeHandle = handle;
        this.events.onResumeHandle(handle);
      }
    }
  }

  private handleServerContent(content: Record<string, unknown>): void {
    // Interruption
    if (content.interrupted) {
      console.log('[Gemini] Model interrupted by user');
      this.events.onInterrupted();
      return;
    }

    // Model audio turn
    if (content.modelTurn) {
      const modelTurn = content.modelTurn as { parts?: Array<Record<string, unknown>> };
      if (modelTurn.parts) {
        for (const part of modelTurn.parts) {
          if (part.inlineData) {
            const inlineData = part.inlineData as { data: string; mimeType: string };
            const pcmData = base64ToArrayBuffer(inlineData.data);
            console.log('[Gemini] Audio chunk received:', (pcmData.byteLength / 1024).toFixed(1) + 'KB');
            this.events.onAudio(pcmData);
          }
        }
      }
    }

    // Input transcription
    if (content.inputTranscription) {
      const transcript = content.inputTranscription as { text?: string };
      if (transcript.text) {
        console.log('[Gemini] User transcript:', transcript.text);
        this.events.onInputTranscript(transcript.text);
      }
    }

    // Output transcription
    if (content.outputTranscription) {
      const transcript = content.outputTranscription as { text?: string };
      if (transcript.text) {
        console.log('[Gemini] Model transcript:', transcript.text);
        this.events.onOutputTranscript(transcript.text);
      }
    }
  }
}

// --- Utility functions ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function parseTimeToMs(timeStr: string): number {
  const match = timeStr.match(/^(\d+(?:\.\d+)?)\s*s$/);
  if (match) {
    return Math.round(parseFloat(match[1]) * 1000);
  }
  return 0;
}
