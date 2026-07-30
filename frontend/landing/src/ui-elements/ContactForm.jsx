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
            const res = await fetch('http://100.104.105.20:8000/public/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                setSuccess(true)
                setFormData({ name: '', email: '', location: '', message: '' })
            } else {
                const data = await res.json()
                setError(data.detail || 'Failed to send message.')
            }
        } catch (err) {
            setError('Could not connect to the server. Please try again.')
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
                    {error && <div className="text-sm text-red-500">{error}</div>}
                    <input required type="text" placeholder='Enter Name' value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    <input required type="email" placeholder='Your Email' value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    <input required type="text" placeholder='Your Location' value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                    <textarea required rows={3} placeholder='Tell us about your Project...' value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })}></textarea>

                    <div onClick={handleSubmit}>
                        <Button disabled={loading}>
                            {loading ? 'Sending...' : 'Submit Form'}
                        </Button>
                    </div>
                </form>
            )}
        </motion.div>
    )
}

export default ContactForm
