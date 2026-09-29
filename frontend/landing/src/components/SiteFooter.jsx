import { Github, Linkedin, Mail, ArrowUpRight } from "lucide-react";

const columns = [
    {
        heading: "Product",
        links: [
            { label: "Features",     href: "/#services" },
            { label: "Live demo",    href: "/#demo" },
            { label: "How it works", href: "/#process" },
            { label: "Technology",   href: "/#stack" },
        ],
    },
    {
        heading: "Resources",
        links: [
            { label: "Documentation", href: "/docs#overview" },
            { label: "Security",      href: "/docs#security" },
            { label: "API reference", href: "/docs#api" },
            { label: "Deployment",    href: "/docs#deploy" },
        ],
    },
    {
        heading: "Company",
        links: [
            { label: "Why AegisOne", href: "/#about" },
            { label: "Reviews",      href: "/#reviews" },
            { label: "Contact",      href: "/#contact" },
            { label: "GitHub",       href: "https://github.com/AhmedRaza-2/AegisOne", external: true },
        ],
    },
];

const socials = [
    { icon: Github,   href: "https://github.com/AhmedRaza-2/AegisOne",        label: "GitHub"   },
    { icon: Linkedin, href: "https://www.linkedin.com/in/ahmed-r-43b6a1266/", label: "LinkedIn" },
    { icon: Mail,     href: "mailto:araza2125012.pgc@gmail.com",              label: "Email"    },
];

export default function SiteFooter() {
    return (
        <footer className="relative overflow-hidden bg-[#0A1931]">
            {/* Brand gradient hairline, echoes the floating navbar accent */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#4A7FA7] to-transparent opacity-60" />

            {/* Dot mesh texture, same motif as the hero background */}
            <div
                className="absolute inset-0 opacity-[0.15] pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)",
                    backgroundSize: "28px 28px",
                    maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,0,0,1), transparent 75%)",
                    WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,0,0,1), transparent 75%)",
                }}
            />

            <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-x-8 gap-y-12">

                    {/* Brand column */}
                    <div className="col-span-2 sm:col-span-4 lg:col-span-5 flex flex-col gap-4">
                        <a href="/" className="flex items-center gap-2.5 group w-fit">
                            <img
                                src="/logo.png"
                                alt="AegisOne Logo"
                                className="h-8 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform"
                            />
                            <span className="text-lg font-bold tracking-tight text-white">
                                Aegis<span className="text-blue-200">One</span>
                            </span>
                        </a>
                        <p className="text-sm text-blue-100/60 leading-relaxed max-w-xs">
                            Every scan runs on your own server. Emails, links, and attachments
                            are inspected on-premise and never leave your network.
                        </p>
                        <div className="flex items-center gap-2 pt-2">
                            {socials.map((s) => (
                                <a
                                    key={s.label}
                                    href={s.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={s.label}
                                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-blue-100/70 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                    <s.icon size={16} />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Link columns */}
                    {columns.map((col) => (
                        <div key={col.heading} className="col-span-1 sm:col-span-1 lg:col-span-2 xl:col-span-2 flex flex-col gap-3">
                            <h3 className="text-sm font-semibold text-white">{col.heading}</h3>
                            <ul className="flex flex-col gap-2.5">
                                {col.links.map((l) => (
                                    <li key={l.label}>
                                        <a
                                            href={l.href}
                                            target={l.external ? "_blank" : undefined}
                                            rel={l.external ? "noopener noreferrer" : undefined}
                                            className="text-sm text-blue-100/60 hover:text-white transition-colors inline-flex items-center gap-1"
                                        >
                                            {l.label}
                                            {l.external && <ArrowUpRight size={12} className="opacity-50" />}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom strip */}
                <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-blue-100/40">
                        © {new Date().getFullYear()} AegisOne. All rights reserved.
                    </p>
                    <div className="flex items-center gap-5 text-xs text-blue-100/50">
                        <a href="/login" className="hover:text-white transition-colors">Sign in</a>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <a href="/register" className="hover:text-white transition-colors">Get started</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
