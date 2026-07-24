import { useState, useEffect } from "react";
import { Menu, X, Code2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SiteTheme from "./SiteTheme";

const navLinks = [
    { href: "#services", label: "Security Vectors" },
    { href: "#process", label: "Detection Flow" },
    { href: "#stack", label: "AI Stack" },
    { href: "#about", label: "Core Principles" },
    { href: "#trust", label: "Integrations" },
    { href: "#contact", label: "Request Demo" },
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
            className={`p-4 fixed border-b border-transparent top-0 w-full left-0 right-0 z-50 transition-all duration-300 ${isScrolled
                ? "bg-white/50 dark:bg-black/50 dark:border-zinc-800 backdrop-blur-xl shadow-md"
                : "bg-transparent"
                }`}>

            <div className="relative max-w-7xl m-auto">

                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <a href="/" className="flex items-center text-xl font-bold">
                        AegisOne
                    </a>

                    {/* Desktop Navigation */}
                    <div className="hidden lg:flex items-center gap-8">
                        {navLinks.map((link, index) => (
                            <a key={index} href={link.href}>{link.label}</a>
                        ))}
                    </div>

                    {/* Theme Toggle & Mobile Menu Button */}
                    <div className="flex items-center gap-4">
                        <SiteTheme />
                        <button className="block lg:hidden" onClick={() => setIsOpen(!isOpen)}>
                            {isOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>



            </div>

            {/* Mobile Navigation */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "100%" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="absolute right-0 mt-4 h-svh lg:hidden bg-zinc-200 dark:bg-zinc-800"
                    >
                        <div className="p-4 flex flex-col items-end gap-4 text-xl">
                            {navLinks.map((link) => (
                                <a key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
                                    {link.label}
                                </a>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </motion.header>
    );
}