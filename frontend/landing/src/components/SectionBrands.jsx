import React, { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import SectionHeading from '../ui-elements/SectionHeading'

const SectionBrands = () => {
    const containerRef = useRef(null)
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    })

    // Top row: moves from left to right
    const x1 = useTransform(scrollYProgress, [0, 0.5, 1], ["-70%", "-50%", "0%"])

    // Bottom row: moves from right to left (opposite direction)
    const x2 = useTransform(scrollYProgress, [0, 0.5, 1], ["0%", "-50%", "-70%"])

    const topRowPartners = [
        { name: "Google", logo: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png" },
        { name: "Microsoft", logo: "https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RE1Mu3b?ver=5c31" },
        { name: "Amazon", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" },
        { name: "Meta", logo: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg" },
        { name: "Apple", logo: "https://www.apple.com/ac/structured-data/images/knowledge_graph_logo.png" },
        { name: "Netflix", logo: "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg" },
    ];

    const bottomRowPartners = [
        { name: "Spotify", logo: "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" },
        { name: "Adobe", logo: "https://upload.wikimedia.org/wikipedia/commons/6/6e/Adobe_Corporate_logo.svg" },
        { name: "Slack", logo: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg" },
        { name: "Figma", logo: "https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg" },
        { name: "Notion", logo: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg" },
        { name: "Zoom", logo: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Zoom_Communications_Logo.svg" },
    ];

    // Reusable Marquee Row Component
    const MarqueeRow = ({ x, partners }) => (
        <motion.div
            style={{ x }}
            className="flex whitespace-nowrap"
        >
            {partners.map((partner, index) => (
                <div
                    key={`${partner.name}-${index}`}
                    className="inline-flex items-center justify-center mx-4 md:mx-8 shrink-0"
                >
                    <img
                        src={partner.logo}
                        alt={partner.name}
                        className="h-8 opacity-60 hover:opacity-100 transition-opacity duration-300 grayscale hover:grayscale-0"
                    />
                </div>
            ))}
        </motion.div>
    )

    return (
        <section id="trust" ref={containerRef} className="px-4 py-20">
            <div className='max-w-7xl m-auto'>
                <SectionHeading heading="Enterprise Integration Capabilities" content="AegisOne integrates seamlessly with industry-standard platforms and security providers" />

                <div className="overflow-hidden">
                    <MarqueeRow 
                        x={x1} 
                        partners={[...topRowPartners, ...topRowPartners]} 
                    />
                </div>

                <div className="mt-10 overflow-hidden">
                    <MarqueeRow 
                        x={x2} 
                        partners={[...bottomRowPartners, ...bottomRowPartners, ...bottomRowPartners]} 
                    />
                </div>
            </div>
        </section>
    )
}

export default SectionBrands