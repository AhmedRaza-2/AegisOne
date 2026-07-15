import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize2, PlayCircle
} from 'lucide-react';
import generateVideo from '../../generate.mp4';
import { motion } from 'framer-motion';

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
    <section id="how-it-works" className="py-24 bg-[#F8FAFC] relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 relative z-10 w-full flex flex-col items-center">

        {/* Header Block */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mb-12 space-y-5"
        >
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <PlayCircle className="w-4 h-4 text-[#0A5ED6]" />
            <span className="font-sans text-xs font-semibold text-slate-600">
              Watch Product Demo
            </span>
          </div>
          <h2 className="font-sans text-4xl md:text-5xl font-bold tracking-tight text-[#0F172A]">
            See how AegisOne <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Works</span>
          </h2>
          <p className="font-sans text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto">
            Take a self-guided tour of our threat containment. Watch how our perimeter stands guard without inspecting your private data.
          </p>
        </motion.div>

        {/* Centered Large Video Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="w-full max-w-5xl mx-auto"
        >
          <div className="relative bg-white border border-slate-200/80 rounded-[2rem] p-2 sm:p-4 overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] transition-shadow duration-500 hover:shadow-[0_30px_70px_-15px_rgba(0,0,0,0.08)] flex flex-col">
            
            {/* Video Stage */}
            <div className="relative w-full aspect-video bg-slate-50 rounded-[1.5rem] overflow-hidden border border-slate-100">
              <video
                ref={videoRef}
                src={generateVideo}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover cursor-pointer hover:scale-[1.01] transition-transform duration-700 ease-out"
                onClick={togglePlay}
              />
              
              {/* Optional: Centered Play Overlay if paused (Enhances UX) */}
              {!isPlaying && (
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[2px] pointer-events-none transition-opacity duration-300"
                >
                  <div className="w-20 h-20 rounded-full bg-white/90 shadow-xl flex items-center justify-center text-[#0A5ED6] pl-1.5 backdrop-blur-sm border border-white">
                    <Play className="w-8 h-8" />
                  </div>
                </div>
              )}
            </div>

            {/* Refined Minimal Video Controls */}
            <div className="pt-4 pb-2 px-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                {/* Control Actions */}
                <div className="flex items-center gap-5">
                  <button
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full bg-[#0A5ED6] hover:bg-blue-600 text-white flex items-center justify-center transition-colors shadow-md cursor-pointer"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                  </button>

                  <div className="font-mono text-sm font-medium text-slate-400 select-none">
                    <span className="text-slate-700">{formatTime(currentTime)}</span>
                    <span className="mx-1.5 text-slate-300">/</span>
                    <span>{formatTime(duration || 10)}</span>
                  </div>
                </div>

                {/* Secondary Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleMute}
                    className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={handleFullscreen}
                    className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}
