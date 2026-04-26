import React, { useState, useEffect, useRef } from "react";
import { Upload, Settings2, SlidersHorizontal, RefreshCw, Play, Pause, Palette } from "lucide-react";
import { ALL_FILTERS } from "./preset";
import type { AudioFilterEffect } from "./types";
import { WebAudioPipeline } from "./WebAudioPipeline";
import { parseCubeFile, type LutData } from "./LutParser";
import { VideoFilterCanvas } from "./VideoFilterCanvas";

export default function App() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [pipelineState, setPipelineState] = useState<string>("idle");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentLut, setCurrentLut] = useState<LutData | null>(null);
  const [lutName, setLutName] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pipelineRef = useRef<WebAudioPipeline | null>(null);

  const [activePresetId, setActivePresetId] = useState<string | null>("clean");
  
  const [customFilter, setCustomFilter] = useState<AudioFilterEffect>({
    id: "custom",
    name: "Custom",
    emoji: "🛠️",
    description: "Custom settings",
    pitch: 0,
    amplify: 0,
    distortion: 0,
    rate: 1,
    echo: [0, 0, 0], // wetDryMix, feedback, delayMs
    reverb: [1, 0, 0.1], // inGain, reverbMix, reverbTime
  });

  useEffect(() => {
    pipelineRef.current = new WebAudioPipeline({ loop: true, volume: 1 });
    pipelineRef.current.onStateChange = setPipelineState;

    let raf: number;
    const updateTime = () => {
      if (pipelineRef.current && pipelineRef.current.state === "playing") {
        setCurrentTime(pipelineRef.current.currentTime);
        setDuration(pipelineRef.current.duration);
      }
      raf = requestAnimationFrame(updateTime);
    };
    updateTime();

    return () => {
      pipelineRef.current?.dispose();
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoSrc(url);

    try {
      const arrayBuffer = await file.arrayBuffer();
      await pipelineRef.current?.load(arrayBuffer);
      
      // Auto play after load
      applySettings(customFilter, true);
    } catch (err) {
      console.error("Failed to load audio", err);
    }
  };

  const applySettings = (filter: AudioFilterEffect, restart: boolean = true) => {
    if (!pipelineRef.current) return;
    
    if (pipelineRef.current.state !== "playing") {
      pipelineRef.current.play(filter, restart ? 0 : undefined);
    } else {
      pipelineRef.current.applyFilter(filter, restart);
    }
    
    if (videoRef.current) {
      videoRef.current.playbackRate = filter.rate || 1;
      if (restart) {
        videoRef.current.currentTime = 0;
      }
      videoRef.current.play().catch(e => console.log("Video play error:", e));
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (!pipelineRef.current || !videoRef.current) return;
    if (isPlaying) {
      pipelineRef.current.pause();
      videoRef.current.pause();
    } else {
      pipelineRef.current.resume();
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    if (pipelineRef.current) {
      pipelineRef.current.stop();
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }
    setVideoSrc(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const handleSeek = (time: number) => {
    if (!pipelineRef.current || !videoRef.current) return;
    
    // Seek both
    pipelineRef.current.play(customFilter, time);
    videoRef.current.currentTime = time;
    
    if (!isPlaying) {
      pipelineRef.current.pause();
      videoRef.current.pause();
    }
    setCurrentTime(time);
  };

  const handleApply = () => {
    applySettings(customFilter, true);
  };

  const handleLutUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lut = parseCubeFile(text);
      setCurrentLut(lut);
      setLutName(file.name);
    } catch (err) {
      console.error("Failed to parse LUT", err);
      alert("Invalid .cube file format");
    }
  };

  const handlePresetSelect = async (preset: AudioFilterEffect | null) => {
    setActivePresetId(preset?.id || "clean");
    
    if (preset) {
      const newFilter = {
        id: "custom",
        name: "Custom",
        emoji: "🛠️",
        description: "Custom settings",
        pitch: preset.pitch || 0,
        amplify: preset.amplify || 0,
        distortion: preset.distortion || 0,
        rate: preset.rate || 1,
        echo: preset.echo || [0, 0, 0],
        reverb: preset.reverb || [1, 0, 0.1],
      };
      setCustomFilter(newFilter);
      applySettings(newFilter, true);

      if (preset.lut) {
        try {
          const res = await fetch(preset.lut);
          const text = await res.text();
          setCurrentLut(parseCubeFile(text));
          setLutName(`${preset.id}.cube`);
        } catch (e) {
          console.error("Error loading preset LUT", e);
        }
      } else {
        setCurrentLut(null);
        setLutName(null);
      }
    } else {
      const cleanFilter = {
        id: "custom",
        name: "Custom",
        emoji: "🛠️",
        description: "Custom settings",
        pitch: 0,
        amplify: 0,
        distortion: 0,
        rate: 1,
        echo: [0, 0, 0] as [number, number, number],
        reverb: [1, 0, 0.1] as [number, number, number],
      };
      setCustomFilter(cleanFilter);
      applySettings({ id: "clean", name: "Clean", emoji: "🧼", description: "" }, true);
      setCurrentLut(null);
      setLutName(null);
    }
  };

  const handleSliderChange = (key: keyof AudioFilterEffect, value: number) => {
    setActivePresetId("custom");
    setCustomFilter(prev => ({ ...prev, [key]: value }));
  };

  const handleEchoChange = (index: number, value: number) => {
    setActivePresetId("custom");
    setCustomFilter(prev => {
      const newEcho = [...(prev.echo || [0, 0, 0])] as [number, number, number];
      newEcho[index] = value;
      return { ...prev, echo: newEcho };
    });
  };

  const handleReverbChange = (index: number, value: number) => {
    setActivePresetId("custom");
    setCustomFilter(prev => {
      const newReverb = [...(prev.reverb || [1, 0, 0.1])] as [number, number, number];
      newReverb[index] = value;
      return { ...prev, reverb: newReverb };
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-zinc-800">
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">Audio Filter Lab</h1>
              <p className="text-sm text-zinc-500 font-medium tracking-wide">Web Audio API • Real-time DSP</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-2 transition-colors ${
              pipelineState === "playing" ? "bg-green-500/10 text-green-400 border-green-500/20" : 
              pipelineState === "loading" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
              pipelineState === "ready" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
              "bg-zinc-800/50 text-zinc-400 border-zinc-800"
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                pipelineState === "playing" ? "bg-green-400 animate-pulse" : 
                pipelineState === "loading" ? "bg-yellow-400 animate-pulse" :
                pipelineState === "ready" ? "bg-blue-400" :
                "bg-zinc-500"
              }`} />
              {pipelineState.toUpperCase()}
            </div>
          </div>
        </header>

        {!videoSrc ? (
          <div className="h-[60vh] border-2 border-dashed border-zinc-800/60 hover:border-indigo-500/50 rounded-3xl flex flex-col items-center justify-center bg-zinc-900/20 hover:bg-zinc-900/40 transition-all group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-20 h-20 mb-6 rounded-full bg-zinc-800/50 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/10 transition-all duration-500">
              <Upload className="w-8 h-8 text-zinc-400 group-hover:text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Upload Video</h2>
            <p className="text-zinc-500 max-w-sm text-center mb-8">Drag and drop an .mp4 or .mov file here, or click to browse your files.</p>
            <label className="relative px-8 py-3 bg-white text-black font-semibold rounded-full hover:bg-zinc-200 transition-all cursor-pointer shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md">
              Select File
              <input type="file" accept="video/mp4,video/quicktime" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video ring-1 ring-zinc-800 shadow-2xl flex items-center justify-center group">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="hidden"
                  muted
                  loop
                  playsInline
                />
                <VideoFilterCanvas 
                  videoRef={videoRef} 
                  lutData={currentLut} 
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={togglePlayPause}
                />
                
                {/* Control Bar Overlay */}
                <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={togglePlayPause} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors shadow-lg">
                    {isPlaying ? <Pause className="w-5 h-5 text-white fill-current" /> : <Play className="w-5 h-5 text-white fill-current" />}
                  </button>
                  
                  <button onClick={handleReset} className="px-4 py-2 rounded-xl bg-zinc-800/80 backdrop-blur-md text-sm font-medium text-white hover:bg-zinc-700/80 transition-colors shadow-lg flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    New Video
                  </button>
                </div>
              </div>

              {/* Seek Bar */}
              <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-mono text-zinc-500 w-10">{formatTime(currentTime)}</span>
                  <div className="flex-1 relative h-6 flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={duration || 1}
                      step={0.01}
                      value={currentTime}
                      onChange={(e) => handleSeek(parseFloat(e.target.value))}
                      className="w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-runnable-track]:bg-zinc-800 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:-mt-[3px] [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 w-10 text-right">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Video LUT Section */}
              <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-zinc-400" />
                    <h3 className="text-sm font-semibold text-zinc-300 tracking-wide uppercase">Video LUT</h3>
                  </div>
                  {lutName && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20 font-medium">
                      {lutName}
                    </span>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <label className="flex-1 px-5 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" />
                    {currentLut ? "Change LUT (.cube)" : "Upload LUT (.cube)"}
                    <input type="file" accept=".cube" className="hidden" onChange={handleLutUpload} />
                  </label>
                  {currentLut && (
                    <button 
                      onClick={() => { setCurrentLut(null); setLutName(null); }}
                      className="px-5 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-300 tracking-wide uppercase">Quick Presets</h3>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x scrollbar-hide pr-6">
                  <button
                    onClick={() => handlePresetSelect(null)}
                    className={`flex-shrink-0 snap-start px-5 py-3 rounded-xl border text-sm font-medium transition-all ${
                      activePresetId === "clean" 
                        ? "bg-white text-black border-white shadow-lg" 
                        : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    <span className="uppercase tracking-wider font-bold">clean</span>
                  </button>
                  {ALL_FILTERS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className={`flex-shrink-0 snap-start px-5 py-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-start gap-1 ${
                        activePresetId === preset.id 
                          ? "bg-white text-black border-white shadow-lg" 
                          : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      <span className="uppercase tracking-wider font-bold">{preset.id}</span>
                    </button>
                  ))}
                  <div className="w-2 flex-shrink-0" />
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm flex flex-col h-[calc(100vh-140px)] sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Developer Panel</h2>
                  <p className="text-xs text-zinc-500">Fine-tune DSP parameters</p>
                </div>
                <button
                  onClick={handleApply}
                  className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:scale-95 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Apply & Restart
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Playback</h3>
                  <SliderRow 
                    label="Rate" 
                    value={customFilter.rate || 1} 
                    min={0.25} max={3} step={0.05} 
                    onChange={(v: number) => handleSliderChange("rate", v)} 
                    format={(v: number) => `${v.toFixed(2)}x`}
                  />
                  <SliderRow 
                    label="Pitch" 
                    value={customFilter.pitch || 0} 
                    min={-24} max={24} step={1} 
                    onChange={(v: number) => handleSliderChange("pitch", v)} 
                    format={(v: number) => `${v > 0 ? '+' : ''}${v} st`}
                  />
                </div>

                <div className="h-px w-full bg-zinc-800/50" />

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tone</h3>
                  <SliderRow 
                    label="Amplify" 
                    value={customFilter.amplify || 0} 
                    min={-20} max={20} step={1} 
                    onChange={(v: number) => handleSliderChange("amplify", v)} 
                    format={(v: number) => `${v > 0 ? '+' : ''}${v} dB`}
                  />
                  <SliderRow 
                    label="Distortion" 
                    value={customFilter.distortion || 0} 
                    min={0} max={100} step={1} 
                    onChange={(v: number) => handleSliderChange("distortion", v)} 
                    format={(v: number) => `${v}%`}
                  />
                </div>

                <div className="h-px w-full bg-zinc-800/50" />

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Reverb</h3>
                  <SliderRow 
                    label="Input Gain" 
                    value={customFilter.reverb?.[0] ?? 1} 
                    min={0} max={5} step={0.1} 
                    onChange={(v: number) => handleReverbChange(0, v)} 
                    format={(v: number) => v.toFixed(1)}
                  />
                  <SliderRow 
                    label="Mix" 
                    value={customFilter.reverb?.[1] ?? 0} 
                    min={0} max={1} step={0.01} 
                    onChange={(v: number) => handleReverbChange(1, v)} 
                    format={(v: number) => `${(v * 100).toFixed(0)}%`}
                  />
                  <SliderRow 
                    label="Decay Time" 
                    value={customFilter.reverb?.[2] ?? 0.1} 
                    min={0.1} max={5} step={0.1} 
                    onChange={(v: number) => handleReverbChange(2, v)} 
                    format={(v: number) => `${v.toFixed(1)}s`}
                  />
                </div>

                <div className="h-px w-full bg-zinc-800/50" />

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Echo</h3>
                  <SliderRow 
                    label="Mix" 
                    value={customFilter.echo?.[0] ?? 0} 
                    min={0} max={100} step={1} 
                    onChange={(v: number) => handleEchoChange(0, v)} 
                    format={(v: number) => `${v}%`}
                  />
                  <SliderRow 
                    label="Feedback" 
                    value={customFilter.echo?.[1] ?? 0} 
                    min={0} max={100} step={1} 
                    onChange={(v: number) => handleEchoChange(1, v)} 
                    format={(v: number) => `${v}%`}
                  />
                  <SliderRow 
                    label="Delay" 
                    value={customFilter.echo?.[2] ?? 0} 
                    min={0} max={1000} step={10} 
                    onChange={(v: number) => handleEchoChange(2, v)} 
                    format={(v: number) => `${v}ms`}
                  />
                </div>

                <div className="h-px w-full bg-zinc-800/50" />

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  format?: (val: number) => string;
}

function SliderRow({ label, value, min, max, step, onChange, format }: SliderRowProps) {
  return (
    <div className="group">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{label}</label>
        <span className="text-xs font-mono bg-zinc-800/80 text-zinc-400 px-2 py-1 rounded border border-zinc-700/50">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-runnable-track]:bg-zinc-700 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg focus:outline-none"
      />
    </div>
  );
}
