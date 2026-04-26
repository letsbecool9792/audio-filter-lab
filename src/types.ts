/** Echo: [wetDryMix (0–100), feedback (0–100), delayMs] */
export type EchoConfig = [number, number, number];
export type ReverbConfig = [number, number, number];
export type BiquadFilterConfig = [
  (
    | "lowpass"
    | "highpass"
    | "bandpass"
    | "lowshelf"
    | "highshelf"
    | "peaking"
    | "notch"
    | "allpass"
  ),
  number,
  number,
  number,
];

export interface AudioFilterEffect {
  id: string;
  name: string;
  emoji: string;
  description: string;
  pitch?: number;
  amplify?: number;
  echo?: EchoConfig;
  reverb?: ReverbConfig;
  distortion?: number;
  rate?: number; // playback rate: 1 = normal, 1.25 = 25% faster, 0.75 = slower
}

export type AudioPipelineState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "error";
