import { motion } from 'motion/react'
import { Cpu, Eye, Target, Shield } from "lucide-react";

const values = [
    {
        icon: Cpu,
        title: "Zero Disruption",
        description: "Runs silently in the background without slowing down devices or interrupting employee workflows.",
    },
    {
        icon: Eye,
        title: "Clear Threat Context",
        description: "Security alerts are provided in plain English, ensuring your team knows exactly why a site was blocked.",
    },
    {
        icon: Target,
        title: "Unified Risk Management",
        description: "Comprehensive protection across URLs, text, images, and attachments under a single pane of glass.",
    },
    {
        icon: Shield,
        title: "100% Data Privacy",
        description: "Aggregates critical security metrics without ever tracking or storing your employees' private browsing history.",
    },
];

/* ── Premium SVG illustration — security node network ───────────────────── */
const SecurityIllustration = () => (
    <svg viewBox="0 0 460 380" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
            <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8f94fb" />
                <stop offset="100%" stopColor="#4e54c8" />
            </linearGradient>
            <linearGradient id="nodeBg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#eef0ff" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="softShadow">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#4e54c8" floodOpacity="0.15" />
            </filter>
        </defs>

        {/* Background grid */}
        {[...Array(10)].map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 42} x2="460" y2={i * 42} stroke="#e8eaff" strokeWidth="1" />
        ))}
        {[...Array(12)].map((_, i) => (
            <line key={`v${i}`} x1={i * 42} y1="0" x2={i * 42} y2="380" stroke="#e8eaff" strokeWidth="1" />
        ))}

        {/* Connection lines from shield to nodes */}
        <line x1="230" y1="145" x2="100" y2="240" stroke="#8f94fb" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.5" />
        <line x1="230" y1="145" x2="230" y2="255" stroke="#8f94fb" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.5" />
        <line x1="230" y1="145" x2="360" y2="240" stroke="#8f94fb" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.5" />
        <line x1="100" y1="240" x2="60" y2="320" stroke="#c7c9f7" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
        <line x1="360" y1="240" x2="400" y2="320" stroke="#c7c9f7" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />

        {/* Central shield */}
        <g filter="url(#softShadow)">
            <circle cx="230" cy="110" r="58" fill="url(#shieldGrad)" opacity="0.12" />
            <circle cx="230" cy="110" r="44" fill="url(#shieldGrad)" opacity="0.18" />
            <circle cx="230" cy="110" r="32" fill="url(#shieldGrad)" />
            {/* Shield icon path */}
            <path d="M230 95 L219 99.5V108.5C219 115.2 223.8 121.5 230 123C236.2 121.5 241 115.2 241 108.5V99.5L230 95Z" fill="white" />
            <path d="M228 104H232V114H228V104ZM230 117C228.9 117 228.3 116.4 228.3 115.3C228.3 114.2 228.9 113.6 230 113.6C231.1 113.6 231.7 114.2 231.7 115.3C231.7 116.4 231.1 117 230 117Z" fill="url(#shieldGrad)" />
        </g>

        {/* Pulse rings */}
        <circle cx="230" cy="110" r="52" stroke="#8f94fb" strokeWidth="1" opacity="0.3">
            <animate attributeName="r" values="52;70;52" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* ── Scanner node (left) */}
        <g filter="url(#softShadow)">
            <rect x="48" y="208" width="104" height="64" rx="12" fill="url(#nodeBg)" stroke="#c7c9f7" strokeWidth="1.5" />
            <rect x="60" y="220" width="28" height="28" rx="7" fill="#eef0ff" stroke="#c7c9f7" strokeWidth="1" />
            {/* Globe icon */}
            <circle cx="74" cy="234" r="9" stroke="#4e54c8" strokeWidth="1.5" />
            <line x1="74" y1="225" x2="74" y2="243" stroke="#4e54c8" strokeWidth="1" />
            <line x1="65" y1="234" x2="83" y2="234" stroke="#4e54c8" strokeWidth="1" />
            <ellipse cx="74" cy="234" rx="5" ry="9" stroke="#4e54c8" strokeWidth="1" />
            <text x="95" y="232" fontSize="9" fontWeight="700" fill="#1e1b4b" fontFamily="Tomorrow, sans-serif">URL</text>
            <text x="95" y="244" fontSize="8" fill="#6b7280" fontFamily="Tomorrow, sans-serif">Scanner</text>
            {/* Status pill */}
            <rect x="60" y="254" width="44" height="12" rx="6" fill="#d1fae5" />
            <circle cx="68" cy="260" r="3" fill="#10b981" />
            <text x="73" y="263" fontSize="7" fill="#065f46" fontFamily="Tomorrow, sans-serif">Active</text>
        </g>

        {/* ── AI node (center bottom) */}
        <g filter="url(#softShadow)">
            <rect x="178" y="222" width="104" height="64" rx="12" fill="url(#nodeBg)" stroke="#c7c9f7" strokeWidth="1.5" />
            <rect x="190" y="234" width="28" height="28" rx="7" fill="#eef0ff" stroke="#c7c9f7" strokeWidth="1" />
            {/* Brain-like icon */}
            <circle cx="204" cy="248" r="8" stroke="#4e54c8" strokeWidth="1.5" />
            <path d="M200 245 Q204 241 208 245 Q208 252 204 254 Q200 252 200 245Z" fill="#4e54c8" opacity="0.3" />
            <circle cx="201" cy="246" r="1.5" fill="#4e54c8" />
            <circle cx="207" cy="246" r="1.5" fill="#4e54c8" />
            <text x="225" y="246" fontSize="9" fontWeight="700" fill="#1e1b4b" fontFamily="Tomorrow, sans-serif">AI</text>
            <text x="225" y="258" fontSize="8" fill="#6b7280" fontFamily="Tomorrow, sans-serif">Inference</text>
            {/* Score bar */}
            <rect x="190" y="268" width="80" height="8" rx="4" fill="#e8eaff" />
            <rect x="190" y="268" width="56" height="8" rx="4" fill="url(#shieldGrad)" />
            <text x="274" y="275" fontSize="7" fill="#4e54c8" fontFamily="Tomorrow, sans-serif" fontWeight="700">70%</text>
        </g>

        {/* ── Block node (right) */}
        <g filter="url(#softShadow)">
            <rect x="308" y="208" width="104" height="64" rx="12" fill="url(#nodeBg)" stroke="#c7c9f7" strokeWidth="1.5" />
            <rect x="320" y="220" width="28" height="28" rx="7" fill="#fff0f0" stroke="#fecaca" strokeWidth="1" />
            {/* Shield-X icon */}
            <path d="M334 224 L325 227.5V233.5C325 238.5 328.8 243 334 244.2C339.2 243 343 238.5 343 233.5V227.5L334 224Z" fill="#fca5a5" />
            <path d="M330 230 L338 238M338 230 L330 238" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <text x="355" y="232" fontSize="9" fontWeight="700" fill="#1e1b4b" fontFamily="Tomorrow, sans-serif">Block</text>
            <text x="355" y="244" fontSize="8" fill="#6b7280" fontFamily="Tomorrow, sans-serif">Engine</text>
            {/* Status pill */}
            <rect x="320" y="254" width="60" height="12" rx="6" fill="#fee2e2" />
            <circle cx="328" cy="260" r="3" fill="#ef4444" />
            <text x="333" y="263" fontSize="7" fill="#991b1b" fontFamily="Tomorrow, sans-serif">2 blocked</text>
        </g>

        {/* ── Log node bottom-left */}
        <g opacity="0.75">
            <rect x="28" y="304" width="76" height="44" rx="10" fill="white" stroke="#e5e7f0" strokeWidth="1.5" />
            <text x="40" y="322" fontSize="8" fontWeight="700" fill="#1e1b4b" fontFamily="Tomorrow, sans-serif">Audit Log</text>
            <rect x="40" y="328" width="52" height="3" rx="1.5" fill="#e8eaff" />
            <rect x="40" y="334" width="38" height="3" rx="1.5" fill="#e8eaff" />
            <rect x="40" y="340" width="46" height="3" rx="1.5" fill="#e8eaff" />
        </g>

        {/* ── Alert node bottom-right */}
        <g opacity="0.75">
            <rect x="356" y="304" width="76" height="44" rx="10" fill="white" stroke="#e5e7f0" strokeWidth="1.5" />
            <text x="367" y="322" fontSize="8" fontWeight="700" fill="#1e1b4b" fontFamily="Tomorrow, sans-serif">SOC Alert</text>
            <rect x="367" y="328" width="52" height="3" rx="1.5" fill="#fee2e2" />
            <rect x="367" y="334" width="38" height="3" rx="1.5" fill="#fee2e2" />
            <rect x="367" y="340" width="46" height="3" rx="1.5" fill="#fca5a5" />
        </g>

        {/* Floating data packets moving along lines */}
        <circle r="4" fill="#8f94fb">
            <animateMotion dur="2.5s" repeatCount="indefinite">
                <mpath href="#path-left" />
            </animateMotion>
        </circle>
        <path id="path-left" d="M230 145 L100 240" stroke="none" />

        <circle r="4" fill="#10b981">
            <animateMotion dur="3s" repeatCount="indefinite" begin="1s">
                <mpath href="#path-center" />
            </animateMotion>
        </circle>
        <path id="path-center" d="M230 145 L230 255" stroke="none" />

        <circle r="4" fill="#ef4444">
            <animateMotion dur="2s" repeatCount="indefinite" begin="0.5s">
                <mpath href="#path-right" />
            </animateMotion>
        </circle>
        <path id="path-right" d="M230 145 L360 240" stroke="none" />

        {/* Version badge */}
        <g>
            <rect x="354" y="60" width="86" height="36" rx="10" fill="white" stroke="#c7c9f7" strokeWidth="1.5" filter="url(#softShadow)" />
            <text x="366" y="77" fontSize="11" fontWeight="800" fill="#1e1b4b" fontFamily="Tomorrow, sans-serif">v2.1.0</text>
            <text x="366" y="89" fontSize="8" fill="#6b7280" fontFamily="Tomorrow, sans-serif">Stable</text>
            <circle cx="360" cy="75" r="3" fill="#10b981" />
        </g>

        {/* Threat count badge */}
        <g>
            <rect x="20" y="150" width="94" height="36" rx="10" fill="white" stroke="#c7c9f7" strokeWidth="1.5" filter="url(#softShadow)" />
            <text x="32" y="166" fontSize="11" fontWeight="800" fill="#4e54c8" fontFamily="Tomorrow, sans-serif">10K+</text>
            <text x="32" y="178" fontSize="8" fill="#6b7280" fontFamily="Tomorrow, sans-serif">Threats Blocked</text>
        </g>
    </svg>
)

