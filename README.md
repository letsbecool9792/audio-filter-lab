# Web-based Video Audio Filter Lab

A premium, real-time audio processing environment for video files. Built with Vite, React, TypeScript, and the Web Audio API, this tool allows users to upload videos and apply sophisticated audio DSP filters that match mobile implementation logic.

## 🚀 Features

- **Video Processing**: Supports `.mp4` and `.mov` file uploads with high-fidelity audio extraction.
- **Real-time DSP Pipeline**:
  - **Pitch Shifting**: Semantic semitone adjustments via `detune`.
  - **Playback Speed**: Variable rate control (0.25x - 3.0x).
  - **Distortion**: High-quality `WaveShaper` curve mapping.
  - **Amplify**: Precision gain control in decibels (-20dB to +20dB).
  - **Reverb**: Procedural white-noise impulse generation using `ConvolverNode`.
  - **Echo**: Feedback delay loops with wet/dry mixing.
- **Premium UI**:
  - Dark mode aesthetic with glassmorphism effects.
  - Interactive Developer Panel for fine-tuning individual DSP parameters.
  - Quick Preset system for instant effects (Helium, Robot, Dramatic, etc.).
  - Custom-styled white slider handles for enhanced visibility.
  - Integrated play/pause controls and video-syncing logic.

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Audio Engine**: Standard Web Audio API

## 🏁 Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## 🧪 Technical Details

The audio engine uses a modular `WebAudioPipeline` class that manages the `AudioContext` lifecycle. It handles:
1. **Asynchronous Decoding**: `decodeAudioData` is used to convert file buffers into playable `AudioBuffer` objects.
2. **Node Mapping**: Procedurally builds a connection graph from source to destination based on active filter parameters.
3. **Frame Sync**: Muted `<video>` playback is synchronized with the processed audio output, ensuring that visual frames match processed audio timestamps even when playback rates are modified.
