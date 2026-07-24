"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export default function SiteTheme() {

    const [theme, setTheme] = useState(null);

    // Set Initial Theme on Component Mount
    useEffect(() => {
        const storedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initialTheme = storedTheme || (prefersDark ? "dark" : "light");

        setTheme(initialTheme);
        document.documentElement.setAttribute("data-theme", initialTheme);
    }, []);

    // Toggle Theme Function
    function toggleTheme() {
        if (!theme) return;
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    };

    return (
        <button onClick={toggleTheme} aria-label="Toggle Theme" className="cursor-pointer">
            {theme === "light" ? <Moon /> : <Sun />}
        </button>
    );
}