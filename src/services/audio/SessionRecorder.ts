/**
 * Records the full interview session (candidate mic + AI audio) as WebM/Opus.
 *
 * When both streams are provided they are mixed via an AudioContext so the
 * resulting file contains both sides of the conversation.
 */

const PREFERRED_MIME = 'audio/webm;codecs=opus';
const FALLBACK_MIME = 'audio/webm';
const DATA_INTERVAL_MS = 1000;

function pickMimeType(): string {
  if (MediaRecorder.isTypeSupported(PREFERRED_MIME)) return PREFERRED_MIME;
  if (MediaRecorder.isTypeSupported(FALLBACK_MIME)) return FALLBACK_MIME;
  return '';
}

export class SessionRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recording = false;
  private mixerContext: AudioContext | null = null;

  start(micStream: MediaStream, aiStream?: MediaStream): void {
    if (this.recording) return;

    let streamToRecord: MediaStream;

    if (aiStream && aiStream.getAudioTracks().length > 0) {
      // Mix both streams into a single output
      this.mixerContext = new AudioContext();
      const dest = this.mixerContext.createMediaStreamDestination();

      const micSource = this.mixerContext.createMediaStreamSource(micStream);
      micSource.connect(dest);

      const aiSource = this.mixerContext.createMediaStreamSource(aiStream);
      aiSource.connect(dest);

      streamToRecord = dest.stream;
    } else {
      streamToRecord = micStream;
    }

    const mimeType = pickMimeType();
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(streamToRecord, options);

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.start(DATA_INTERVAL_MS);
    this.recording = true;
  }

  stop(): Blob | null {
    if (!this.mediaRecorder || !this.recording) return null;

    this.mediaRecorder.stop();
    this.recording = false;

    const mimeType = this.mediaRecorder.mimeType || FALLBACK_MIME;
    const blob = this.chunks.length > 0
      ? new Blob(this.chunks, { type: mimeType })
      : null;

    this.mediaRecorder = null;
    this.chunks = [];

    if (this.mixerContext) {
      void this.mixerContext.close();
      this.mixerContext = null;
    }

    return blob;
  }

  isRecording(): boolean {
    return this.recording;
  }

  downloadRecording(filename?: string): void {
    const blob = this.stop();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `interview-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
