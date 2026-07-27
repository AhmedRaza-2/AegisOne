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