import React, { useState, useRef, useEffect } from 'react';
import { Tv, ShieldCheck } from 'lucide-react';

interface ExplainerVideoProps {
  onShowNotification: (msg: string) => void;
}

export default function ExplainerVideo({ onShowNotification }: ExplainerVideoProps) {
  const [videoIndex, setVideoIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videos = [
    '/generate (1).mp4',
    '/bro_i_need_longer_video_sec.mp4'
  ];

  const handleVideoEnded = () => {
    if (videoIndex < videos.length - 1) {
      setVideoIndex(videoIndex + 1);
    } else {
      // Loop back to the first video
      setVideoIndex(0);
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(e => console.log("Autoplay prevented:", e));
    }
  }, [videoIndex]);

  return (
    <section id="how-it-works" className="min-h-[100dvh] flex flex-col justify-center py-20 bg-slate-950 text-white relative overflow-hidden border-t border-b border-slate-900">
      {/* Decorative cyber grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-25 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#0A5ED6]/10 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 relative z-10 w-full">

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

        {/* Single Video Player View */}
        <div className="flex flex-col bg-slate-900/90 border border-slate-800 rounded-3xl p-4 md:p-6 relative overflow-hidden shadow-2xl">
          {/* Camera Frame Corners */}
          <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-slate-700 pointer-events-none" />
          <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-slate-700 pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-slate-700 pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-slate-700 pointer-events-none" />

          {/* Player Badge */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 font-bold">AegisOne_Explainer_Part_{videoIndex + 1}.mp4</span>
            </div>
            <div className="font-mono text-[10px] text-[#0A5ED6] font-semibold bg-[#0A5ED6]/10 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Sovereign Protection Active
            </div>
          </div>

          {/* Actual Video Element */}
          <div className="w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
            <video
              ref={videoRef}
              src={videos[videoIndex]}
              onEnded={handleVideoEnded}
              controls
              autoPlay
              muted
              playsInline
              className="w-full aspect-video object-contain"
            />
          </div>

        </div>

      </div>
    </section>
  );
}

