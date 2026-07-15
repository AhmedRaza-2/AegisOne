import React from 'react';
import { ShieldCheck, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

interface ReadySectionProps {
  onRequestSetup: () => void;
  onScheduleDemo: () => void;
}

export default function ReadySection({ onRequestSetup, onScheduleDemo }: ReadySectionProps) {
  return (
    <section id="ready-section" className="min-h-[70dvh] flex flex-col justify-center py-24 bg-white text-center relative overflow-hidden">
      {/* Premium Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-blue-50/30 to-[#F8FAFC] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(10,94,214,0.08)_0%,transparent_60%)] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto px-6 space-y-6 relative z-10"
      >
        
        {/* Large Shield Shield Logo */}
        <div className="mx-auto bg-white border border-slate-100 shadow-md p-5 rounded-full w-fit text-[#0A5ED6] animate-pulse">
          <ShieldCheck className="w-12 h-12" />
        </div>

        {/* Heading */}
        <h2 className="font-sans text-4xl md:text-5xl font-bold tracking-tight text-[#0F172A]">
          Ready to Secure Your Office?
        </h2>

        {/* Description */}
        <p className="font-sans text-lg text-slate-500 leading-relaxed max-w-xl mx-auto">
          Protect your company files and staff from online scam links. Start your private shield software setup today.
        </p>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4" id="ready-ctas">
          <button
            id="ready-btn-setup"
            onClick={onRequestSetup}
            className="relative overflow-hidden font-sans text-base font-semibold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-8 py-3.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer animate-shine"
          >
            Request Setup
          </button>
          <button
            id="ready-btn-demo"
            onClick={onScheduleDemo}
            className="font-sans text-base font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-[#0F172A] px-8 py-3.5 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-[#0A5ED6]" />
            Schedule Live Demo
          </button>
        </div>

        {/* Fine print */}
        <p className="font-sans text-xs text-[#76777D] italic">
          No complicated setup or hidden fees. We help you every step of the way.
        </p>

      </motion.div>
    </section>
  );
}
