import type { AudioFilterEffect } from "./types";

export const HELIUM_FILTER: AudioFilterEffect = {
  id: "spongebob",
  name: "Helium",
  emoji: "🎈",
  description: "High-pitched chipmunk voice",
  pitch: 12,
  rate: 1.35,
  amplify: 2,
  lut: "/filters/spongebob.cube",
};

export const ROBOT_FILTER: AudioFilterEffect = {
  id: "npc",
  name: "Robot",
  emoji: "🤖",
  description: "Metallic robotic voice",
  pitch: 1,
  amplify: 3,
  echo: [25, 30, 300],
  distortion: 25,
  lut: "/filters/npc.cube",
};

export const DRAMATIC_FILTER: AudioFilterEffect = {
  id: "god",
  name: "Dramatic",
  emoji: "🎭",
  description: "Cinematic dramatic effect",
  pitch: -5,
  rate: 0.8,
  amplify: 4,
  echo: [60, 25, 600],
  lut: "/filters/god.cube",
};

export const ALIEN_FILTER: AudioFilterEffect = {
  id: "unhinged",
  name: "Alien",
  emoji: "👽",
  description: "Distorted alien voice",
  pitch: 4,
  rate: 1.15,
  amplify: 8,
  echo: [30, 60, 700],
  lut: "/filters/unhinged.cube",
};

export const MEGAPHONE_FILTER: AudioFilterEffect = {
  id: "aura",
  name: "Megaphone",
  emoji: "📢",
  description: "Loud megaphone with echo",
  amplify: 3,
  pitch: -4,
  distortion: 12,
  lut: "/filters/aura.cube",
};

export const ALL_FILTERS: AudioFilterEffect[] = [
  HELIUM_FILTER,
  ROBOT_FILTER,
  DRAMATIC_FILTER,
  ALIEN_FILTER,
  MEGAPHONE_FILTER,
];

const AUDIO_FILTER_MAP: Record<string, AudioFilterEffect> = {
  [HELIUM_FILTER.id]: HELIUM_FILTER,
  [ROBOT_FILTER.id]: ROBOT_FILTER,
  [DRAMATIC_FILTER.id]: DRAMATIC_FILTER,
  [ALIEN_FILTER.id]: ALIEN_FILTER,
  [MEGAPHONE_FILTER.id]: MEGAPHONE_FILTER,
};

export function getAudioFilterFromId(
  id: string | null | undefined,
): AudioFilterEffect | null {
  // Handle the default "clean" state or missing IDs
  if (!id || id === "clean") {
    return null;
  }
  return AUDIO_FILTER_MAP[id] || null;
}
