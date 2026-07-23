import { motion } from "motion/react"
import { Link, FileText, Eye, FileDown, Brain, ShieldAlert } from "lucide-react";
import SectionHeading from "../ui-elements/SectionHeading";

const services = [
    {
        icon: Link,
        title: "URL Intelligence",
        description: "Evaluates typosquatting, redirect chains, domain age, and blacklist state in real-time.",
    },
    {
        icon: FileText,
        title: "Page Content AI",
        description: "Fast NLP models scan page body text, headers, and form inputs to prevent credential theft.",
    },
    {
        icon: Eye,
        title: "Image & OCR Scanner",
        description: "EfficientNet-B3 models combined with Tesseract OCR identify brand impersonation and QR exploits.",
    },
    {
        icon: FileDown,
        title: "Attachment Orchestrator",
        description: "Inspects inside ZIP, PDF, and DOCX archives, detecting payloads before they hit local storage.",
    },
    {
        icon: Brain,
        title: "Explainable AI (XAI)",
        description: "Provides descriptive, natural-language explanation of scan verdicts and key risk factors.",
    },
    {
        icon: ShieldAlert,
        title: "Privacy-First Sync",
        description: "Synchronizes security events and metadata to dashboards. Raw user browsing history is never tracked.",
    },
];

const SectionServices = () => {

    return (
        <section id="services" className="px-4">
            <div className="max-w-7xl m-auto py-20">
                <SectionHeading heading="Security Scanners & Modules" content="A cohesive multi-modal defense framework analyzing every browsing vector" />

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