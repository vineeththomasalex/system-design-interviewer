/**
 * Text-only fallback provider for users without a microphone.
 * Uses the Gemini REST API (streaming generateContent) instead of the WebSocket Live API.
 */

type StatusCallback = (status: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'disconnected') => void;

interface GeminiTextProviderConfig {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  onResponse: (text: string) => void;
  onError: (error: Error) => void;
  onStatus: StatusCallback;
}

interface ConversationEntry {
  role: string;
  parts: { text: string }[];
}

export class GeminiTextProvider {
  private apiKey: string;
  private model: string;
  private systemInstruction: string;
  private conversationHistory: ConversationEntry[];
  private abortController: AbortController | null = null;

  private onResponse: (text: string) => void;
  private onError: (error: Error) => void;
  private onStatus: StatusCallback;

  constructor(config: GeminiTextProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gemini-2.5-flash';
    this.systemInstruction = config.systemInstruction;
    this.conversationHistory = [];
    this.onResponse = config.onResponse;
    this.onError = config.onError;
    this.onStatus = config.onStatus;
  }

  async sendMessage(text: string): Promise<void> {
    this.conversationHistory.push({
      role: 'user',
      parts: [{ text }],
    });

    this.onStatus('thinking');
    this.abortController = new AbortController();

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;

    const body = {
      contents: this.conversationHistory,
      systemInstruction: { parts: [{ text: this.systemInstruction }] },
    };

    let fullResponse = '';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;
            try {
              const data = JSON.parse(jsonStr);
              const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (chunk) {
                this.onResponse(chunk);
                fullResponse += chunk;
              }
            } catch {
              /* skip malformed JSON */
            }
          }
        }
      }

      if (fullResponse) {
        this.conversationHistory.push({
          role: 'model',
          parts: [{ text: fullResponse }],
        });
      }

      this.onStatus('listening');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      this.onError(error);
      this.onStatus('disconnected');
    } finally {
      this.abortController = null;
    }
  }

  updateContext(yaml: string, notes: string): void {
    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: `[CANVAS_UPDATE]\nYAML:\n${yaml}\n\nNotes:\n${notes}\n[/CANVAS_UPDATE]` }],
    });
    this.conversationHistory.push({
      role: 'model',
      parts: [{ text: 'Noted the canvas update.' }],
    });
  }

  updateSummary(summary: string): void {
    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: `[INTERVIEW_SUMMARY]\n${summary}\n[/INTERVIEW_SUMMARY]` }],
    });
    this.conversationHistory.push({
      role: 'model',
      parts: [{ text: 'Summary acknowledged.' }],
    });
  }

  disconnect(): void {
    this.abortController?.abort();
    this.conversationHistory = [];
  }

  getConversationHistory(): ConversationEntry[] {
    return this.conversationHistory;
  }
}
