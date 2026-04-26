import type { AudioFilterEffect, AudioPipelineState } from "./types";

const dbToGain = (db: number) => Math.pow(10, db / 20);
const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

function generateImpulse(ctx: AudioContext, reverbTime: number, decay: number) {
  const sr = ctx.sampleRate;
  const len = Math.ceil(reverbTime * sr);
  const buf = ctx.createBuffer(2, len, sr);

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function makeDistortionCurve(amount: number): Float32Array {
  const n = 44100;
  const curve = new Float32Array(n);
  const k = clamp(amount, 0, 100);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] =
      ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export class WebAudioPipeline {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private filter: AudioFilterEffect | null = null;

  private _state: AudioPipelineState = "idle";
  private startedAt = 0;
  private pausedAt = 0;
  private _volume: number;
  private _loop: boolean;
  public _rate: number = 1;

  onStateChange?: (s: AudioPipelineState) => void;
  onEnd?: () => void;
  onError?: (e: Error) => void;

  constructor(opts: { volume?: number; loop?: boolean } = {}) {
    this._volume = opts.volume ?? 1;
    this._loop = opts.loop ?? false;
  }

  get state() {
    return this._state;
  }
  get duration() {
    return this.buffer?.duration ?? 0;
  }
  get currentTime(): number {
    if (this._state === "paused") return this.pausedAt;
    if (this._state !== "playing" || !this.ctx) return 0;
    const elapsed = (this.ctx.currentTime - this.startedAt) * this._rate;
    return this._loop && this.duration > 0
      ? elapsed % this.duration
      : Math.min(elapsed, this.duration);
  }

  private setState(s: AudioPipelineState) {
    if (this._state !== s) {
      this._state = s;
      this.onStateChange?.(s);
    }
  }

  async load(arrayBuffer: ArrayBuffer): Promise<void> {
    try {
      this.setState("loading");
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.setState("ready");
    } catch (e: unknown) {
      this.setState("error");
      this.onError?.(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  }

  private buildGraph(f: AudioFilterEffect | null): AudioBufferSourceNode {
    if (!this.ctx || !this.buffer) throw new Error("Context or buffer missing");
    const ctx = this.ctx;
    const hasPitch = f?.pitch && f.pitch !== 0;
    const rate = f?.rate ?? 1;
    this._rate = rate;

    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = this._loop;

    // Pitch via detune
    if (hasPitch) src.detune.value = f!.pitch! * 100;

    // Playback rate
    if (rate !== 1) src.playbackRate.value = rate;

    let node: AudioNode = src;

    const distortion = f?.distortion ?? 0;
    // Distortion
    if (distortion > 0) {
      const ws = ctx.createWaveShaper();
      // @ts-expect-error - ArrayBuffer mismatch between environments
      ws.curve = makeDistortionCurve(distortion);
      ws.oversample = "4x";
      node.connect(ws);
      node = ws;
    }

    // Amplify
    const amp = ctx.createGain();
    amp.gain.value = f?.amplify ? dbToGain(f.amplify) : 1;
    node.connect(amp);
    node = amp;

    // Reverb
    if (f?.reverb) {
      const [inGain, reverbMix, reverbTime] = f.reverb;

      const convolver = ctx.createConvolver();
      convolver.buffer = generateImpulse(ctx, reverbTime, 2.5);

      const inputGain = ctx.createGain();
      inputGain.gain.value = inGain;

      const dryGain = ctx.createGain();
      dryGain.gain.value = 1 - reverbMix;

      const wetGain = ctx.createGain();
      wetGain.gain.value = reverbMix;

      const merger = ctx.createGain();
      merger.gain.value = 1;

      node.connect(inputGain);
      inputGain.connect(dryGain);
      inputGain.connect(convolver);
      convolver.connect(wetGain);
      dryGain.connect(merger);
      wetGain.connect(merger);

      node = merger;
    }

    // Echo
    const merge = ctx.createGain();
    if (f?.echo) {
      const [wetDryMix, feedback, delayMs] = f.echo;

      const delay = ctx.createDelay(2.0);
      delay.delayTime.value = delayMs / 1000;
      const feedbackGain = ctx.createGain();
      feedbackGain.gain.value = feedback / 100;

      node.connect(delay);
      delay.connect(feedbackGain);
      feedbackGain.connect(delay);

      const wetGain = ctx.createGain();
      wetGain.gain.value = wetDryMix / 100;
      delay.connect(wetGain);
      wetGain.connect(merge);

      const dryGain = ctx.createGain();
      dryGain.gain.value = 1 - wetDryMix / 100;
      node.connect(dryGain);
      dryGain.connect(merge);
    } else {
      node.connect(merge);
    }
    node = merge;

    // Master volume
    this.master = ctx.createGain();
    this.master.gain.value = this._volume;
    node.connect(this.master);
    this.master.connect(ctx.destination);

    return src;
  }

  play(filter?: AudioFilterEffect | null, offset: number = 0): void {
    if (!this.ctx || !this.buffer) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.teardown();
    if (filter !== undefined) this.filter = filter ?? null;

    try {
      this.source = this.buildGraph(this.filter);

      this.source.onended = () => {
        if (this._state === "playing" && !this._loop) {
          this.setState("ready");
          this.onEnd?.();
        }
      };

      this.source.start(0, offset);
      this.startedAt = this.ctx.currentTime - offset / this._rate;
      this.pausedAt = offset;
      this.setState("playing");
    } catch (e: unknown) {
      this.setState("error");
      this.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  pause(): void {
    if (this._state !== "playing" || !this.ctx) return;
    const elapsed = (this.ctx.currentTime - this.startedAt) * this._rate;
    this.pausedAt =
      this._loop && this.duration > 0
        ? elapsed % this.duration
        : Math.min(elapsed, this.duration);
    this.teardown();
    this.setState("paused");
  }

  resume(): void {
    if (this._state === "paused") this.play(this.filter, this.pausedAt);
  }

  stop(): void {
    this.teardown();
    this.pausedAt = 0;
    this.startedAt = 0;
    if (this._state !== "idle" && this._state !== "error")
      this.setState("ready");
  }

  applyFilter(filter: AudioFilterEffect | null, restart: boolean = false): void {
    const wasPlaying = this._state === "playing";
    
    // Resume context if suspended (browser interaction policy)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const savedCb = this.onStateChange;
    this.onStateChange = undefined;
    if (wasPlaying) this.pause();
    this.filter = filter;
    
    if (restart) {
      this.pausedAt = 0;
    }
    
    if (wasPlaying) this.play(this.filter, this.pausedAt);
    this.onStateChange = savedCb;
    
    savedCb?.(this._state);
  }

  setVolume(v: number): void {
    this._volume = clamp(v, 0, 1);
    if (this.master) this.master.gain.value = this._volume;
  }

  dispose(): void {
    this.teardown();
    this.ctx?.close();
    this.ctx = null;
    this.buffer = null;
    this.setState("idle");
  }

  private teardown(): void {
    try {
      this.source?.stop();
      this.source?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.master?.disconnect();
    } catch {
      // ignore
    }
    this.source = null;
    this.master = null;
  }
}
