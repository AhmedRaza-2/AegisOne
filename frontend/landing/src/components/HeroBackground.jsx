import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";

export default function HeroBackground() {
  const containerRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => {
      setIsHovered(false);
      setMousePos({ x: -1000, y: -1000 });
    };

    const node = containerRef.current;
    if (node) {
      window.addEventListener("mousemove", handleMouseMove);
      node.addEventListener("mouseenter", handleMouseEnter);
      node.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (node) {
        node.removeEventListener("mouseenter", handleMouseEnter);
        node.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0"
      aria-hidden="true"
    >
      {/* ── 1. AMBIENT AURORA GRADIENT MESH (Luminous Sapphire & Azure Glows) ── */}
      {/* Top Center Sovereign Light Beacon */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.75, 0.9, 0.75],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1200px] h-[680px] rounded-full blur-[100px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(10, 94, 214, 0.22) 0%, rgba(37, 99, 235, 0.14) 35%, rgba(56, 189, 248, 0.08) 60%, transparent 80%)",
        }}
      />

      {/* Side Accent Orb (Left Soft Indigo) */}
      <motion.div
        animate={{
          x: [-20, 20, -20],
          y: [-10, 15, -10],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-48 -left-28 w-[550px] h-[550px] rounded-full blur-[110px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(79, 70, 229, 0.12) 0%, rgba(14, 165, 233, 0.05) 50%, transparent 75%)",
        }}
      />

      {/* Side Accent Orb (Right Soft Cyan) */}
      <motion.div
        animate={{
          x: [20, -20, 20],
          y: [15, -10, 15],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-64 -right-28 w-[580px] h-[580px] rounded-full blur-[110px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.14) 0%, rgba(10, 94, 214, 0.06) 50%, transparent 75%)",
        }}
      />

      {/* ── 2. INTERACTIVE MOUSE SPOTLIGHT (Vercel/Stripe style illumination) ── */}
      <div
        className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
        style={{
          opacity: isHovered ? 1 : 0.35,
          background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, rgba(10, 94, 214, 0.12), rgba(56, 189, 248, 0.04) 40%, transparent 80%)`,
        }}
      />

      {/* ── 3. PRECISION GEOMETRIC DOT & CROSS MATRIX ── */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          maskImage: "radial-gradient(ellipse 90% 75% at 50% 35%, black 40%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 75% at 50% 35%, black 40%, transparent 85%)",
        }}
      >
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Fine Grid Pattern (32px x 32px) */}
            <pattern id="modern-fine-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="rgba(10, 94, 214, 0.05)"
                strokeWidth="1"
              />
              <circle cx="16" cy="16" r="0.8" fill="rgba(10, 94, 214, 0.18)" />
            </pattern>

            {/* Major Accent Block with Target Crosshairs (128px x 128px = 4x4 fine cells) */}
            <pattern id="modern-major-cross" width="128" height="128" patternUnits="userSpaceOnUse">
              <path
                d="M 128 0 L 0 0 0 128"
                fill="none"
                stroke="rgba(10, 94, 214, 0.09)"
                strokeWidth="1.2"
              />
              {/* Corner cross (+) mark */}
              <path
                d="M -5 0 L 5 0 M 0 -5 L 0 5"
                stroke="rgba(10, 94, 214, 0.38)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Center micro dot */}
              <circle cx="64" cy="64" r="1.5" fill="rgba(10, 94, 214, 0.22)" />
            </pattern>

            {/* Animated Laser Gradient Definition */}
            <linearGradient id="laser-beam-v1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0A5ED6" stopOpacity="0" />
              <stop offset="60%" stopColor="#0A5ED6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="1" />
            </linearGradient>

            <linearGradient id="laser-beam-v2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
              <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#0A5ED6" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Render Grids */}
          <rect width="100%" height="100%" fill="url(#modern-fine-grid)" />
          <rect width="100%" height="100%" fill="url(#modern-major-cross)" />
        </svg>
      </div>

      {/* ── 4. DYNAMIC CYBER LASER BEAMS (Flowing down specific vertical lanes) ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        {/* Beam 1: Left Sector */}
        <motion.line
          x1="18%"
          y1="-100"
          x2="18%"
          y2="100%"
          stroke="url(#laser-beam-v1)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="120 800"
          initial={{ strokeDashoffset: 1000 }}
          animate={{ strokeDashoffset: -400 }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="opacity-70"
        />

        {/* Beam 2: Center-Right Sector */}
        <motion.line
          x1="74%"
          y1="-100"
          x2="74%"
          y2="100%"
          stroke="url(#laser-beam-v2)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="160 900"
          initial={{ strokeDashoffset: 1200 }}
          animate={{ strokeDashoffset: -500 }}
          transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="opacity-65"
        />

        {/* Beam 3: Far Right Sector */}
        <motion.line
          x1="88%"
          y1="-100"
          x2="88%"
          y2="100%"
          stroke="url(#laser-beam-v1)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="100 850"
          initial={{ strokeDashoffset: 1000 }}
          animate={{ strokeDashoffset: -450 }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="opacity-50"
        />

        {/* Beam 4: Left Mid Sector */}
        <motion.line
          x1="32%"
          y1="-100"
          x2="32%"
          y2="100%"
          stroke="url(#laser-beam-v2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="140 950"
          initial={{ strokeDashoffset: 1100 }}
          animate={{ strokeDashoffset: -500 }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="opacity-60"
        />
      </svg>

      {/* ── 5. PULSING EDGE DEFENSE NODES (Tactical Network Beacon Points) ── */}
      <div className="absolute inset-0 pointer-events-none max-w-7xl mx-auto">
        {/* Node A (Upper Left) */}
        <div className="absolute top-[18%] left-[8%] hidden sm:block">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#0A5ED6] shadow-sm shadow-blue-500/50" />
          </span>
        </div>

        {/* Node B (Upper Right) */}
        <div className="absolute top-[22%] right-[10%] hidden sm:block">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 shadow-sm shadow-cyan-500/50" />
          </span>
        </div>

        {/* Node C (Mid Left) */}
        <div className="absolute top-[52%] left-[4%] hidden lg:block">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>

        {/* Node D (Mid Right) */}
        <div className="absolute top-[58%] right-[5%] hidden lg:block">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0A5ED6]" />
          </span>
        </div>
      </div>

      {/* ── 6. 3D PERSPECTIVE HORIZON PLANE (Grounding the Demo Showcase) ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[480px] pointer-events-none overflow-hidden"
        style={{
          perspective: "900px",
          maskImage: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
        }}
      >
        {/* Tilted 3D grid floor */}
        <div
          className="w-[200%] h-[800px] -ml-[50%] origin-bottom"
          style={{
            transform: "rotateX(72deg) translateY(120px)",
            backgroundImage: `
              linear-gradient(to right, rgba(10, 94, 214, 0.12) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(10, 94, 214, 0.12) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
          }}
        />

        {/* Horizon Glow Line */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[1px] bg-gradient-to-r from-transparent via-[#0A5ED6]/40 to-transparent shadow-[0_0_24px_rgba(10,94,214,0.6)]" />
      </div>

      <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-[#FAFAFA] to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </div>
  );
}
