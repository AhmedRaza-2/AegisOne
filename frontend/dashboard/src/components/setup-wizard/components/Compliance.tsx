import React from 'react';
import { ShieldCheck, FileCheck, MapPin, Download } from 'lucide-react';

interface ComplianceProps {
  onDownloadWhitepaper: () => void;
}

export default function Compliance({ onDownloadWhitepaper }: ComplianceProps) {
  const complianceCards = [
    {
      title: 'High Security (SOC2 Style)',
      description: 'Since no data leaves your network, you pass third-party security audits instantly with ease.',
      icon: FileCheck,
    },
    {
      title: 'Local Data Boundaries (GDPR Safe)',
      description: 'Your employees browsing history never crosses country borders, keeping you safe from data laws.',
      icon: MapPin,
    },
    {
      title: 'Customer Info Safeguard (HIPAA Ready)',
      description: 'Prevent sensitive client emails or personal links from accidentally leaking to foreign clouds.',
      icon: ShieldCheck,
    },
  ];

  return (
    <section id="compliance" className="min-h-[100dvh] flex flex-col justify-center py-16 md:py-24 bg-[#0F172A] text-white overflow-hidden relative border-b border-slate-800">
      {/* Abstract technical glowing background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08)_0%,transparent_50%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">

        {/* Left column */}
        <div className="lg:col-span-5 space-y-6" id="compliance-left-col">
          <div className="inline-block bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full" id="compliance-badge">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-blue-400 uppercase">
              Compliance &amp; Safety
            </span>
          </div>

          <h2 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
            International Compliance. Simplified for Everyone.
          </h2>

          <p className="font-sans text-base text-slate-300 leading-relaxed">
            When your business data stays 100% inside your local computers, answering security questions from foreign clients or banks becomes simple and quick.
          </p>

          <button
            id="btn-download-whitepaper"
            onClick={onDownloadWhitepaper}
            className="font-sans text-sm font-semibold bg-[#0A5ED6] text-white hover:bg-[#0B63E0] px-5 py-3 rounded-lg shadow-md transition-all duration-200 flex items-center gap-2 group cursor-pointer"
          >
            <Download className="w-4 h-4 text-white" />
            Download Security PDF
          </button>
        </div>

        {/* Right column - Bento Grid or elegant slate-colored list */}
        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6" id="compliance-cards-grid">
          {complianceCards.map((card, idx) => {
            const IconComponent = card.icon;
            return (
              <div
                key={idx}
                id={`compliance-card-${idx}`}
                // First card spans full width if odd, or let's layout as 3 beautiful boxes with different order
                className={`p-6 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all duration-300 ${idx === 2 ? 'md:col-span-2' : ''
                  }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-950 border border-blue-800 p-2.5 rounded-lg text-blue-400">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <h4 className="font-sans font-semibold text-lg text-white">{card.title}</h4>
                </div>
                <p className="font-sans text-sm text-slate-400 leading-relaxed">
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
