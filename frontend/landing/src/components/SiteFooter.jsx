import { Github, Linkedin, Twitter, Mail } from "lucide-react";

const links = [
    { label: "Overview",      href: "/docs#overview" },
    { label: "Security",      href: "/docs#security" },
    { label: "API Reference", href: "/docs#api" },
    { label: "Deployment",    href: "/docs#deploy" },
    { label: "GitHub",        href: "https://github.com/AhmedRaza-2/AegisOne" },
    { label: "Contact",       href: "mailto:araza2125012.pgc@gmail.com" },
];

const socials = [
    { icon: Twitter,  href: "#",                                                 label: "Twitter"  },
    { icon: Github,   href: "https://github.com/AhmedRaza-2/AegisOne",          label: "GitHub"   },
    { icon: Linkedin, href: "https://www.linkedin.com/in/ahmed-r-43b6a1266/",   label: "LinkedIn" },
    { icon: Mail,     href: "mailto:araza2125012.pgc@gmail.com",                label: "Email"    },
];

export default function Footer() {
    return (
        <footer className="border-t border-zinc-100 bg-white">
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

                    {/* Logo + tagline */}
                    <div className="flex flex-col gap-1">
                        <a href="/" className="text-base font-bold text-zinc-900 tracking-tight">
                            Aegis<span className="text-[#0A5ED6]">One</span>
                        </a>
                        <p className="text-xs text-zinc-400">Sovereign phishing protection for local offices.</p>
                    </div>

                    {/* Links */}
                    <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        {links.map(l => (
                            <a
                                key={l.label}
                                href={l.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
                            >
                                {l.label}
                            </a>
                        ))}
                    </nav>

                    {/* Socials */}
                    <div className="flex items-center gap-3">
                        {socials.map(s => (
                            <a
                                key={s.label}
                                href={s.href}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={s.label}
                                className="text-zinc-400 hover:text-zinc-700 transition-colors"
                            >
                                <s.icon size={16} />
                            </a>
                        ))}
                    </div>
                </div>

                {/* Bottom strip */}
                <p className="mt-6 pt-6 border-t border-zinc-100 text-[11px] text-zinc-400 text-center">
                    © {new Date().getFullYear()} AegisOne. All rights reserved.
                </p>
            </div>
        </footer>
    );
}