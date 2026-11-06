import React, { useState } from 'react'
import Button from './Button'
import { motion } from 'motion/react'

const ContactForm = () => {
    const [formData, setFormData] = useState({ name: '', email: '', location: '', message: '' })
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const res = await fetch('https://formsubmit.co/ajax/araza2125012.pgc@gmail.com', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    _subject: `New AegisOne Contact Form Message from ${formData.name}`,
                    name: formData.name,
                    email: formData.email,
                    location: formData.location,
                    message: formData.message
                })
            })

            if (res.ok) {
                setSuccess(true)
                setFormData({ name: '', email: '', location: '', message: '' })
            } else {
                const data = await res.json()
                setError(data.message || 'Failed to send message.')
            }
        } catch (err) {
            setError('Failed to send message. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="flex flex-col gap-4"
        >
            {success ? (
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-center">
                    <h4 className="font-semibold mb-2">Message Sent Successfully!</h4>
                    <p className="text-sm">We will get back to you shortly at {formData.email || 'your email'}.</p>
                    <button onClick={() => setSuccess(false)} className="mt-4 text-xs underline">Send another message</button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
                    <input required type="text" name="name" autoComplete="name" aria-label="Your name" placeholder='Your name…' value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    <input required type="email" name="email" autoComplete="email" spellCheck={false} aria-label="Work email" placeholder='name@company.com' value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    <input required type="text" name="location" autoComplete="address-level2" aria-label="City and country" placeholder='City, country…' value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                    <textarea required rows={3} name="message" aria-label="Your message" placeholder='Tell us about your team and what you want to protect…' value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })}></textarea>

                    <div>
                        <Button disabled={loading}>
                            {loading ? 'Sending…' : 'Send Message'}
                        </Button>
                    </div>
                </form>
            )}
        </motion.div>
    )
}

export default ContactForm

