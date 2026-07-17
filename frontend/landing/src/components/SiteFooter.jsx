import { Github, Linkedin, Twitter, Mail } from "lucide-react";

const footerLinks = {
    company: [
        { label: "About Us", href: "#about" },
        { label: "Our Core Principles", href: "#about" },
        { label: "Careers", href: "#" },
        { label: "Blog", href: "#" },
    ],
    security: [
        { label: "URL Scanner", href: "#services" },
        { label: "Content Scanner", href: "#services" },
        { label: "Attachment Scanner", href: "#services" },
        { label: "Live Telemetry", href: "#contact" },
    ],
    resources: [
        { label: "API Reference", href: "#" },
        { label: "Threat Intelligence", href: "#projects" },
        { label: "Status Page", href: "#" },
        { label: "SOC Contact", href: "#contact" },
    ],
};

const socialLinks = [
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Github, href: "https://github.com/AhmedRaza-2/AegisOne", label: "GitHub" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Mail, href: "mailto:support@aegisone.ai", label: "Email" },
];

export default function Footer() {
    return (
        <footer className="px-4 py-10 border-t border-zinc-200 dark:border-zinc-800">
            <div className="max-w-7xl m-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-12 mb-10">
                    
                    <div className="md:col-span-3 lg:col-span-2">
                        <a href="#home" className="flex items-center mb-4">
                            <span className="text-2xl font-bold">
                                AegisOne
                            </span>
                        </a>
                        <p className="text-muted-foreground mb-6 max-w-sm">
                            Enterprise browser security powered by multi-modal AI. Defending against phishing and credential theft in real-time.
                        </p>
                        <div className="flex gap-4">
                            {socialLinks.map((social, index) => (
                                <a
                                    key={index}
                                    href={social.href}
                                    aria-label={social.label}
                                    target="_blank"
                                    className="h-10 w-10 rounded-lg bg-card border-2 border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:border-gradient-border"
                                >
                                    <social.icon size={20} />
                                </a>
                            ))}
                        </div>
                    </div>

                    {Object.entries(footerLinks).map(([category, links]) => (
                        <div key={category}>
                            <h3 className="mb-4 capitalize">{category}</h3>
                            <ul className="space-y-3">
                                {links.map((link, index) => (
                                    <li key={index}>
                                        <a href={link.href} className="inline-block hover:underline underline-offset-4">
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="pt-10 border-t border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">

                    <p className="text-sm text-zinc-500 text-center md:text-left">
                        © {new Date().getFullYear()} AegisOne. All rights reserved.
                    </p>

                    <div className="text-sm text-zinc-500 flex gap-4">
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                        <a href="#">Cookie Policy</a>
                    </div>

                </div>
            </div>
        </footer >
    );
}