import { motion } from 'motion/react'
import SectionHeading from '../ui-elements/SectionHeading'
import { Mail, Phone, MapPin } from "lucide-react";
import ContactForm from '../ui-elements/ContactForm';

const contact = [
    {
        icon: Mail,
        title: "Email",
        content: "araza2125012.pgc@gmail.com",
        link: "mailto:araza2125012.pgc@gmail.com",
    },
    {
        icon: Phone,
        title: "Phone",
        content: "+92 334 5216102",
        link: "tel:+923345216102",
    },
];

const SectionContact = () => {
    return (
        <section id="contact" className="px-4">
            <div className="max-w-7xl mx-auto py-20">

                <SectionHeading heading="Request Enterprise Demo" content="Ready to secure your organization? Get in touch with our security team to schedule a demo or trial." />

                <div className='grid gap-10 md:grid-cols-2'>
                    <div>
                        <h3>Let's secure your organization</h3>
                        <p className='mt-4'>
                            Have questions about onboarding, custom policies, or model integration?
                            Our security response team is here to assist.
                        </p>
                        <div className='mt-6 flex flex-col gap-6'>
                            {
                                contact.map((item, index) => (
                                    <motion.a
                                        key={index}
                                        href={item.link}
                                        initial={{ opacity: 0, x: -16 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: index * 0.1 }}
                                        className="flex items-center gap-4 group"
                                    >
                                        <div className='inline-block p-4 rounded-xl text-gradient text-white group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-300'>
                                            <item.icon />
                                        </div>
                                        <div>
                                            <div className="font-semibold mb-1">{item.title}</div>
                                            <div className="text-muted-foreground">{item.content}</div>
                                        </div>
                                    </motion.a>
                                ))
                            }
                        </div>
                    </div>
                    <div>
                        <ContactForm />
                    </div>
                </div>

            </div>
        </section>
    )
}

export default SectionContact