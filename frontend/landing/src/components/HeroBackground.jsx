import React, { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useMotionTemplate } from "motion/react";

export default function HeroBackground() {
  const containerRef = useRef(null);

  // High-performance hardware-accelerated mouse tracking without React state re-renders
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  
  // Smooth spring for premium buttery feel
  const smoothMouseX = useSpring(mouseX, { stiffness: 40, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 40, damping: 20 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    };

    const handleMouseLeave = () => {
      mouseX.set(-1000);
      mouseY.set(-1000);
    };

    const node = containerRef.current;
    if (node) {
      window.addEventListener("mousemove", handleMouseMove);
      node.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (node) {
        node.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [mouseX, mouseY]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0 bg-[#FAFAFA]"
      aria-hidden="true"
    >
      {/* ── 1. PREMIUM AURORA GRADIENT MESH ── */}
      {/* Replacing heavy CSS blur loops with efficient animated blobs */}
      <div className="absolute inset-0 opacity-80">
        <div 
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full animate-blob"
          style={{ background: 'radial-gradient(circle, rgba(147, 197, 253, 0.25) 0%, transparent 70%)' }} 
        />
        <div 
          className="absolute top-[10%] -right-[10%] w-[60%] h-[60%] rounded-full animate-blob animation-delay-2000"
          style={{ background: 'radial-gradient(circle, rgba(165, 180, 252, 0.25) 0%, transparent 70%)' }} 
        />
        <div 
          className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full animate-blob animation-delay-4000"
          style={{ background: 'radial-gradient(circle, rgba(103, 232, 249, 0.25) 0%, transparent 70%)' }} 
        />
      </div>

      {/* ── 2. SUBTLE DOT MESH PATTERN ── */}
      <div 
        className="absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(10, 25, 49, 0.4) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)'
        }}
      />

      {/* ── 3. HARDWARE-ACCELERATED MOUSE SPOTLIGHT ── */}
      <motion.div
        className="absolute inset-0 z-10"
        style={{
          background: useMotionTemplate`radial-gradient(600px circle at ${smoothMouseX}px ${smoothMouseY}px, rgba(59, 130, 246, 0.08), transparent 80%)`,
        }}
      />

      {/* ── 4. HORIZON FADE ── */}
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#FAFAFA] to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA]/80 to-transparent pointer-events-none" />
    </div>
  );
}
