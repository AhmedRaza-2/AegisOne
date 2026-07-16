import React, { useState, useEffect } from 'react';
import { ArrowRight, ShieldCheck, Cpu, Play, CheckCircle2, ShieldAlert, Shield } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

interface HeroProps {
  onRequestSetup: () => void;
  onViewArchitecture: () => void;
}

export default function Hero({ onRequestSetup, onViewArchitecture }: HeroProps) {
  const [threatCount, setThreatCount] = useState(1248);
  const [activeIncident, setActiveIncident] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [shieldHealth, setShieldHealth] = useState(100);

  // Scroll animations for 3D wow factor
  const { scrollY } = useScroll();
  const rotateX = useTransform(scrollY, [0, 400], [20, 0]);
  const scale = useTransform(scrollY, [0, 400], [0.9, 1]);

  // Auto increment threat count to simulate active real-time filtering
  useEffect(() => {
    const timer = setInterval(() => {
      setThreatCount(prev => prev + Math.floor(Math.random() * 2) + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const triggerAttackSimulation = () => {
    if (simulating) return;
    setSimulating(true);
    setShieldHealth(92);
    setActiveIncident("INCOMING: Phishing URL 'http://login.secure-microsoft-verify.com'");
    
    setTimeout(() => {
      setShieldHealth(100);
      setActiveIncident("INTERCEPTED: Threat isolated inside local VPC. Leak: 0 bytes.");
      setThreatCount(prev => prev + 1);
    }, 1500);

    setTimeout(() => {
      setSimulating(false);
      setActiveIncident(null);
    }, 3800);
  };

  return (
    <section id="hero" className="relative min-h-[100dvh] flex flex-col justify-center py-16 md:py-24 bg-[#F8FAFC] overflow-hidden border-b border-[#E2E8F0]">
      {/* Decorative background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Column - Marketing copy */}
        <motion.div 
          className="lg:col-span-6 space-y-6" 
          id="hero-left-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-3.5 py-1.5 rounded-full" id="hero-badge">
            <span className="w-2 h-2 rounded-full bg-[#0A5ED6] animate-pulse" />
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#0A5ED6]">
              AegisOne Private Link Security
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1 
            variants={itemVariants}
            id="hero-title"
            className="font-sans text-4xl md:text-5xl lg:text-5.5xl font-bold tracking-tight text-[#0F172A] leading-[1.1] md:leading-[1.15]"
          >
            Defending your organization<br />
            <span className="text-[#0A5ED6]">from the outside world.</span>
          </motion.h1>

          {/* Description */}
          <motion.p variants={itemVariants} id="hero-subtitle" className="font-sans text-base text-[#45464D] leading-relaxed max-w-xl">
            Soft on your daily operations, yet absolute against attackers. We build a quiet, sovereign shield around your company to keep scam links, fake logins, and external threats completely at bay.
          </motion.p>

          {/* Actions matching screenshot buttons exactly */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2" id="hero-ctas">
            <button
              id="hero-btn-setup"
              onClick={onRequestSetup}
              className="font-sans text-base font-semibold bg-[#0A5ED6] text-white hover:bg-[#0B63E0] px-6 py-3.5 rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
            >
              Request Organization Setup
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              id="hero-btn-arch"
              onClick={onViewArchitecture}
              className="font-sans text-base font-semibold bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A] px-6 py-3.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Cpu className="w-4 h-4 text-[#0A5ED6]" />
              View Architecture
            </button>
          </motion.div>

          {/* Trust badges */}
          <motion.div variants={itemVariants} className="pt-8 border-t border-[#E2E8F0] flex flex-wrap items-center gap-6 text-[#76777D]" id="hero-trust">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0A5ED6]" />
              <span className="font-sans text-xs font-medium">100% Local Control</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0A5ED6]" />
              <span className="font-sans text-xs font-medium">&lt;1.5ms Check Speed</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0A5ED6]" />
              <span className="font-sans text-xs font-medium">Secure and Compliance Hardened</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Column - Beautiful interactive Organization Shield Perimeter with Sad Attackers */}
        <motion.div 
          className="lg:col-span-6 flex justify-center perspective-[1200px]" 
          id="hero-right-visual"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          style={{ perspective: 1200 }}
        >
          <motion.div 
            className="relative w-full max-w-[490px] rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_80px_-15px_rgba(0,0,0,0.1)] p-6 overflow-hidden flex flex-col justify-between min-h-[460px]"
            style={{ rotateX, scale, transformStyle: "preserve-3d" }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Subtle light mesh background */}
            <div className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[size:16px_16px]" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-blue-50/30 pointer-events-none" />

            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="font-mono text-xs text-slate-700 font-semibold uppercase tracking-wider">Live Shield Simulator</span>
              </div>
              <span className="font-mono text-[10px] text-emerald-600 font-bold uppercase bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Active</span>
            </div>

            {/* Central Simulator Area */}
            <div className="relative h-64 my-6 flex items-center justify-center">
              
              {/* Pulsating Protective Shield Dome */}
              <div className={`absolute w-56 h-56 rounded-full border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                simulating 
                  ? 'border-red-400 bg-red-50 shadow-[0_0_40px_rgba(239,68,68,0.15)]' 
                  : 'border-blue-400 bg-blue-50 shadow-[0_0_40px_rgba(59,130,246,0.1)]'
              }`}>
                {/* Visual ripple pulse inside the dome */}
                <div className={`absolute inset-2 rounded-full border border-blue-500/10 animate-ping [animation-duration:3s] ${simulating ? 'border-red-500/10' : ''}`} />
                
                {/* Organization Building / Headquarters inside the Dome */}
                <div className="relative z-10 flex flex-col items-center text-center">
                  {/* Styled Minimalist HQ Building */}
                  <div className="relative w-24 h-24 bg-white border border-slate-200 rounded-xl p-2 flex flex-col justify-between shadow-lg">
                    {/* Window Rows (Server Grid Style) */}
                    <div className="grid grid-cols-4 gap-1">
                      {[...Array(12)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`h-2 rounded-[2px] transition-colors duration-300 ${
                            simulating 
                              ? 'bg-blue-100' 
                              : i % 3 === 0 
                                ? 'bg-emerald-300' 
                                : 'bg-blue-200'
                          }`} 
                        />
                      ))}
                    </div>

                    {/* Ground floor & secure door */}
                    <div className="flex items-end justify-between border-t border-slate-100 pt-1.5 mt-1.5">
                      <div className="w-2.5 h-4 bg-blue-50 rounded-t border-t border-x border-blue-100" />
                      <span className="font-sans text-[8px] font-bold text-slate-500 tracking-wider">HQ CORP</span>
                      <div className="w-2.5 h-4 bg-blue-50 rounded-t border-t border-x border-blue-100" />
                    </div>

                    {/* Pulsing local green data packet securely staying inside */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-[8px] text-white px-1.5 py-0.5 rounded-full font-mono font-bold animate-bounce shadow">
                      DATA OK
                    </div>
                  </div>
                </div>
              </div>

              {/* Secure Client Device inside the Dome */}
              <div className="absolute right-14 top-8 z-20 flex flex-col items-center">
                <div className="bg-white border border-slate-200 p-1.5 rounded-md text-blue-500 shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="font-mono text-[7px] text-slate-500 mt-1 uppercase font-semibold">Local Client</span>
              </div>

              {/* Outside Attacker Node (Left - Frustrated and sad because of local perimeter blocking) */}
              <div className="absolute -left-2 top-14 z-20 flex flex-col items-center">
                <div className={`p-2.5 rounded-xl border shadow-sm transition-colors duration-300 ${
                  simulating 
                    ? 'bg-red-50 border-red-200 text-red-500 animate-bounce' 
                    : 'bg-white border-slate-200 text-slate-400'
                }`}>
                  {/* Attacker Display Terminal Screen */}
                  <div className="flex flex-col items-center">
                    {/* Sad face hacker symbol */}
                    <span className="font-mono text-xs font-bold text-red-500 tracking-tighter">
                      {simulating ? ':( BLOCKED' : ':( SAD OUTSIDER'}
                    </span>
                    <svg className="w-6 h-6 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
                      <path d="M9 10H9.01" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M15 10H15.01" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 16C16 16 14.5 14.5 12 14.5C9.5 14.5 8 16 8 16" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
                <span className="font-mono text-[8px] text-red-500 mt-1 uppercase font-bold text-center leading-none">Attacker<br/>Locked Out</span>
              </div>

              {/* Dynamic attacking flight paths */}
              {simulating && (
                <>
                  {/* Phishing payload path flying from outsider to shield */}
                  <div className="absolute left-10 top-20 flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-0.5 rounded shadow-md animate-[ping_1.2s_infinite] z-20">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                    <span className="font-mono text-[8px] text-red-600 font-bold tracking-wider">PHISHING LINK</span>
                  </div>

                  {/* Impact sparks showing dome protection */}
                  <svg className="absolute w-full h-full pointer-events-none z-30" viewBox="0 0 400 256">
                    <circle cx="120" cy="115" r="8" fill="#EF4444" className="animate-ping" />
                    <line x1="30" y1="90" x2="120" y2="115" stroke="#EF4444" strokeWidth="2.5" strokeDasharray="4,4" />
                  </svg>
                </>
              )}
            </div>

            {/* Status output box describing sovereign lock status */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-4 text-left min-h-[72px]">
              {activeIncident ? (
                <div className="font-mono text-xs space-y-1.5">
                  <div className="text-red-600 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    {activeIncident.split(":")[0]}:
                  </div>
                  <div className="text-slate-600 leading-tight text-[11px] font-medium">
                    {activeIncident.split(":")[1]}
                  </div>
                </div>
              ) : (
                <div className="font-mono text-xs text-slate-600 space-y-1">
                  <div className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    Sovereign Perimeter: Secure Active
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight font-medium">
                    All employee DNS lookups &amp; clicks remain 100% local. Attackers on the outside are locked out and unable to extract corporate metadata.
                  </div>
                </div>
              )}
            </div>

            {/* Live simulator actions & statistics */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 z-10 gap-4">
              <div className="text-left">
                <div className="font-mono text-[9px] text-slate-400 uppercase tracking-wider font-bold">Threats Blocked</div>
                <div className="font-mono text-lg font-bold text-[#0F172A]">{threatCount.toLocaleString()}</div>
              </div>

              <button
                id="simulate-phish-attack-btn"
                onClick={triggerAttackSimulation}
                disabled={simulating}
                className={`font-sans text-xs font-semibold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  simulating 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-[#0A5ED6] text-white hover:bg-[#0B63E0] shadow-sm hover:shadow-md'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                Trigger Phishing Attempt
              </button>
            </div>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
