import React, { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { Star, Quote } from 'lucide-react'
import SectionHeading from '../ui-elements/SectionHeading'

const reviews = [
    {
        name: "Sarah Jenkins",
        role: "CISO, FinSafe Technologies",
        initials: "SJ",
        gradient: "from-purple-500 to-indigo-500",
        rating: 5,
        comment: "AegisOne's real-time Page Content AI and OCR scanner blocked three sophisticated brand impersonation attacks on our team within the first week of deployment. It's a game-changer for enterprise browser security."
    },
    {
        name: "David Chen",
        role: "Lead Security Engineer, CloudFlow",
        initials: "DC",
        gradient: "from-blue-500 to-cyan-500",
        rating: 5,
        comment: "The Explainable AI (XAI) feature is brilliant. Instead of just getting a generic 'BLOCKED' screen, our security team and end-users get a clear, natural-language explanation of why a URL was flagged. It reduced support tickets by 45%."
    },
    {
        name: "Elena Rostova",
        role: "Director of IT Security, HealthGate",
        initials: "ER",
        gradient: "from-teal-500 to-emerald-500",
        rating: 5,
        comment: "Unlike other tools that compromise privacy to analyze browsing data, AegisOne's Privacy-First Sync keeps our employees' raw web history secure while still providing robust threat telemetry on the dashboard."
    },
    {
        name: "Marcus Vance",
        role: "Principal DevOps Architect, Securify",
        initials: "MV",
        gradient: "from-violet-500 to-fuchsia-500",
        rating: 5,
        comment: "Integrating AegisOne with our existing RBAC setup was seamless. The first-user auto-promotion logic and isolated admin/supervisor dashboards made policy orchestration a breeze."
    },
    {
        name: "Aiko Tanaka",
        role: "Cyber Threat Intelligence Lead, Vertex Labs",
        initials: "AT",
        gradient: "from-rose-500 to-pink-500",
        rating: 5,
        comment: "The Attachment Orchestrator scanner is incredibly fast. Inspecting archive files (ZIPs, PDFs) in the browser before they hit the local drive has stopped multiple payload executions at the boundary."
    },
    {
        name: "Oliver Bennett",
        role: "Security Compliance Auditor, Apex Retail",
        initials: "OB",
        gradient: "from-amber-500 to-orange-500",
        rating: 5,
        comment: "AegisOne has completely eliminated the blind spot in our remote team's browsing activity. Typosquatting checks and redirect-chain parsing work flawlessly without degrading performance."
    }
]

const SectionReviews = () => {
    const containerRef = useRef(null)
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    })

    // Moves the marquee from left to right as the user scrolls down
    const x = useTransform(scrollYProgress, [0, 1], ["-50%", "5%"])

    // Duplicate reviews to create a continuous row
    const repeatedReviews = [...reviews, ...reviews, ...reviews]

    return (
        <section id="reviews" ref={containerRef} className="px-4 py-20 overflow-hidden">
            <div className='max-w-7xl m-auto mb-12'>
                <SectionHeading 
                    heading="Trusted by Security Experts" 
                    content="Hear from CISOs, IT security directors, and DevOps teams protecting their workforces with AegisOne" 
                />
            </div>

            <div className="relative w-full overflow-hidden py-4">
                <motion.div
                    style={{ x }}
                    className="flex gap-6 whitespace-nowrap"
                >
                    {repeatedReviews.map((reviewer, index) => (
                        <div
                            key={index}
                            className="w-[350px] md:w-[450px] shrink-0 whitespace-normal relative bg-zinc-50/50 border border-zinc-200/60 backdrop-blur-md rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between overflow-hidden group"
                        >
                            {/* Decorative Quote Icon */}
                            <Quote className="absolute top-4 right-4 text-zinc-200/50 w-12 h-12 pointer-events-none group-hover:scale-110 transition-transform duration-300" />

                            <div>
                                {/* Rating Stars */}
                                <div className="flex gap-1 text-amber-500 mb-4">
                                    {[...Array(reviewer.rating)].map((_, i) => (
                                        <Star key={i} size={16} fill="currentColor" />
                                    ))}
                                </div>

                                {/* Review Content */}
                                <p className="text-zinc-600 text-sm leading-relaxed mb-6 italic z-10 relative">
                                    "{reviewer.comment}"
                                </p>
                            </div>

                            {/* Reviewer Details */}
                            <div className="flex items-center gap-3 mt-auto">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold bg-gradient-to-br ${reviewer.gradient} shadow-sm shrink-0`}>
                                    {reviewer.initials}
                                </div>
                                <div className="overflow-hidden">
                                    <h4 className="font-semibold text-sm text-zinc-800 truncate">{reviewer.name}</h4>
                                    <p className="text-xs text-zinc-500 truncate">{reviewer.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}

export default SectionReviews
