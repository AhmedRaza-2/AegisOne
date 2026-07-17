import { motion } from 'motion/react'

const SectionHeading = ({ heading, content }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
        >
            <h2 className="text-center">{heading}</h2>
            <p className="text-lg text-center">{content}</p>
        </motion.div>
    )
}

export default SectionHeading