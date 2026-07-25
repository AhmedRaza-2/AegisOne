import { motion } from 'framer-motion'
import SectionHeading from '../ui-elements/SectionHeading'

const SectionTechStack = () => {
    const technologies = [
        { name: "FastAPI", category: "Backend Gateway" },
        { name: "PyTorch", category: "Deep Learning Core" },
        { name: "Transformers", category: "DistilBERT NLP" },
        { name: "EfficientNet-B3", category: "Computer Vision" },
        { name: "Tesseract OCR", category: "Text Extraction" },
        { name: "PostgreSQL", category: "Relational DB" },
        { name: "Redis", category: "Aggressive Cache" },
        { name: "SQLAlchemy", category: "Python ORM" },
        { name: "Manifest V3", category: "Browser Extension" },
        { name: "Docker", category: "Containerization" },
        { name: "React & Vite", category: "Frontend Dashboard" },
        { name: "Framer Motion", category: "Animations" },
    ];

    return (
        <section id="stack" className="py-14 px-4">
            <div className='max-w-7xl m-auto'>
                <SectionHeading heading="Enterprise-Grade Architecture" content="Built on secure, robust, and scalable technologies trusted by global enterprises" />

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