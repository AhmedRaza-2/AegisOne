import React from 'react';
import { Box, Database, Zap, LayoutGrid, Users, Code } from 'lucide-react';

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
    <section id="documentation" className="min-h-[100dvh] flex flex-col justify-center py-16 bg-[#F8FAFC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-[#0F172A]">
            Standard Safe Technology Stack
          </h2>
          <p className="font-sans text-base text-[#45464D] leading-relaxed">
            We use simple, reliable, and high-performance tools to keep the protection running fast without any server errors.
          </p>
        </div>

        {/* Stack Items Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6" id="stack-items-grid">
          {stackItems.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div 
                key={idx}
                id={`stack-item-${idx}`}
                className="bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col items-center text-center hover:shadow-md hover:border-slate-300 transition-all duration-300 hover:-translate-y-1"
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
    </section>
  );
}
