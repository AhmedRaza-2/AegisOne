import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, BrainCircuit, Activity, Eye, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CoreModules() {
  const navigate = useNavigate();

  const handleNavigation = (path: string) => {
    window.scrollTo(0, 0);
    navigate(path);
  };

  return (
    <section className="py-24 bg-white relative overflow-hidden" id="core-modules">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 text-[#0A5ED6] font-semibold text-sm tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0A5ED6] animate-pulse"></span>
            Platform Features
          </div>
          <h2 className="font-sans text-4xl md:text-5xl font-bold tracking-tight text-[#0F172A]">
            Core protection modules
          </h2>
        </div>

        {/* Masonry Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: AI Risk Intelligence Engine (Tall) */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-[#0A5ED6] rounded-[2rem] p-8 md:p-10 text-white flex flex-col justify-between group cursor-pointer h-[400px] md:h-[500px] relative overflow-hidden shadow-lg"
            onClick={() => handleNavigation('/features/ai-engine')}
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            
            <div className="space-y-4 relative z-10">
              <h3 className="font-sans text-2xl md:text-3xl font-bold leading-tight">
                AI Risk Intelligence Engine
              </h3>
              <p className="font-sans text-blue-100 text-sm md:text-base leading-relaxed">
                A core detection engine that identifies emails, URLs, QR codes, and behavioral anomalies. Produces real-time threat classification and confidence metrics.
              </p>
            </div>

            <div className="flex justify-between items-end relative z-10">
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                 <BrainCircuit className="w-16 h-16 text-white/80" strokeWidth={1.5} />
              </div>
              <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#0A5ED6] group-hover:scale-110 transition-transform shadow-md">
                <ArrowUpRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          {/* Card 2: Real-Time Monitoring & Active Prevention (Tall) */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-[#0A5ED6] rounded-[2rem] p-8 md:p-10 text-white flex flex-col justify-between group cursor-pointer h-[400px] md:h-[500px] relative overflow-hidden shadow-lg"
            onClick={() => handleNavigation('/features/real-time-monitoring')}
          >
            {/* Background Accent */}
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

            <div className="space-y-4 relative z-10">
              <h3 className="font-sans text-2xl md:text-3xl font-bold leading-tight">
                Real-Time Interception & Prevention
              </h3>
              <p className="font-sans text-blue-100 text-sm md:text-base leading-relaxed">
                Monitors browser activity to block harmful links and credential harvesting automatically. Stops the attack before submission occurs.
              </p>
            </div>

            <div className="flex justify-between items-end relative z-10">
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                 <Activity className="w-16 h-16 text-white/80" strokeWidth={1.5} />
              </div>
              <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#0A5ED6] group-hover:scale-110 transition-transform shadow-md">
                <ArrowUpRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          {/* Column 3: Two Short Cards */}
          <div className="flex flex-col gap-6 h-full">
            
            {/* Card 3: Explainable AI (XAI) */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-[#094bb0] rounded-[2rem] p-8 text-white flex flex-col justify-between group cursor-pointer flex-1 relative overflow-hidden shadow-lg"
              onClick={() => handleNavigation('/features/explainable-ai')}
            >
              <div className="space-y-3 relative z-10">
                <h3 className="font-sans text-xl md:text-2xl font-bold leading-tight pr-12">
                  Explainable AI (XAI) for Transparency
                </h3>
                <p className="font-sans text-blue-100 text-sm leading-relaxed pr-8">
                  Shows clear logic behind every detection decision, promoting trust and enterprise adoption.
                </p>
              </div>

              <div className="flex justify-between items-end mt-6 relative z-10">
                <Eye className="w-8 h-8 text-white/50" />
                <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#0A5ED6] group-hover:scale-110 transition-transform shadow-md">
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>

            {/* Card 4: Analytics Dashboard */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-[#0b6dfa] rounded-[2rem] p-8 text-white flex flex-col justify-between group cursor-pointer flex-1 relative overflow-hidden shadow-lg"
              onClick={() => handleNavigation('/features/analytics')}
            >
              <div className="space-y-3 relative z-10">
                <h3 className="font-sans text-xl md:text-2xl font-bold leading-tight pr-12">
                  Centralized Analytics Dashboard
                </h3>
                <p className="font-sans text-blue-100 text-sm leading-relaxed pr-8">
                  Manage threat metrics, respond to incidents, and monitor system health easily.
                </p>
              </div>

              <div className="flex justify-between items-end mt-6 relative z-10">
                <BarChart3 className="w-8 h-8 text-white/50" />
                <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#0A5ED6] group-hover:scale-110 transition-transform shadow-md">
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>

          </div>

        </div>
      </div>
    </section>
  );
}
