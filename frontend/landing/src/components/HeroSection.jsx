import { useState } from "react"
import { ArrowDown, ArrowRight, ChevronDown, Sparkles } from "lucide-react"
import { motion } from "motion/react"
import Button from "../ui-elements/Button"
import PricingPanel from "./PricingPanel"
import InteractiveProductDemo from "./InteractiveProductDemo"
import HeroBackground from "./HeroBackground"

const HeroSection = ({ onSelectPlan }) => {
    const [showPricingPanel, setShowPricingPanel] = useState(false);

    const handleGetStartedClick = () => {
        setShowPricingPanel(true);
        setTimeout(() => {
            const el = document.getElementById('pricing-panel');
            if (el) {
                const headerOffset = 110; // Account for fixed SiteHeader height
                const elementPosition = el.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        }, 150);
    };

    return (
        <section className="relative overflow-hidden px-4 min-h-svh bg-[#F8FAFC] md:bg-gradient">
            {/* Modern Cyber Grid, Radar Rings & Ambient Glow Background */}
            <HeroBackground />

            <div className="relative z-10 min-h-svh max-w-7xl mx-auto pt-20 sm:pt-24 md:pt-16 pb-8 md:pb-12 flex flex-col items-center justify-start md:justify-center gap-4 sm:gap-6 text-center">

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="mt-4 md:mt-10 inline-flex items-center gap-2 px-3.5 py-2 text-[11px] sm:text-xs font-medium rounded-full border border-slate-200 md:border-gradient-border bg-white text-slate-600 md:bg-white/50 md:text-zinc-700 shadow-sm md:shadow-2xs"
                >
                    <Sparkles className="w-3.5 h-3.5 text-[#0A5ED6]" />
                    <span>Real-time protection for your entire team</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="max-w-[22rem] sm:max-w-3xl text-[1.75rem] sm:text-4xl md:text-5xl lg:text-6xl leading-[1.08] tracking-[-0.025em]"
                >
                    STOP PHISHING AT THE SOURCE WITH
                    <br />
                    <span className="text-gradient bg-clip-text text-transparent">
                        AEGISONE
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.8 }}
                    className="text-sm sm:text-xl max-w-[22rem] sm:max-w-3xl text-slate-600 leading-6 sm:leading-relaxed"
                >
                    Empower your team to browse with complete confidence. AegisOne blocks phishing links, fake login screens, and deceptive downloads in real time — with zero browser slowdowns and 100% privacy.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1 }}
                    className="w-full max-w-xs sm:max-w-none flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4 [&>*]:w-full sm:[&>*]:w-auto"
                >
                    <Button onClick={handleGetStartedClick}>
                        Get Started
                        <ArrowRight className="group-hover:translate-x-2 transition-transform" size={20} />
                    </Button>
                    <Button href="#demo" type="secondary">
                        Try Interactive Demo
                        <ChevronDown size={18} />
                    </Button>
                </motion.div>

                {/* Inline Expandable Pricing & Packages Panel */}
                <PricingPanel
                    isOpen={showPricingPanel}
                    onClose={() => setShowPricingPanel(false)}
                    onSelectPlan={onSelectPlan}
                />

                {/* Key Trust Counters */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.1 }}
                    className="grid my-3 md:my-4 max-w-5xl w-full grid-cols-2 md:grid-cols-4 gap-px md:gap-6 text-xs sm:text-base bg-slate-200 md:bg-transparent border border-slate-200 md:border-x-0 md:border-y md:border-zinc-200/60 rounded-2xl md:rounded-none overflow-hidden md:overflow-visible p-px md:px-0 md:py-6"
                >
                    <div className="text-center bg-white p-4 sm:p-5 md:p-0 md:bg-transparent">
                        <h2 className="hero-counter text-xl sm:text-3xl font-bold text-slate-900">99.8%</h2>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">Threat Prevention</p>
                    </div>
                    <div className="text-center bg-white p-4 sm:p-5 md:p-0 md:bg-transparent">
                        <h2 className="hero-counter primary-gradient text-xl sm:text-3xl font-bold text-[#0A5ED6]">Zero</h2>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">Productivity Loss</p>
                    </div>
                    <div className="text-center bg-white p-4 sm:p-5 md:p-0 md:bg-transparent">
                        <h2 className="hero-counter primary-gradient text-xl sm:text-3xl font-bold text-[#0A5ED6]">&lt; 15m</h2>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">To Deploy Company-Wide</p>
                    </div>
                    <div className="text-center bg-white p-4 sm:p-5 md:p-0 md:bg-transparent">
                        <h2 className="hero-counter primary-gradient text-xl sm:text-3xl font-bold text-[#0A5ED6]">100%</h2>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">Data Sovereignty</p>
                    </div>
                </motion.div>

                {/* Interactive Real-Time Product Dashboard Sandbox */}
                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.9, delay: 1.2 }}
                    className="mt-4 mb-6 w-full max-w-7xl relative"
                >
                    {/* Background Soft Ambient Glow (Optimized: No CSS Blur) */}
                    <div 
                        className="absolute -inset-20 rounded-[3rem] opacity-30 pointer-events-none" 
                        style={{ background: 'radial-gradient(ellipse at center, rgba(74, 127, 167, 0.3) 0%, transparent 60%)' }} 
                    />

                    <InteractiveProductDemo />
                </motion.div>

            </div>
        </section>
    )
}

export default HeroSection
