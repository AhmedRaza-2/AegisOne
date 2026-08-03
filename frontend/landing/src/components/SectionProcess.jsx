import { motion } from "motion/react"
import { Activity, Shield, Cpu, GitFork, Brain, Lock } from "lucide-react"
import SectionHeading from "../ui-elements/SectionHeading"

const steps = [
    {
        icon: Activity,
        title: "Invisible Protection Layer",
        description: "The AegisOne agent runs silently in the background of your employees' browsers, protecting them without disrupting their workflow.",
    },
    {
        icon: Shield,
        title: "Instant Policy Enforcement",
        description: "Every action is instantly verified against your custom organizational security policies—without data ever leaving your network.",
    },
    {
        icon: Cpu,
        title: "Zero-Trust Analysis",
        description: "Key threat indicators are extracted and analyzed locally, ensuring your company's proprietary data remains completely confidential.",
    },
    {
        icon: GitFork,
        title: "Smart Threat Detection",
        description: "Sophisticated AI models automatically categorize and neutralize incoming threats, phishing links, and malicious downloads before they reach the user.",
    },
    {
        icon: Brain,
        title: "Continuous Learning Engine",
        description: "Our system constantly adapts to new, unseen phishing attacks and sophisticated social engineering techniques in real-time.",
    },
    {
        icon: Lock,
        title: "Automated Incident Response",
        description: "Threats are blocked immediately, and your security team receives instant alerts and actionable data to proactively manage organizational risk.",
    },
]

const SectionProcess = () => {

    return (
        <section id="process" className="px-4">
            <div className="max-w-7xl mx-auto py-14">
                <SectionHeading heading="Frictionless Security Lifecycle" content="Protecting your organization from the first click to the final block, entirely in the background." />

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