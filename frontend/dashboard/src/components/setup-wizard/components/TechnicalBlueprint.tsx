import React from 'react';
import { Package, Database, Key, LayoutGrid } from 'lucide-react';

export default function TechnicalBlueprint() {
  const blueprintItems = [
    {
      title: 'Simple Setup (Docker)',
      description: 'Quick installation with 1 copy-paste command.',
      icon: Package,
    },
    {
      title: 'Private Data Storage',
      description: 'Keeps all secure logs safely inside your office databases.',
      icon: Database,
    },
    {
      title: 'Secure Local Link Check',
      description: 'Checks internet links instantly right on your network.',
      icon: Key,
    },
    {
      title: 'Simple Control Panel',
      description: 'Clean monitoring screen that anyone can easily read.',
      icon: LayoutGrid,
    },
  ];

  return (
    <section id="architecture" className="min-h-[100dvh] flex flex-col justify-center py-16 bg-white border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Main Blueprint Box Container */}
        <div className="bg-[#0b1c30] text-white rounded-3xl p-8 md:p-12 border border-slate-800 shadow-2xl relative overflow-hidden">
          {/* Subtle circuit pattern mask */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent)] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
            
            {/* Left side text and stats */}
            <div className="lg:col-span-6 space-y-6 text-left" id="blueprint-info">
              <div className="inline-block bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full" id="blueprint-badge">
                <span className="font-mono text-[11px] font-semibold tracking-wider text-blue-400 uppercase">
                  Technical Setup
                </span>
              </div>

              <h2 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
                Built Simple &amp; Fast for Any Server
              </h2>

              <p className="font-sans text-base text-slate-300 leading-relaxed max-w-xl">
                AegisOne is created to be very lightweight and secure. It runs on any local computer or server with almost zero maintenance.
              </p>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-800" id="blueprint-stats">
                <div className="space-y-1">
                  <div className="font-sans text-4xl md:text-5xl font-extrabold text-white tracking-tight flex items-baseline">
                    &lt;1.5ms
                  </div>
                  <div className="font-mono text-xs text-blue-400 font-semibold uppercase tracking-wider">
                    Instant Check Speed
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-sans text-4xl md:text-5xl font-extrabold text-white tracking-tight flex items-baseline">
                    100%
                  </div>
                  <div className="font-mono text-xs text-blue-400 font-semibold uppercase tracking-wider">
                    Sovereign &amp; Private
                  </div>
                </div>
              </div>
            </div>

            {/* Right side items grid */}
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6" id="blueprint-items-grid">
              {blueprintItems.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div 
                    key={idx}
                    id={`blueprint-item-${idx}`}
                    className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/80 transition-all duration-300 group"
                  >
                    <div className="bg-blue-950/80 border border-blue-900/60 p-3 rounded-xl text-blue-400 w-fit mb-4 group-hover:scale-105 transition-transform duration-200">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <h4 className="font-sans font-bold text-lg text-white mb-2">{item.title}</h4>
                    <p className="font-sans text-sm text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
