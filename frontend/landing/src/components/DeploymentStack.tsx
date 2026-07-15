import React from 'react';
import { Box, Database, Zap, LayoutGrid, Users, Code, Server, Laptop, Workflow, CheckCircle2 } from 'lucide-react';

export default function DeploymentStack() {
  const stackItems = [
    {
      name: 'Docker',
      description: 'Standard container runner.',
      icon: Box,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 border-blue-100',
    },
    {
      name: 'PostgreSQL',
      description: 'Safe local storage database.',
      icon: Database,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50 border-sky-100',
    },
    {
      name: 'FastAPI',
      description: 'Super fast link checking engine.',
      icon: Zap,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50 border-emerald-100',
    },
    {
      name: 'Vue.js',
      description: 'Clean screen control panel.',
      icon: LayoutGrid,
      color: 'text-green-500',
      bgColor: 'bg-green-50 border-green-100',
    },
    {
      name: 'RBAC',
      description: 'Safe login protection.',
      icon: Users,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50 border-indigo-100',
    },
    {
      name: 'REST API',
      description: 'Simple code connections.',
      icon: Code,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 border-purple-100',
    },
  ];

  return (
    <section id="documentation" className="min-h-[70dvh] flex flex-col justify-center py-16 md:py-24 bg-[#F8FAFC] border-b border-[#E2E8F0] overflow-hidden">
      <div className="w-full px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-[#0F172A]">
            Standard Safe Technology Stack
          </h2>
          <p className="font-sans text-base text-[#45464D] leading-relaxed">
            We use simple, reliable, and high-performance tools to keep the protection running fast without any server errors.
          </p>
        </div>

        {/* Marquee Container */}
        <div className="relative w-full max-w-[1400px] mx-auto overflow-hidden">
          {/* Gradient fade on edges */}
          <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-[#F8FAFC] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-[#F8FAFC] to-transparent z-10 pointer-events-none" />
          
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused] gap-6 px-3">
            {/* Double the items for seamless infinite scroll */}
            {[...stackItems, ...stackItems].map((item, idx) => {
              const IconComponent = item.icon;
              return (
                <div 
                  key={idx}
                  className="w-48 bg-white border border-slate-100 rounded-2xl p-6 flex flex-col items-center text-center shadow-[0_4px_20px_rgb(0,0,0,0.03)] shrink-0 transition-transform duration-300 hover:-translate-y-1 cursor-default"
                >
                  {/* Icon Container */}
                  <div className={`p-4 rounded-xl border mb-4 ${item.bgColor} ${item.color} flex items-center justify-center`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  
                  {/* Name */}
                  <h4 className="font-sans font-bold text-sm text-[#0F172A] mb-1">
                    {item.name}
                  </h4>
                  
                  {/* Subtitle / Description */}
                  <span className="font-sans text-[11px] text-[#76777D] leading-snug">
                    {item.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Minimum Deployment Requirements */}
        <div className="max-w-5xl mx-auto mt-24 pt-16 border-t border-slate-200">
          <div className="text-center mb-10 space-y-3">
            <div className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-slate-600 text-xs font-semibold uppercase tracking-widest">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Prerequisites
            </div>
            <h3 className="font-sans text-2xl md:text-3xl font-bold text-[#0F172A]">Minimum Deployment Requirements</h3>
            <p className="font-sans text-[#45464D] max-w-2xl mx-auto">Everything you need to successfully deploy the AEGIS-ONE in-house AI engine and ensure full digital coverage.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Requirement 1: Infrastructure */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                  <Server className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-base text-slate-800">Server Infrastructure</h4>
              </div>
              <ul className="text-sm text-slate-600 space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold mt-0.5">•</span>
                  <span><strong>Docker Engine</strong> for containerized deployment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold mt-0.5">•</span>
                  <span><strong>PostgreSQL / Supabase</strong> database</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold mt-0.5">•</span>
                  <span>On-premise server or Private Cloud VM</span>
                </li>
              </ul>
            </div>
            
            {/* Requirement 2: Client-Side */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                  <Laptop className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-base text-slate-800">Client-Side Deployment</h4>
              </div>
              <ul className="text-sm text-slate-600 space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">•</span>
                  <span><strong>Modern Web Browsers</strong> (Chrome/Edge support)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">•</span>
                  <span>Ability to install Enterprise Browser Extensions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">•</span>
                  <span>Local network access to AEGIS Core</span>
                </li>
              </ul>
            </div>

            {/* Requirement 3: Integrations */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-50 text-purple-600 p-2.5 rounded-xl">
                  <Workflow className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-base text-slate-800">Enterprise Integrations</h4>
              </div>
              <ul className="text-sm text-slate-600 space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold mt-0.5">•</span>
                  <span><strong>Email System Access</strong> (O365 / Workspace)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold mt-0.5">•</span>
                  <span>Support for REST API / Webhooks</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold mt-0.5">•</span>
                  <span>SIEM Tool compatibility (Optional)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
