import React from 'react'

const Button = ({ children, type = "primary" }) => {

    if (type == "secondary") {
        return (
            <button
                className='py-3 px-8 border-2 border-gradient-border inline-flex justify-center items-center gap-4 rounded-2xl group hover:scale-105 transition-all cursor-pointer'
            >{children}</button>
        )
    }

    return (
        <button
            className='text-white py-3 px-8 border border-transparent bg-clip-padding inline-flex justify-center items-center gap-4 text-gradient rounded-2xl group hover:scale-105 transition-all cursor-pointer'
        >{children}</button>
    )
}

export default Button
