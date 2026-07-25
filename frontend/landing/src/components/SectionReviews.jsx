import React from 'react'
import { Star, Quote } from 'lucide-react'
import SectionHeading from '../ui-elements/SectionHeading'

const reviews = [
    {
        name: "Sarah Jenkins",
        role: "CISO, FinSafe Technologies",
        initials: "SJ",
        gradient: "from-purple-500 to-indigo-500",
        rating: 5,
        comment: "AegisOne's real-time Page Content AI and OCR scanner blocked three sophisticated brand impersonation attacks on our team within the first week. A game-changer for enterprise security."
    },
    {
        name: "David Chen",
        role: "Lead Security Engineer, CloudFlow",
        initials: "DC",
        gradient: "from-blue-500 to-cyan-500",
        rating: 5,
        comment: "The Explainable AI feature is brilliant. Instead of a generic 'BLOCKED' screen, users get a clear natural-language explanation of why a URL was flagged. Support tickets dropped 45%."
    },
    {
        name: "Elena Rostova",
        role: "Director of IT Security, HealthGate",
        initials: "ER",
        gradient: "from-teal-500 to-emerald-500",
        rating: 5,
        comment: "Unlike other tools that compromise privacy, AegisOne's Privacy-First Sync keeps employees' raw web history secure while still providing robust threat telemetry on the dashboard."
    },
    {
        name: "Marcus Vance",
        role: "Principal DevOps Architect, Securify",
        initials: "MV",
        gradient: "from-violet-500 to-fuchsia-500",
        rating: 5,
        comment: "Integrating AegisOne with our existing RBAC setup was seamless. The isolated admin and supervisor dashboards made policy orchestration effortless from day one."
    },
    {
        name: "Aiko Tanaka",
        role: "Cyber Threat Intelligence Lead, Vertex Labs",
        initials: "AT",
        gradient: "from-rose-500 to-pink-500",
        rating: 5,
        comment: "The Attachment Orchestrator scanner is incredibly fast. Inspecting ZIPs and PDFs before they hit local storage has stopped multiple payload executions at the boundary."
    },
    {
        name: "Oliver Bennett",
        role: "Security Compliance Auditor, Apex Retail",
        initials: "OB",
        gradient: "from-amber-500 to-orange-500",
        rating: 5,
        comment: "AegisOne eliminated the blind spot in our remote team's browsing. Typosquatting checks and redirect-chain parsing work flawlessly without any noticeable performance degradation."
    }
]

// Duplicate the array once — marquee scrolls one full set then loops seamlessly
const track = [...reviews, ...reviews]

const SectionReviews = () => {
    return (
        <section id="reviews" className="py-14 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 mb-10">
                <SectionHeading
                    heading="Trusted by Security Experts"
                    content="Hear from CISOs, IT security directors, and DevOps teams protecting their workforces with AegisOne"
                />
            </div>

            {/* Marquee wrapper — overflow hidden, no user scroll needed */}
            <div className="relative w-full overflow-hidden">
                {/* Fade edges */}
                <div className="pointer-events-none absolute left-0 top-0 h-full w-24 z-10"
                    style={{ background: 'linear-gradient(to right, #fff 0%, transparent 100%)' }} />
                <div className="pointer-events-none absolute right-0 top-0 h-full w-24 z-10"
                    style={{ background: 'linear-gradient(to left, #fff 0%, transparent 100%)' }} />

                {/* Auto-scrolling track */}
                <div className="marquee-track flex gap-5 py-4" style={{ width: 'max-content' }}>
                    {track.map((reviewer, index) => (
                        <div
                            key={index}
                            className="w-72 shrink-0 relative bg-zinc-50 border border-zinc-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                        >
                            {/* Decorative quote */}
                            <Quote className="absolute top-3 right-3 text-zinc-100 w-8 h-8 pointer-events-none group-hover:scale-110 transition-transform duration-300" />

                            <div>
                                {/* Stars */}
                                <div className="flex gap-0.5 text-amber-400 mb-3">
                                    {[...Array(reviewer.rating)].map((_, i) => (
                                        <Star key={i} size={13} fill="currentColor" />
                                    ))}
                                </div>
                                {/* Comment */}
                                <p className="text-zinc-600 text-xs leading-relaxed italic z-10 relative">
                                    "{reviewer.comment}"
                                </p>
                            </div>

                            {/* Author */}
                            <div className="flex items-center gap-2.5 mt-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold bg-gradient-to-br ${reviewer.gradient} shrink-0`}>
                                    {reviewer.initials}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-semibold text-xs text-zinc-800 truncate">{reviewer.name}</p>
                                    <p className="text-[10px] text-zinc-500 truncate">{reviewer.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default SectionReviews
