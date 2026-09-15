import { motion } from "motion/react"
import { Link, FileText, Eye, FileDown, Brain, ShieldAlert } from "lucide-react";
import SectionHeading from "../ui-elements/SectionHeading";

const services = [
    {
        icon: Link,
        title: "Fake Link Protection",
        description: "Automatically spots and blocks deceptive links before employees can accidentally give away their passwords.",
    },
    {
        icon: FileText,
        title: "Scam & Spoof Defense",
        description: "Detects urgent email scams, fake executive messages, and invoice tricks before anyone sends sensitive info.",
    },
    {
        icon: Eye,
        title: "Brand & Login Shield",
        description: "Identifies lookalike login pages and sneaky QR codes disguised as Microsoft, Google, or daily workplace apps.",
    },
    {
        icon: FileDown,
        title: "Safe Downloads",
        description: "Catches malicious attachments and hidden files before they ever reach your computer or office network.",
    },
    {
        icon: Brain,
        title: "Clear, Friendly Warnings",
        description: "Explains exactly why a page was flagged in plain English so your team understands what happened without confusion.",
    },
    {
        icon: ShieldAlert,
        title: "100% Private Browsing",
        description: "Blocks threats reliably without ever tracking, recording, or snooping on employees' personal browsing habits.",
    },
];

const SectionServices = () => {

    return (
        <section id="services" className="px-4">
            <div className="max-w-7xl m-auto py-14">
                <SectionHeading heading="Simple, Complete Protection" content="Everything your team needs to browse safely without complicated setups or annoying interruptions." />

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((service, index) => {
                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                                viewport={{ once: true }}
                                key={index} className="border-2 border-zinc-200 bg-zinc-200/20 p-4 rounded-lg flex flex-col items-start gap-4 hover:border-gradient-border group">
                                <div className="inline-block p-4 rounded-xl text-gradient text-white group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-300">
                                    <service.icon />
                                </div>
                                <h3>{service.title}</h3>
                                <p>{service.description}</p>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

export default SectionServices