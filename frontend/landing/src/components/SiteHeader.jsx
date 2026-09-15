import { useState, useEffect } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
    { href: "#demo", label: "Live Demo" },
    { href: "#services", label: "Features" },
    { href: "#process", label: "How It Works" },
    { href: "#stack", label: "Technology" },
    { href: "#about", label: "Why Us" },
    { href: "#reviews", label: "Reviews" },
    { href: "#contact", label: "Contact" },
];

export default function SiteHeader() {
    const [isOpen, setIsOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className={`px-4 sm:px-6 py-3.5 fixed top-0 w-full left-0 right-0 z-50 transition-all duration-300 ${
                isScrolled
                    ? "bg-white/90 backdrop-blur-md shadow-xs border-b border-zinc-200/80"
                    : "bg-white/60 backdrop-blur-xs border-b border-zinc-100"
            }`}
        >
            <div className="relative max-w-7xl mx-auto">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <a
                        href="/"
                        className="flex items-center gap-2.5 group transition-transform duration-200"
                        id="brand-logo"
                    >
                        <img
                            src="/logo.png"
                            alt="AegisOne Logo"
                            className="h-8 sm:h-9 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform duration-200 drop-shadow-xs"
                        />
                        <div className="flex flex-col text-left">
                            <span className="text-lg font-bold tracking-tight text-zinc-900 leading-tight">
                                Aegis<span className="text-[#0A5ED6]">One</span>
                            </span>
                        </div>
                    </a>

                    {/* Desktop Navigation */}
                    <nav id="desktop-nav" className="hidden lg:flex items-center gap-1 xl:gap-2">
                        {navLinks.map((link, index) => (
                            <a
                                key={index}
                                href={link.href}
                                className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/70 rounded-lg transition-colors"
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>

                    {/* Desktop CTA actions */}
                    <div className="hidden lg:flex items-center gap-3">
                        <a
                            href="/login"
                            className="text-sm font-medium text-zinc-600 hover:text-zinc-950 px-3 py-2 rounded-lg transition-colors"
                        >
                            Sign In
                        </a>
                        <a
                            href="#contact"
                            className="text-sm font-semibold bg-[#0A5ED6] hover:bg-[#0952be] text-white px-4 py-2 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                        >
                            <span>Book Demo</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <a
                            href="/login"
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-800"
                        >
                            Sign In
                        </a>
                        <button
                            className="p-2 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors"
                            onClick={() => setIsOpen(!isOpen)}
                            aria-label="Toggle navigation menu"
                            id="mobile-nav-toggle"
                        >
                            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="lg:hidden mt-3 pt-3 border-t border-zinc-200 bg-white/95 backdrop-blur-xl rounded-2xl p-4 shadow-xl text-left"
                    >
                        <div className="flex flex-col gap-1">
                            {navLinks.map((link) => (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsOpen(false)}
                                    className="px-3 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 rounded-lg transition-colors"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </div>
                        <div className="h-px bg-zinc-100 my-3" />
                        <div className="flex flex-col gap-2">
                            <a
                                href="/register"
                                onClick={() => setIsOpen(false)}
                                className="w-full text-center text-sm font-semibold bg-[#0A5ED6] hover:bg-[#0952be] text-white py-2.5 rounded-lg shadow-xs transition-colors"
                            >
                                Get Started
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
}