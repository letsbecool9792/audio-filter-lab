import React, { useEffect, useRef } from "react";
import type { LutData } from "./LutParser";

interface VideoFilterCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  lutData: LutData | null;
  className?: string;
  onClick?: () => void;
}

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_video;
  uniform sampler2D u_lut;
  uniform float u_lutSize;
  uniform bool u_useLut;

  void main() {
    vec4 color = texture2D(u_video, v_texCoord);
    
    if (!u_useLut) {
      gl_FragColor = color;
      return;
    }

    float blue = color.b * (u_lutSize - 1.0);
    
    float quad1_z = floor(blue);
    float quad2_z = ceil(blue);
    
    // Texture is laid out as a horizontal strip of size * size
    // Width = size * size, Height = size
    
    vec2 texPos1;
    texPos1.x = (quad1_z * u_lutSize + color.r * (u_lutSize - 1.0) + 0.5) / (u_lutSize * u_lutSize);
    texPos1.y = (color.g * (u_lutSize - 1.0) + 0.5) / u_lutSize;
    
    vec2 texPos2;
    texPos2.x = (quad2_z * u_lutSize + color.r * (u_lutSize - 1.0) + 0.5) / (u_lutSize * u_lutSize);
    texPos2.y = (color.g * (u_lutSize - 1.0) + 0.5) / u_lutSize;
    
    vec4 newColor1 = texture2D(u_lut, texPos1);
    vec4 newColor2 = texture2D(u_lut, texPos2);
    
    gl_FragColor = vec4(mix(newColor1.rgb, newColor2.rgb, fract(blue)), color.a);
  }
`;

export function VideoFilterCanvas({ videoRef, lutData, className, onClick }: VideoFilterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const lutTextureRef = useRef<WebGLTexture | null>(null);
  const videoTextureRef = useRef<WebGLTexture | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) return;
    glRef.current = gl;

    // Create program
    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = createProgram(gl, vs, fs);
    programRef.current = program;
    gl.useProgram(program);

    // Set up geometry (fullscreen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]), gl.STATIC_DRAW);
    
    const texCoordLoc = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // Textures
    videoTextureRef.current = createTexture(gl);
    lutTextureRef.current = createTexture(gl);

    // Animation loop
    let raf: number;
    const render = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        if (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
        }

        gl.viewport(0, 0, canvas.width, canvas.height);
        
        // Update video texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTextureRef.current);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoRef.current);
        gl.uniform1i(gl.getUniformLocation(program, "u_video"), 0);

        // Update LUT if changed
        if (lutData) {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, lutTextureRef.current);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lutData.size * lutData.size, lutData.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutData.data);
          gl.uniform1i(gl.getUniformLocation(program, "u_lut"), 1);
          gl.uniform1f(gl.getUniformLocation(program, "u_lutSize"), lutData.size);
          gl.uniform1i(gl.getUniformLocation(program, "u_useLut"), 1);
        } else {
          gl.uniform1i(gl.getUniformLocation(program, "u_useLut"), 0);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [videoRef, lutData]);

  return <canvas ref={canvasRef} className={className} onClick={onClick} />;
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw new Error("Shader compile error");
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    throw new Error("Program link error");
  }
  return program;
}

function createTexture(gl: WebGLRenderingContext) {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}
