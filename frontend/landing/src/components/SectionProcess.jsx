import { motion } from "motion/react"
import { Activity, Shield, Cpu, GitFork, Brain, Lock } from "lucide-react"
import SectionHeading from "../ui-elements/SectionHeading"

const steps = [
    {
        icon: Activity,
        title: "Quiet Background Protection",
        description: "AegisOne runs seamlessly inside employee browsers, protecting every click without slowing down web pages or interrupting tasks.",
    },
    {
        icon: Shield,
        title: "Instant Safety Check",
        description: "Every link and page is checked against your safety rules in a fraction of a second, with zero data ever leaving your trusted office.",
    },
    {
        icon: Cpu,
        title: "Private On-Device Review",
        description: "Scans run locally on your own equipment, ensuring your company documents and sensitive info stay 100% confidential.",
    },
    {
        icon: GitFork,
        title: "Smart Threat Blocking",
        description: "Intelligent AI filters quickly flag and block deceptive websites, fake forms, and malicious downloads before harm can occur.",
    },
    {
        icon: Brain,
        title: "Always Learning & Adapting",
        description: "Our system automatically stays up to date against brand new scams, phishing patterns, and tricky lookalike domains in real time.",
    },
    {
        icon: Lock,
        title: "Clear Alerts & Fast Reports",
        description: "Suspicious pages are stopped on the spot, and your IT dashboard gets clear, simple summaries to keep everyone protected.",
    },
]

const SectionProcess = () => {

    return (
        <section id="process" className="px-4">
            <div className="max-w-7xl mx-auto py-14">
                <SectionHeading heading="How AegisOne Works" content="Effortless protection from the first click to the final warning, running quietly in the background." />

                <div className="relative flex flex-col gap-2">

                    <div className="absolute left-0 md:left-1/2 transform -translate-x-1/2 w-1 bg-zinc-200/50 h-full rounded-full" />

                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", duration: 0.8, delay: index * 0.2, ease: "easeOut" }}
                            viewport={{ once: true }}
                            className={`relative flex items-center ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                        >
                            <div className={`w-full pl-6 md:w-1/2 ${index % 2 === 0 ? 'md:pr-6' : 'md:pl-6'}`}>
                                <div className="border-2 border-zinc-200 bg-zinc-200/20 p-4 rounded-lg flex flex-col items-start gap-4 hover:border-gradient-border group">
                                    <div className="flex items-center gap-2">
                                        <div className="border border-zinc-200 p-2 rounded-full group-hover:text-gradient group-hover:text-white">
                                            <step.icon />
                                        </div>
                                        <h3>{step.title}</h3>
                                    </div>
                                    <p className="text-gray-600">{step.description}</p>
                                </div>
                            </div>

                            {/* Step number */}
                            <div className="absolute left-0 md:left-1/2 z-10 transform -translate-x-1/2 -translate-y-1/2 top-1/2 w-6 h-6 rounded-full flex items-center justify-center bg-gradient border-2 border-gradient-border">
                                {index + 1}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default SectionProcess