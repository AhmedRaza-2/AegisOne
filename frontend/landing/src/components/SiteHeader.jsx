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
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className={`fixed top-0 w-full left-0 right-0 z-50 border-b transition-all duration-700 ease-in-out ${
                isScrolled
                    ? "px-4 sm:px-6 pt-3 pb-0 bg-transparent border-transparent"
                    : "px-4 sm:px-6 py-3.5 bg-white/80 border-zinc-100"
            }`}
        >
            <div
                className={`relative mx-auto border transition-all duration-700 ease-in-out ${
                    isScrolled
                        ? "max-w-6xl rounded-full bg-gradient-to-r from-[#4A7FA7]/80 to-[#1A3D63]/80 backdrop-blur-xl shadow-xl shadow-[#1A3D63]/20 border-white/10 px-6 py-2.5"
                        : "max-w-7xl rounded-none bg-transparent shadow-none border-transparent px-0 py-0"
                }`}
            >
                <div className="flex items-center justify-between gap-2">
                    {/* Logo */}
                    <a
                        href="/"
                        className="flex items-center gap-2.5 group transition-transform duration-200 shrink-0"
                        id="brand-logo"
                    >
                        <img
                            src="/logo.png"
                            alt="AegisOne Logo"
                            className="h-8 sm:h-9 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform duration-200 drop-shadow-xs"
                        />
                        <div className="flex flex-col text-left">
                            <span
                                className={`text-lg font-bold tracking-tight leading-tight whitespace-nowrap transition-colors duration-500 ${
                                    isScrolled ? "text-white" : "text-[#4A7FA7]"
                                }`}
                            >
                                Aegis
                                <span
                                    className={`transition-colors duration-500 ${
                                        isScrolled ? "text-blue-200" : "text-[#1A3D63]"
                                    }`}
                                >
                                    One
                                </span>
                            </span>
                        </div>
                    </a>

                    {/* Desktop Navigation */}
                    <nav id="desktop-nav" className="hidden lg:flex items-center gap-0.5 xl:gap-1">
                        {navLinks.map((link, index) => (
                            <a
                                key={index}
                                href={link.href}
                                className={`px-2.5 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors duration-500 ${
                                    isScrolled
                                        ? "text-blue-100/80 hover:text-white hover:bg-white/10"
                                        : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/70"
                                }`}
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>

                    {/* Desktop CTA actions */}
                    <div className="hidden lg:flex items-center gap-3 shrink-0">
                        <a
                            href="/login"
                            className={`text-sm font-medium px-3 py-2 rounded-lg whitespace-nowrap transition-colors duration-500 ${
                                isScrolled
                                    ? "text-blue-100/80 hover:text-white"
                                    : "text-zinc-600 hover:text-zinc-950"
                            }`}
                        >
                            Sign In
                        </a>
                        <a
                            href="#contact"
                            className={`text-sm font-semibold px-4 py-2 rounded-full shadow-xs whitespace-nowrap shrink-0 transition-colors duration-500 flex items-center gap-1.5 ${
                                isScrolled
                                    ? "bg-white text-[#1A3D63] hover:bg-blue-50"
                                    : "bg-[#0A5ED6] hover:bg-[#0952be] text-white rounded-lg"
                            }`}
                        >
                            <span>Book Demo</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <a
                            href="/login"
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors duration-500 ${
                                isScrolled
                                    ? "bg-white/10 text-white"
                                    : "bg-zinc-100 text-zinc-800"
                            }`}
                        >
                            Sign In
                        </a>
                        <button
                            className={`p-2 rounded-lg transition-colors duration-500 ${
                                isScrolled
                                    ? "text-white hover:bg-white/10"
                                    : "text-zinc-700 hover:bg-zinc-100"
                            }`}
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
