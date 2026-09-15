import { motion } from 'framer-motion'
import SectionHeading from '../ui-elements/SectionHeading'

const SectionTechStack = () => {
    const technologies = [
        { name: "FastAPI", category: "Fast API Engine" },
        { name: "PyTorch", category: "AI Detection Models" },
        { name: "Transformers", category: "Smart Text & URL Analysis" },
        { name: "EfficientNet-B3", category: "Logo & Brand Vision" },
        { name: "Tesseract OCR", category: "Visual Text Reader" },
        { name: "PostgreSQL", category: "Secure Database" },
        { name: "Redis", category: "Instant Memory Cache" },
        { name: "SQLAlchemy", category: "Data Layer" },
        { name: "Manifest V3", category: "Chrome & Edge Extension" },
        { name: "Docker", category: "One-Command Setup" },
        { name: "React & Vite", category: "Clean Web Dashboard" },
        { name: "Framer Motion", category: "Smooth Interfaces" },
    ];

    return (
        <section id="stack" className="py-14 px-4">
            <div className='max-w-7xl m-auto'>
                <SectionHeading heading="Fast, Modern Technology" content="Built with lightweight, privacy-first tools engineered to protect your team in milliseconds" />

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {technologies.map((tech, index) => (
                        <motion.div
                            key={tech.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="border-2 border-zinc-200 bg-zinc-200/20 p-4 rounded-lg flex flex-col items-start gap-4 hover:border-gradient-border group"
                        >
                            <h3 className="text-lg font-semibold group-hover:text-gradient group-hover:bg-clip-text group-hover:text-transparent">
                                {tech.name}
                            </h3>
                            <div className="text-sm text-zinc-500">
                                {tech.category}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default SectionTechStack