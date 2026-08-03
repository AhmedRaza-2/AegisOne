import { useEffect } from "react";

export default function SiteTheme() {
    useEffect(() => {
        document.documentElement.removeAttribute("data-theme");
        localStorage.removeItem("theme");
    }, []);

    return null;
}