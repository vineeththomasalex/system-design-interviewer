/**
 * Captures microphone audio and converts to raw PCM 16-bit 16kHz little-endian
 * for the Gemini Live API.
 *
 * Chrome/Edge typically capture at 48kHz, so we downsample to 16kHz using
 * linear interpolation in the ScriptProcessorNode callback.
 */

const TARGET_SAMPLE_RATE = 16000;

function downsample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const floor = Math.floor(srcIndex);
    const ceil = Math.min(floor + 1, input.length - 1);
    const frac = srcIndex - floor;
    output[i] = input[floor] * (1 - frac) + input[ceil] * frac;
  }
  return output;
}

function float32ToInt16(float32: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}

export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private onAudioChunk: ((pcmData: ArrayBuffer) => void) | null = null;
  private muted = false;

  async start(onAudioChunk: (pcmData: ArrayBuffer) => void): Promise<void> {
    this.onAudioChunk = onAudioChunk;
    console.log('[AudioCapture] Requesting microphone access...');

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    console.log('[AudioCapture] Mic access granted, tracks:', this.mediaStream.getAudioTracks().map(t => t.label));

    // Chrome typically ignores sampleRate constraints — use default and downsample
    this.audioContext = new AudioContext();
    const nativeSampleRate = this.audioContext.sampleRate;
    console.log('[AudioCapture] AudioContext sampleRate:', nativeSampleRate, '→ downsampling to', TARGET_SAMPLE_RATE);

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // ScriptProcessorNode: bufferSize 4096, 1 input channel, 1 output channel
    // (output channels must be ≥1 in Chrome or the node won't fire)
    this.scriptNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    let chunkCount = 0;
    this.scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (this.muted || !this.onAudioChunk) return;

      const inputData = event.inputBuffer.getChannelData(0);
      const downsampled = downsample(inputData, nativeSampleRate, TARGET_SAMPLE_RATE);
      const pcm = float32ToInt16(downsampled);
      this.onAudioChunk(pcm);
      chunkCount++;
      if (chunkCount % 50 === 1) {
        console.log('[AudioCapture] Chunk #' + chunkCount + ', size:', pcm.byteLength + 'B, muted:', this.muted);
      }
    };

    this.sourceNode.connect(this.scriptNode);
    // Connect to destination to keep the processing pipeline alive in Chrome
    this.scriptNode.connect(this.audioContext.destination);
  }

  stop(): void {
    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null;
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.onAudioChunk = null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }
}
