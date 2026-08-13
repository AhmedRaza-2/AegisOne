import React from 'react';
import { Compass, Server, Download, BarChart3, ArrowRight, CheckCircle2, Copy, Play } from 'lucide-react';

interface OnboardingFlowProps {
  onStartOnboarding: () => void;
  onSelectPhase: (phaseNum: number) => void;
}

export default function OnboardingFlow({ onStartOnboarding, onSelectPhase }: OnboardingFlowProps) {
  const [activeTab, setActiveTab] = React.useState<number>(1);
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  const phases = [
    {
      num: 1,
      title: 'Simple Planning & Mapping',
      tagline: 'PHASE 1',
      description: 'We help you map your office computer setups and design the safest way to guard your company server.',
      icon: Compass,
      side: 'right',
      demo: {
        title: 'Office Network Mapping Goals',
        code: `[Step 1: Planning Checklist]\n✔ Assess current office routers and local PCs\n✔ Select deployment area (e.g. Pakistan Edge)\n✔ Map internal devices for secure link redirection\n✔ No technical expertise required on your end`,
        actionText: 'Request Office Setup Consultation',
      }
    },
    {
      num: 2,
      title: 'Install on Your Server',
      tagline: 'PHASE 2',
      description: 'Run our lightweight security program on your computer or company server. No complex hardware needed.',
      icon: Server,
      side: 'left',
      demo: {
        title: '1-Command Shield Startup',
        code: `[Step 2: Simple Server Launch]\n✔ Copy custom private launcher license key\n✔ Paste 1 simple command on your office PC or server\n✔ Lightweight security shield is instantly active\n✔ Saves all logs securely inside your local office DB`,
        actionText: 'Test Local Software Integration',
      }
    },
    {
      num: 3,
      title: 'Add to Employee Browsers',
      tagline: 'PHASE 3',
      description: 'Install our small, lightweight extension directly on your staff Chrome or Edge browsers in 1 click.',
      icon: Download,
      side: 'right',
      demo: {
        title: 'Easy Browser Security Dispatch',
        code: `[Step 3: Staff Device Setup]\n✔ Distribute small extension links to your staff\n✔ Install with 1 click in Google Chrome or Microsoft Edge\n✔ Runs quietly in the background without slowing PCs\n✔ Blocks suspicious email and chat login scam links`,
        actionText: 'Generate Browser Profiles',
      }
    },
    {
      num: 4,
      title: 'Safe Dashboard Monitoring',
      tagline: 'PHASE 4',
      description: 'Open your simple local dashboard to view real-time safe status report. Absolutely zero data leaks.',
      icon: BarChart3,
      side: 'left',
      demo: {
        title: 'Sovereign Security Monitoring',
        code: `[Step 4: Safe Reporting Dashboard]\n✔ Click and log in to your Safe Admin Panel\n✔ See live scam links blocked & threat reports\n✔ Zero cloud telemetry - All scan data is kept inside your walls\n✔ Absolute 100% privacy & regulatory compliance`,
        actionText: 'Launch Live Threat Monitor',
      }
    },
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <section id="deployment" className="min-h-[100dvh] flex flex-col justify-center py-16 md:py-24 bg-[#F8FAFC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-[#0F172A]">
            Easy 4-Step Setup for Your Business
          </h2>
          <p className="font-sans text-base text-[#45464D] leading-relaxed">
            Set up complete local link protection across all office devices in just a few days, without needing complex IT experts or expensive cloud fees.
          </p>
        </div>

        {/* Timeline Visual & Interactive Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Vertical Timeline Left (8 cols on large screens) */}
          <div className="lg:col-span-7 relative">
            {/* Central line */}
            <div className="absolute left-6 md:left-1/2 top-4 bottom-4 w-0.5 bg-[#E2E8F0] -translate-x-1/2" />

            {/* Phases */}
            <div className="space-y-12">
              {phases.map((phase) => {
                const IconComponent = phase.icon;
                const isActive = activeTab === phase.num;

                return (
                  <div 
                    key={phase.num}
                    id={`onboarding-phase-${phase.num}`}
                    className={`relative flex flex-col md:flex-row items-start md:items-center ${
                      phase.side === 'left' ? 'md:flex-row-reverse' : ''
                    }`}
                  >
                    {/* Node on central line */}
                    <div 
                      className={`absolute left-6 md:left-1/2 -translate-x-1/2 z-10 w-12 h-12 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${
                        isActive 
                          ? 'bg-[#0A5ED6] text-white border-[#0A5ED6] shadow-md shadow-blue-300' 
                          : 'bg-white text-slate-400 border-slate-300 hover:border-[#0A5ED6] hover:text-[#0A5ED6]'
                      }`}
                      onClick={() => setActiveTab(phase.num)}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>

                    {/* Empty block for horizontal balance */}
                    <div className="hidden md:block md:w-1/2" />

                    {/* Card container */}
                    <div className="w-full md:w-1/2 pl-14 md:pl-0 md:px-8">
                      <div 
                        onClick={() => setActiveTab(phase.num)}
                        className={`p-6 rounded-xl border transition-all duration-300 text-left cursor-pointer ${
                          isActive 
                            ? 'bg-white border-[#0A5ED6] shadow-md scale-[1.02]' 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold text-[#0A5ED6] block mb-1">
                          {phase.tagline}
                        </span>
                        <h3 className="font-sans font-bold text-lg text-[#0F172A] mb-2">
                          {phase.title}
                        </h3>
                        <p className="font-sans text-sm text-[#45464D] leading-relaxed">
                          {phase.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Console Right (5 cols on large screens) */}
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
              {/* Console Header */}
              <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="font-mono text-xs text-slate-400">Interactive Walkthrough Console</span>
                </div>
                <span className="font-mono text-[10px] text-blue-400 bg-blue-950 border border-blue-900 px-2 py-0.5 rounded uppercase font-semibold">
                  Phase {activeTab}
                </span>
              </div>

              {/* Console Body */}
              <div className="p-5 space-y-4 text-left">
                <h4 className="font-sans font-semibold text-white text-base">
                  {phases[activeTab - 1].demo.title}
                </h4>
                
                {/* Code Block Container */}
                <div className="relative bg-slate-950 rounded-lg p-4 border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto min-h-[140px] whitespace-pre">
                  <button 
                    onClick={() => handleCopy(phases[activeTab - 1].demo.code)}
                    className="absolute top-2 right-2 p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                    title="Copy code"
                  >
                    {copiedText === phases[activeTab - 1].demo.code ? (
                      <span className="text-[10px] text-emerald-400 font-sans font-semibold px-1">Copied!</span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {phases[activeTab - 1].demo.code}
                </div>

                {/* Simulated action button */}
                <button
                  id={`btn-console-phase-${activeTab}`}
                  onClick={() => onSelectPhase(activeTab)}
                  className="font-sans w-full text-center text-sm font-semibold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  {phases[activeTab - 1].demo.actionText}
                </button>
              </div>
            </div>
            
            {/* Tiny helper hint */}
            <p className="text-center font-sans text-xs text-slate-400 mt-3 italic">
              Click any Phase on the timeline or the console button to trigger local live simulations!
            </p>
          </div>

        </div>

        {/* Start Onboarding Today Button */}
        <div className="text-center mt-16" id="onboarding-cta">
          <button
            id="btn-start-onboarding-today"
            onClick={onStartOnboarding}
            className="font-sans text-base font-semibold bg-[#0A5ED6] text-white hover:bg-[#0B63E0] px-8 py-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 inline-flex items-center gap-2 cursor-pointer"
          >
            Start Onboarding Today
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </section>
  );
}
