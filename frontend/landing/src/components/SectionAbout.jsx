import { motion } from 'motion/react'
import { Cpu, Eye, Target, Shield } from "lucide-react";

const values = [
    {
        icon: Cpu,
        title: "Lightweight Client",
        description: "Performs only fast local checks and feature extraction to minimize browser performance overhead.",
    },
    {
        icon: Eye,
        title: "Explainable Detections",
        description: "Decisions are not black boxes. Users get clear, natural-language reasons for every warning.",
    },
    {
        icon: Target,
        title: "Multi-Modal Scoring",
        description: "Analyzes URLs, text, images, and document attachments under a single unified risk score.",
    },
    {
        icon: Shield,
        title: "Zero History Tracking",
        description: "Aggregates security alerts without tracking or storing users' raw browsing history.",
    },
];

const SectionGallery = () => {
    return (
        <section id="about" className="px-4">
            <div className="max-w-7xl mx-auto py-20">

                <div className='grid gap-10 lg:grid-cols-2'>

                    <div className='lg:order-2 min-h-96 relative mx-6 border-2 border-gradient-border bg-fixed bg-no-repeat bg-cover bg-center rounded-lg' style={{ backgroundImage: "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80')" }}>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            viewport={{ once: true }}
                            className="absolute -top-6 -right-6 border-2 border-zinc-200 bg-zinc-100 p-4 rounded-lg flex flex-col items-start gap-2 group"
                        >
                            <h3 className="text-lg font-semibold group-hover:text-gradient group-hover:bg-clip-text group-hover:text-transparent">4+</h3>
                            <div>Model Engines</div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            viewport={{ once: true }}
                            className="absolute -bottom-6 -left-6 border-2 border-zinc-200 bg-zinc-100 p-4 rounded-lg flex flex-col items-start gap-2 group"
                        >
                            <h3 className="text-lg font-semibold group-hover:text-gradient group-hover:bg-clip-text group-hover:text-transparent">&lt; 50ms</h3>
                            <div>Verdict Latency</div>
                        </motion.div>

                    </div>

                    <div className='lg:order-1'>
                        <h2>Core <span className='text-gradient bg-clip-text text-transparent'>Security Principles</span></h2>
                        <p className='text-lg text-zinc-500'>
                            AegisOne is designed as an enterprise browser security agent. It protects users from sophisticated phishing, credential theft, malicious downloads, and deceptive web content while keeping the client lightweight and zero-footprint.
                        </p>
                        <p className='mt-6 text-lg text-zinc-500'>
                            We run all AI inference server-side, avoiding heavy model weights in the browser. Users receive instant, explainable decisions directly at the point of risk, allowing secure navigation without compromising device performance.
                        </p>
                        <div className='mt-6 grid gap-6 md:grid-cols-2 md:gap-4'>
                            {values.map((value, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    viewport={{ once: true }}
                                    className="flex items-center gap-4 group"
                                >
                                    <div className='inline-block p-4 rounded-xl text-gradient text-white group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-300'>
                                        <value.icon />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                                        <div className="text-sm text-zinc-500">
                                            {value.description}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>
        </section>
    )
}

export default SectionGallery
