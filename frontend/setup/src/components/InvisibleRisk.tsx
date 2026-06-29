import React from 'react';
import { Shield, ShieldAlert, CheckCircle2, XCircle, Network, CloudOff, Laptop, Lock, Server } from 'lucide-react';

export default function InvisibleRisk() {
  return (
    <section id="why-in-house" className="min-h-[100dvh] flex flex-col justify-center py-16 md:py-24 bg-white border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-[#0F172A]">
            The Hidden Risks of Normal Link Checkers
          </h2>
          <p className="font-sans text-base text-[#45464D] leading-relaxed">
            Most security systems send your links to external servers. This means they can read your private document names and website history. Here is how AegisOne keeps your business safe and completely private.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Card 1: Third-Party Cloud Security (Red) */}
          <div className="border border-red-100 rounded-2xl bg-red-50/20 p-6 md:p-8 flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#ba1a1a]" />
                  <h3 className="font-sans font-bold text-lg text-[#0F172A]">Other Internet Security Providers</h3>
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider bg-red-100 text-[#ba1a1a] px-2.5 py-1 rounded-md">
                  Sends Data Away
                </span>
              </div>

              {/* Diagram */}
              <div className="bg-white border border-red-100/50 rounded-xl p-6 mb-8 flex items-center justify-between relative overflow-hidden h-40">
                {/* Background Grid Lines */}
                <div className="absolute inset-0 bg-[radial-gradient(#fee2e2_1px,transparent_1px)] bg-[size:16px_16px] opacity-40" />
                
                {/* Your Network */}
                <div className="flex flex-col items-center gap-1.5 z-10 w-24 text-center">
                  <div className="bg-slate-100 border border-slate-200 p-3 rounded-lg text-[#0F172A]">
                    <Network className="w-6 h-6" />
                  </div>
                  <span className="font-sans text-xs font-semibold text-slate-700">Your Office</span>
                </div>

                {/* Arrow / Leak line */}
                <div className="flex-1 flex flex-col items-center justify-center relative px-2">
                  {/* Flashing Danger Badge */}
                  <div className="absolute -top-3 z-10 bg-[#ffdad6] border border-red-200 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold text-[#93000a] animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                    SENDING OUTSIDE
                  </div>
                  {/* Dot animation line */}
                  <div className="w-full h-[2px] border-t-2 border-dashed border-red-400 relative">
                    <div className="absolute top-[-4px] left-0 w-2 h-2 rounded-full bg-red-600 animate-[ping_1.5s_infinite]" />
                  </div>
                  <span className="text-[10px] font-mono text-red-500 mt-2 font-medium">Your links and logs</span>
                </div>

                {/* External Vendor */}
                <div className="flex flex-col items-center gap-1.5 z-10 w-24 text-center">
                  <div className="bg-red-100 border border-red-200 p-3 rounded-lg text-red-600">
                    <CloudOff className="w-6 h-6" />
                  </div>
                  <span className="font-sans text-xs font-semibold text-slate-700">Their Servers</span>
                </div>
              </div>

              {/* Bullet details */}
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-[#ba1a1a] shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-sans font-semibold text-sm text-[#0F172A] block">Privacy Leaks</strong>
                    <span className="font-sans text-sm text-[#45464D]">Private document titles, bank links, and company emails are sent to their systems, where they could be saved or leaked.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-[#ba1a1a] shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-sans font-semibold text-sm text-[#0F172A] block">Slower Internet Speed</strong>
                    <span className="font-sans text-sm text-[#45464D]">Every single click has to travel across the globe to their servers first before opening. This causes heavy lag for your team.</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 2: AegisOne Secure Perimeter (Blue) */}
          <div className="border border-blue-100 rounded-2xl bg-blue-50/20 p-6 md:p-8 flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#3B82F6]" />
                  <h3 className="font-sans font-bold text-lg text-[#0F172A]">AegisOne Private Link Security</h3>
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider bg-blue-100 text-[#3B82F6] px-2.5 py-1 rounded-md">
                  100% Inside Your Server
                </span>
              </div>

              {/* Diagram */}
              <div className="bg-white border border-blue-100/50 rounded-xl p-6 mb-8 flex items-center justify-center relative overflow-hidden h-40">
                {/* Background Grid Lines */}
                <div className="absolute inset-0 bg-[radial-gradient(#dbeafe_1px,transparent_1px)] bg-[size:16px_16px] opacity-40" />

                {/* Dotted border boundary representation */}
                <div className="border-2 border-dashed border-blue-400/80 bg-[#f8fafc]/80 rounded-xl px-8 py-4 flex items-center justify-between gap-12 relative z-10">
                  <span className="absolute -top-3 left-4 bg-[#3B82F6] text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded tracking-widest">
                    YOUR OFFICE NETWORK
                  </span>

                  {/* Device */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-lg text-slate-700">
                      <Laptop className="w-5 h-5" />
                    </div>
                    <span className="font-sans text-[10px] font-semibold text-slate-500">Employee Device</span>
                  </div>

                  {/* Locked line connection */}
                  <div className="flex items-center gap-1.5 relative w-16">
                    <div className="w-full h-[2px] bg-[#3B82F6]" />
                    <div className="absolute left-1/2 -translate-x-1/2 bg-[#3B82F6] text-white p-1 rounded-full border border-white">
                      <Lock className="w-3 h-3" />
                    </div>
                  </div>

                  {/* Browser extension/agent */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="bg-blue-600 border border-blue-700 p-2.5 rounded-lg text-white">
                      <Server className="w-5 h-5" />
                    </div>
                    <span className="font-sans text-[10px] font-semibold text-slate-700">Aegis Core</span>
                  </div>
                </div>
              </div>

              {/* Bullet details */}
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-sans font-semibold text-sm text-[#0F172A] block">100% Privacy Guard</strong>
                    <span className="font-sans text-sm text-[#45464D]">The check happens entirely on your own computers or local office server. Absolutely no data is sent outside.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-sans font-semibold text-sm text-[#0F172A] block">Instant Protection (Zero Lag)</strong>
                    <span className="font-sans text-sm text-[#45464D]">Because everything is checked locally, dangerous links are blocked instantly without slowing down your internet.</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
