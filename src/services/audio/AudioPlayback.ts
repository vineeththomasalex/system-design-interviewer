/**
 * Plays raw PCM 16-bit 24kHz audio received from Gemini.
 *
 * Chunks are scheduled back-to-back on the AudioContext timeline for
 * gapless playback. A MediaStreamAudioDestinationNode provides an output
 * stream that SessionRecorder can capture.
 */

const PLAYBACK_SAMPLE_RATE = 24000;

export class AudioPlayback {
  private audioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private gainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  start(): void {
    console.log('[AudioPlayback] Starting, sampleRate:', PLAYBACK_SAMPLE_RATE);
    this.audioContext = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE });
    this.gainNode = this.audioContext.createGain();
    this.destinationNode = this.audioContext.createMediaStreamDestination();

    // Route audio to both speakers and the recording destination
    this.gainNode.connect(this.audioContext.destination);
    this.gainNode.connect(this.destinationNode);

    this.nextStartTime = 0;
  }

  playChunk(pcmData: ArrayBuffer): void {
    if (!this.audioContext || !this.gainNode) {
      console.warn('[AudioPlayback] playChunk called but no AudioContext');
      return;
    }

    const int16 = new Int16Array(pcmData);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = this.audioContext.createBuffer(
      1,
      float32.length,
      PLAYBACK_SAMPLE_RATE,
    );
    audioBuffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const currentTime = this.audioContext.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  stop(): void {
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.destinationNode) {
      this.destinationNode.disconnect();
      this.destinationNode = null;
    }

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.nextStartTime = 0;
  }

  clearQueue(): void {
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    }
  }

  setVolume(volume: number): void {
    if (this.gainNode && this.audioContext) {
      const clamped = Math.max(0, Math.min(1, volume));
      this.gainNode.gain.setValueAtTime(clamped, this.audioContext.currentTime);
    }
  }

  getOutputStream(): MediaStream | null {
    return this.destinationNode?.stream ?? null;
  }
}