const SectionGallery = () => {
    return (
        <section id="about" className="px-4">
            <div className="max-w-7xl mx-auto py-14">

                <div className='grid gap-10 lg:grid-cols-2 items-center'>

                    {/* Illustration — replaces the Unsplash image */}
                    <div className='lg:order-2 relative flex items-center justify-center'>
                        <div className="w-full max-w-lg mx-auto rounded-2xl border-2 border-[#4e54c8]/30 bg-gradient-to-br from-white to-[#eef0ff] p-4 shadow-xl shadow-[#4e54c8]/10">
                            <SecurityIllustration />
                        </div>

                        {/* Floating stat badges */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            viewport={{ once: true }}
                            className="absolute -top-4 -right-4 border-2 border-[#4e54c8]/20 bg-white px-4 py-2.5 rounded-xl shadow-lg flex flex-col items-start gap-0.5"
                        >
                            <h3 className="text-base font-bold text-gradient bg-clip-text text-transparent">4+</h3>
                            <div className="text-xs text-zinc-500">Model Engines</div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.55 }}
                            viewport={{ once: true }}
                            className="absolute -bottom-4 -left-4 border-2 border-[#4e54c8]/20 bg-white px-4 py-2.5 rounded-xl shadow-lg flex flex-col items-start gap-0.5"
                        >
                            <h3 className="text-base font-bold text-gradient bg-clip-text text-transparent">&lt; 50ms</h3>
                            <div className="text-xs text-zinc-500">Verdict Latency</div>
                        </motion.div>
                    </div>

                    {/* Text content */}
                    <div className='lg:order-1'>
                        <h2>Core <span className='text-gradient bg-clip-text text-transparent'>Security Principles</span></h2>
                        <p className='text-base text-zinc-500 mt-3'>
                            AegisOne is designed to be the ultimate safety net for your workforce. It protects your company from sophisticated phishing, credential theft, and deceptive web content, stopping threats before they ever compromise your network.
                        </p>
                        <p className='mt-4 text-base text-zinc-500'>
                            We handle all the heavy lifting on our secure enterprise infrastructure. Your employees get instant, clear warnings directly at the point of risk — ensuring zero disruption to their daily productivity while maintaining total data sovereignty.
                        </p>
                        <div className='mt-6 grid gap-4 md:grid-cols-2'>
                            {values.map((value, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    viewport={{ once: true }}
                                    className="flex items-start gap-3 group"
                                >
                                    <div className='inline-block p-3 rounded-xl text-gradient text-white group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-300 shrink-0'>
                                        <value.icon size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">{value.title}</h3>
                                        <div className="text-xs text-zinc-500">{value.description}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>
        </section>
    )
}

export default SectionGallery
