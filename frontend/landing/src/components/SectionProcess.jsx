import { motion } from "motion/react"
import { Activity, Shield, Cpu, GitFork, Brain, Lock } from "lucide-react"
import SectionHeading from "../ui-elements/SectionHeading"

const steps = [
    {
        icon: Activity,
        title: "Event Interception",
        description: "AegisOne's extension monitors navigation events, form submissions, clipboard changes, and downlads.",
    },
    {
        icon: Shield,
        title: "Local Policy & Cache Check",
        description: "Instantly checks local database caches and custom organization-level whitelist/blacklist policies.",
    },
    {
        icon: Cpu,
        title: "Feature Extraction",
        description: "Extracts lightweight syntactic, visual, and behavioral characteristics without transmitting full history.",
    },
    {
        icon: GitFork,
        title: "Intelligent Routing",
        description: "FastAPI gateway routes inputs (URLs, emails, text, images, or documents) to the proper AI service.",
    },
    {
        icon: Brain,
        title: "Multi-Modal AI Inference",
        description: "Specialized neural network models analyze elements in parallel for reputation, visual similarity, and intent.",
    },
    {
        icon: Lock,
        title: "Enforcement & Alerting",
        description: "Aggregates predictions into a single score, enforcing allow/warn/block policies and syncing dashboard telemetry.",
    },
]

const SectionProcess = () => {

    return (
        <section id="process" className="px-4">
            <div className="max-w-7xl mx-auto py-20">
                <SectionHeading heading="How AegisOne Works" content="Real-time multi-modal routing from initial browser action to final AI evaluation" />

                <div className="relative flex flex-col gap-6">

                    <div className="absolute left-0 md:left-1/2 transform -translate-x-1/2 w-1 bg-zinc-200/50 dark:bg-zinc-800/50 h-full rounded-full" />

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
                                <div className="border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-200/20 dark:bg-zinc-800/30 p-4 rounded-lg flex flex-col items-start gap-4 hover:border-gradient-border group">
                                    <div className="flex items-center gap-2">
                                        <div className="border border-zinc-200 dark:border-zinc-800 p-2 rounded-full group-hover:text-gradient group-hover:text-white">
                                            <step.icon />
                                        </div>
                                        <h3>{step.title}</h3>
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-300">{step.description}</p>
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