import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCw, Volume2, VolumeX, Maximize2, Shield, Tv
} from 'lucide-react';
import generateVideo from '../../generate.mp4';

interface ExplainerVideoProps {
  onShowNotification: (msg: string) => void;
}

export default function ExplainerVideo({ onShowNotification }: ExplainerVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sync state with video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);

    // Initial check
    setIsMuted(video.muted);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
    };
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(err => {
        console.log("Playback failed:", err);
      });
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <section id="how-it-works" className="min-h-[90dvh] flex flex-col justify-center py-20 bg-slate-950 text-white relative overflow-hidden border-t border-b border-slate-900">
      {/* Decorative cyber grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-25 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#0A5ED6]/10 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">

        {/* Header Block */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#0A5ED6]/15 border border-[#0A5ED6]/30 px-3.5 py-1.5 rounded-full">
            <Tv className="w-3.5 h-3.5 text-[#0A5ED6]" />
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-blue-400">
              Interactive 3D Simulation
            </span>
          </div>
          <h2 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-white">
            See AegisOne <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">How It Works</span> in Action
          </h2>
          <p className="font-sans text-sm text-slate-400 leading-relaxed">
            Take a self-guided animated tour of our threat containment. Watch how our perimeter stands guard without inspecting private data.
          </p>
        </div>

        {/* Centered Large Video Container */}
        <div className="max-w-4xl mx-auto w-full">
          <div className="relative bg-slate-900/90 border border-slate-800 rounded-3xl p-6 overflow-hidden shadow-2xl min-h-[450px] flex flex-col justify-between">
            {/* Camera Frame Corners */}
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-slate-700 pointer-events-none" />
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-slate-700 pointer-events-none" />
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-slate-700 pointer-events-none" />
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-slate-700 pointer-events-none" />

            {/* Simulated Live View Finder Badge */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  AEGISONE_EXPLAINER_PART_1.MP4
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full">
                <Shield className="w-3 h-3" />
                <span>Sovereign Protection Active</span>
              </div>
            </div>

            {/* Video Stage */}
            <div className="flex-1 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800/60 flex items-center justify-center relative group min-h-[300px]">
              <video
                ref={videoRef}
                src={generateVideo}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-contain max-h-[450px]"
                onClick={togglePlay}
              />
            </div>

            {/* Custom Video Controls Panel */}
            <div className="border-t border-slate-800/80 pt-4 mt-4">
              <div className="flex items-center justify-between gap-4">
                {/* Control Actions */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-[#0A5ED6] hover:bg-blue-600 text-white flex items-center justify-center transition-colors shadow-lg cursor-pointer"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <div className="font-mono text-xs text-slate-400">
                    <span className="text-white">{formatTime(currentTime)}</span>
                    <span className="mx-1">/</span>
                    <span>{formatTime(duration || 10)}</span>
                  </div>
                </div>

                {/* Secondary Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleMute}
                    className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={handleFullscreen}
                    className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
