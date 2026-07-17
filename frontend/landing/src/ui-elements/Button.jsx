import React from 'react'

const Button = ({ children, type = "primary", href, ...props }) => {
    const className = type === "secondary"
        ? 'py-3 px-8 border-2 border-gradient-border inline-flex justify-center items-center gap-4 rounded-2xl group hover:scale-105 transition-all cursor-pointer text-inherit no-underline'
        : 'text-white py-3 px-8 border border-transparent bg-clip-padding inline-flex justify-center items-center gap-4 text-gradient rounded-2xl group hover:scale-105 transition-all cursor-pointer no-underline';

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
