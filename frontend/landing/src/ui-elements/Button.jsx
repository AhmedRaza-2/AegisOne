import React from 'react'

const Button = ({ children, type = "primary", href, ...props }) => {
    const className = type === "secondary"
        ? 'py-2.5 sm:py-3 px-6 sm:px-8 border border-gradient-border sm:border-2 inline-flex justify-center items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl group sm:hover:scale-105 transition-all cursor-pointer text-inherit no-underline'
        // 10% accent: the one colour that means "click here"
        : 'text-white py-2.5 sm:py-3 px-6 sm:px-8 border border-transparent bg-[#6D4CFF] hover:bg-[#5935EB] shadow-lg shadow-[#6D4CFF]/25 inline-flex justify-center items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl group sm:hover:scale-105 transition-all cursor-pointer no-underline';

    if (href) {
        return (
            <a href={href} className={className} {...props}>
                {children}
            </a>
        )
    }

    return (
        <button className={className} {...props}>
            {children}
        </button>
    )
}

export default Button
