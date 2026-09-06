import { ArrowDown, ArrowRight, ChevronDown, Sparkles } from "lucide-react"
import { motion } from "motion/react"
import Button from "../ui-elements/Button"

const HeroSection = () => {
    return (
        <section className="px-4 min-h-svh bg-gradient">
            <div className="min-h-svh max-w-7xl mx-auto pt-16 pb-10 flex flex-col items-center justify-center gap-6 text-center">

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="mt-10 inline-flex items-center gap-2 px-4 py-2 text-xs rounded-full border border-gradient-border"
                >
                    <span>Protect Your Workforce. Secure Your Data.</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
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
                    className="text sm:text-xl max-w-3xl text-zinc-500"
                >
                    Empower your employees to browse securely. AegisOne delivers real-time, AI-driven protection against credential theft and targeted phishing—without compromising data privacy or slowing down your team's productivity.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1 }}
                    className="w-full flex flex-col sm:flex-row justify-center gap-4"
                >
                    <Button href="/register">
                        Get Started
                        <ArrowRight className="group-hover:translate-x-2 transition-transform" size={20} />
                    </Button>
                </motion.div>

                {/* Full-Fledged SaaS Dashboard Screenshot Preview Mockup */}
                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.9, delay: 1.1 }}
                    className="mt-8 mb-6 w-full max-w-7xl relative group"
                >
                    {/* Background Soft Ambient Purple Glow */}
                    <div className="absolute -inset-4 bg-gradient-to-r from-purple-400/20 via-indigo-400/20 to-purple-500/20 rounded-[2.5rem] blur-3xl opacity-80 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    {/* Window Outer Container - AegisOne Security Dashboard Screen */}
                    <div className="relative rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white shadow-[0_30px_90px_-20px_rgba(124,58,237,0.15)] overflow-hidden text-left font-sans">
                        
                        {/* Browser Top Header */}
                        <div className="px-5 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-400/90" />
                                <div className="w-3 h-3 rounded-full bg-amber-400/90" />
                                <div className="w-3 h-3 rounded-full bg-emerald-400/90" />
                            </div>
                            <div className="px-6 py-1 rounded-xl bg-white border border-slate-200/80 font-mono text-[11px] text-slate-500 flex items-center gap-2 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                https://app.aegisone.com/dashboard/admin
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 hidden sm:flex">
                                <span>AegisOne Unified Shield</span>
                            </div>
                        </div>

                        {/* Full Screen Layout: AegisOne Sidebar + Security Dashboard Workspace */}
                        <div className="grid grid-cols-12 min-h-[560px]">
                            
                            {/* Left Navigation Sidebar */}
                            <div className="hidden md:block col-span-3 lg:col-span-2.5 bg-white border-r border-slate-100 p-5 flex flex-col justify-between">
                                <div className="space-y-6">
                                    {/* Brand Header */}
                                    <div className="flex items-center gap-3 px-1">
                                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                            🛡️
                                        </div>
                                        <span className="font-extrabold text-base text-slate-900 tracking-tight">AegisOne</span>
                                    </div>

                                    {/* Search Bar */}
                                    <div className="px-3 py-2 rounded-xl border border-slate-200/80 text-xs text-slate-400 flex items-center justify-between bg-slate-50/50">
                                        <span className="flex items-center gap-2">🔍 Search logs, threats...</span>
                                        <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200/60 text-slate-500 font-mono">⌘K</kbd>
                                    </div>

                                    {/* Nav List */}
                                    <div className="space-y-1 text-xs font-semibold text-slate-600">
                                        <div className="px-3 py-2 rounded-xl bg-purple-50/80 text-purple-700 font-bold flex items-center justify-between shadow-2xs cursor-pointer">
                                            <span className="flex items-center gap-2.5">📊 Admin Command</span>
                                        </div>
                                        <div className="px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                                            <span className="flex items-center gap-2.5">⚙️ Organization Setup</span>
                                        </div>
                                        <div className="px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                                            <span className="flex items-center gap-2.5">👥 Departments &amp; Users</span>
                                        </div>
                                        <div className="px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                                            <span className="flex items-center gap-2.5">✉️ Email Security</span>
                                        </div>
                                        <div className="px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                                            <span className="flex items-center gap-2.5">📈 Threat Analytics</span>
                                        </div>
                                        <div className="px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                                            <span className="flex items-center gap-2.5">🌐 Browser Extension</span>
                                        </div>
                                        <div className="px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                                            <span className="flex items-center gap-2.5">🚨 Incidents</span>
                                            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">3</span>
                                        </div>
                                        <div className="px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                                            <span className="flex items-center gap-2.5">📋 Audit Logs</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Sidebar Footer Links & User Profile */}
                                <div className="space-y-4 pt-6 border-t border-slate-100">
                                    <div className="space-y-1 text-xs font-semibold text-slate-600">
                                        <div className="px-3 py-1.5 hover:bg-slate-50 rounded-lg flex items-center justify-between cursor-pointer">
                                            <span className="flex items-center gap-2.5">⚡ System Status</span>
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        </div>
                                    </div>

                                    {/* User Pill Card */}
                                    <div className="p-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center font-bold text-xs text-purple-700">
                                            AU
                                        </div>
                                        <div className="truncate text-xs">
                                            <p className="font-bold text-slate-800 truncate">Administrator</p>
                                            <p className="text-[10px] text-slate-400 truncate">admin@amdevwork.com</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Security Dashboard Workspace */}
                            <div className="col-span-12 md:col-span-9 lg:col-span-9.5 p-6 sm:p-8 bg-slate-50/40 space-y-6">
                                
                                {/* Header Section */}
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Organization Admin Center</h2>
                                        <p className="text-xs text-slate-500 mt-0.5">Real-time enterprise threat protection &amp; active workforce monitoring</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs font-medium text-slate-600">
                                            <span className="px-3 py-1 bg-white rounded-lg font-bold text-slate-800 shadow-2xs">7 days</span>
                                            <span className="px-3 py-1 hover:text-slate-900 cursor-pointer">30 days</span>
                                            <span className="px-3 py-1 hover:text-slate-900 cursor-pointer">All Time</span>
                                        </div>
                                        <button className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 flex items-center gap-1">
                                            🔄 Refresh
                                        </button>
                                    </div>
                                </div>

                                {/* Top Metric Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    {/* Card 1 */}
                                    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                                <span className="p-1 rounded-lg bg-blue-50 text-blue-600">👥</span> Total Employees
                                            </div>
                                            <div className="text-2xl font-bold text-slate-900">10</div>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/60">
                                            Active
                                        </span>
                                    </div>

                                    {/* Card 2 */}
                                    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600">⚡</span> Total Scans
                                            </div>
                                            <div className="text-2xl font-bold text-slate-900">246</div>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200/60">
                                            ↑ 100%
                                        </span>
                                    </div>

                                    {/* Card 3 */}
                                    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                                <span className="p-1 rounded-lg bg-rose-50 text-rose-600">🛡️</span> Threats Blocked
                                            </div>
                                            <div className="text-2xl font-bold text-rose-600">3</div>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200/60">
                                            Isolated
                                        </span>
                                    </div>

                                    {/* Card 4 */}
                                    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                                <span className="p-1 rounded-lg bg-amber-50 text-amber-600">⚠️</span> Open Incidents
                                            </div>
                                            <div className="text-2xl font-bold text-slate-900">0</div>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200/60">
                                            Clean
                                        </span>
                                    </div>
                                </div>

                                {/* Department Breakdown & Threat Telemetry Card */}
                                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                🏢 Department Breakdown &amp; Threat Telemetry
                                            </h3>
                                            <p className="text-xs text-slate-400 mt-0.5">Click department to open full employee analytics</p>
                                        </div>
                                        <span className="text-xs font-semibold text-purple-600 cursor-pointer hover:underline">View Full Analytics →</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                        {/* Dept 1 */}
                                        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-xs text-slate-900">Information Technology</span>
                                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px]">2 members</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500">Lead: <span className="font-semibold text-slate-800">Ahmed 2</span></p>
                                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                                                <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                                                    <div className="text-slate-400 uppercase font-bold">Scans</div>
                                                    <div className="font-extrabold text-slate-900 text-xs">84</div>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                                                    <div className="text-red-500 uppercase font-bold">Threats</div>
                                                    <div className="font-extrabold text-red-600 text-xs">2</div>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                                                    <div className="text-amber-500 uppercase font-bold">Avg Risk</div>
                                                    <div className="font-extrabold text-amber-600 text-xs">12%</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Dept 2 */}
                                        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-xs text-slate-900">DevOps</span>
                                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px]">3 members</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500">Lead: <span className="font-semibold text-slate-800">Muhid 1</span></p>
                                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                                                <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                                                    <div className="text-slate-400 uppercase font-bold">Scans</div>
                                                    <div className="font-extrabold text-slate-900 text-xs">112</div>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                                                    <div className="text-red-500 uppercase font-bold">Threats</div>
                                                    <div className="font-extrabold text-red-600 text-xs">1</div>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                                                    <div className="text-amber-500 uppercase font-bold">Avg Risk</div>
                                                    <div className="font-extrabold text-amber-600 text-xs">8%</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Dept 3 */}
                                        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-xs text-slate-900">Web Development</span>
                                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px]">3 members</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500">Lead: <span className="font-semibold text-slate-800">Ali Bin 1</span></p>
                                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                                                <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                                                    <div className="text-slate-400 uppercase font-bold">Scans</div>
                                                    <div className="font-extrabold text-slate-900 text-xs">50</div>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                                                    <div className="text-red-500 uppercase font-bold">Threats</div>
                                                    <div className="font-extrabold text-red-600 text-xs">0</div>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                                                    <div className="text-amber-500 uppercase font-bold">Avg Risk</div>
                                                    <div className="font-extrabold text-amber-600 text-xs">0%</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Threat Trends Chart Card */}
                                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                            📈 Threat Trends (7 Days)
                                        </h3>
                                        <span className="text-[11px] font-mono text-slate-400">Live AI Vector Analysis</span>
                                    </div>

                                    {/* Smooth Trend Wave Chart */}
                                    <div className="h-44 w-full relative pt-2">
                                        <svg className="w-full h-full overflow-visible" viewBox="0 0 800 150" preserveAspectRatio="none">
                                            <defs>
                                                <linearGradient id="aegisSafeGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                                                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="aegisThreatGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                                                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            
                                            {/* Safe Scans Green Wave */}
                                            <path d="M0,130 Q120,125 240,120 T480,115 T640,60 T800,20 L800,150 L0,150 Z" fill="url(#aegisSafeGrad)" />
                                            <path d="M0,130 Q120,125 240,120 T480,115 T640,60 T800,20" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />

                                            {/* Threats Red Wave */}
                                            <path d="M0,145 Q200,145 400,143 T600,140 T800,135" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                                            
                                            <circle cx="800" cy="20" r="5" fill="#22c55e" className="animate-pulse" />
                                        </svg>
                                        
                                        {/* Day Labels */}
                                        <div className="flex justify-between text-[11px] font-medium text-slate-400 mt-2 px-1">
                                            <span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.2 }}
                    className="grid mt-5 md:mt-10 max-w-5xl w-full md:grid grid-cols-4 gap-6 text-xs sm:text-base"
                >
                    <div className="text-center">
                        <h2 className="hero-counter">99.8%</h2>
                        <p className="text-gray-600">Threat Prevention</p>
                    </div>
                    <div className="text-center">
                        <h2 className="hero-counter primary-gradient">Zero</h2>
                        <p className="text-gray-600">Productivity Loss</p>
                    </div>
                    <div className="text-center">
                        <h2 className="hero-counter primary-gradient">&lt; 15m</h2>
                        <p className="text-gray-600">To Deploy Company-Wide</p>
                    </div>
                    <div className="text-center">
                        <h2 className="hero-counter primary-gradient">100%</h2>
                        <p className="text-gray-600">Data Sovereignty</p>
                    </div>
                </motion.div>

            </div>
        </section>
    )
}

export default HeroSection