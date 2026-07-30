import { motion } from "motion/react"
import { Link, FileText, Eye, FileDown, Brain, ShieldAlert } from "lucide-react";
import SectionHeading from "../ui-elements/SectionHeading";

const services = [
    {
        icon: Link,
        title: "Link Protection",
        description: "Automatically blocks fraudulent links, preventing your employees from accidentally handing over corporate credentials.",
    },
    {
        icon: FileText,
        title: "Social Engineering Defense",
        description: "Analyzes language and context to stop targeted executive spoofing and invoice fraud attempts in their tracks.",
    },
    {
        icon: Eye,
        title: "Brand Impersonation Shield",
        description: "Identifies fake login pages and QR code exploits disguised as the trusted enterprise tools your company uses daily.",
    },
    {
        icon: FileDown,
        title: "Safe File Gateway",
        description: "Stops weaponized documents and ransomware from ever touching your employees' hard drives or company network.",
    },
    {
        icon: Brain,
        title: "Instant Threat Visibility",
        description: "Gives your SOC team clear, actionable reports on why a threat was blocked, drastically reducing investigation time.",
    },
    {
        icon: ShieldAlert,
        title: "Zero Liability Tracking",
        description: "Protects your company from compliance risks. Security events are logged, but raw employee browsing history remains 100% private.",
    },
];

const SectionServices = () => {

    return (
        <section id="services" className="px-4">
            <div className="max-w-7xl m-auto py-14">
                <SectionHeading heading="Enterprise Risk Mitigation" content="A unified defense framework securing your organization across every vector of attack." />

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((service, index) => {
                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                                viewport={{ once: true }}
                                key={index} className="border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-200/20 dark:bg-zinc-800/30 p-4 rounded-lg flex flex-col items-start gap-4 hover:border-gradient-border group">
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