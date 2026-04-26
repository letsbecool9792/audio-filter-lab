export interface LutData {
  size: number;
  data: Uint8Array;
}

export function parseCubeFile(text: string): LutData {
  const lines = text.split("\n");
  let size = 0;
  const data: number[] = [];

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith("LUT_3D_SIZE")) {
      size = parseInt(line.split(/\s+/)[1]);
      continue;
    }
    if (line.startsWith("#") || line === "") continue;

    const parts = line.split(/\s+/);
    if (parts.length === 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        // Convert 0.0-1.0 float to 0-255 uint8 for better compatibility
        data.push(
          Math.max(0, Math.min(255, Math.round(r * 255))),
          Math.max(0, Math.min(255, Math.round(g * 255))),
          Math.max(0, Math.min(255, Math.round(b * 255))),
          255
        );
      }
    }
  }

  if (size === 0) throw new Error("Invalid LUT size");
  if (data.length !== size * size * size * 4) {
    throw new Error(`Data size mismatch. Expected ${size * size * size * 4}, got ${data.length}`);
  }

  return {
    size,
    data: new Uint8Array(data),
  };
}
