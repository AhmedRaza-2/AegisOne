import React from 'react'
import Button from './Button'
import { motion } from 'motion/react'

const ContactForm = () => {
    return (

        <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="flex flex-col gap-4"
        >
            <input type="text" placeholder='Enter Name' />
            <input type="email" placeholder='Your Email' />
            <input type="text" placeholder='Your Location' />
            <textarea rows={3} placeholder='Tell us about your Project...'></textarea>
            <Button>
                Submit Form (Static)
            </Button>
        </motion.div>

    )
}

export default ContactForm
