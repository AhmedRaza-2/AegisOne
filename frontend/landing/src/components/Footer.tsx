import React from 'react';

interface FooterProps {
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

export default function Footer({ onOpenPrivacy, onOpenTerms }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, label: string) => {
    e.preventDefault();
    if (label === 'Privacy Policy' && onOpenPrivacy) {
      onOpenPrivacy();
    } else if (label === 'Terms of Service' && onOpenTerms) {
      onOpenTerms();
    } else {
      // Smooth scroll to respective sections for other links
      if (label === 'Security Architecture') {
        const el = document.getElementById('technical-blueprint');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else if (label === 'Documentation') {
        const el = document.getElementById('onboarding');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else if (label === 'Status') {
        const el = document.getElementById('ready-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const links = [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Security Architecture', href: '#' },
    { label: 'Status', href: '#' },
    { label: 'Documentation', href: '#' },
  ];

  return (
    <footer id="footer-root" className="bg-[#F8FAFC] py-12 border-t border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Left column - logo & copyright */}
        <div className="flex flex-col items-center md:items-start gap-2 text-center md:text-left" id="footer-left">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="6" fill="#0F172A"/>
              <path d="M12 5.5L6.5 7.5V11.5C6.5 14.85 8.85 17.95 12 18.5C15.15 17.95 17.5 14.85 17.5 11.5V7.5L12 5.5Z" fill="#0A5ED6"/>
              <path d="M11.5 8H12.5V14.5H11.5V8ZM12 16C11.5 16 11.25 15.75 11.25 15.25C11.25 14.75 11.5 14.5 12 14.5C12.5 14.5 12.75 14.75 12.75 15.25C12.75 15.75 12.5 16 12 16Z" fill="white"/>
            </svg>
            <span className="font-sans font-bold text-base text-[#0F172A] tracking-tight">
              Aegis<span className="text-[#0A5ED6]">One</span>
            </span>
          </div>
          <span className="font-sans text-xs text-[#76777D] mt-2">
            © {currentYear} AegisOne. All rights reserved. Sovereign Link Protection for Local Offices &amp; SMEs.
          </span>
          <div className="font-sans text-[11px] text-[#76777D] mt-1 flex flex-wrap gap-x-3 gap-y-1 justify-center md:justify-start items-center">
            <span>WhatsApp Support: <strong className="text-[#0F172A]">0334 5216102</strong></span>
            <span className="hidden md:inline text-slate-300">•</span>
            <span>Support Email: <strong className="text-[#0F172A] hover:text-[#0A5ED6] transition-colors"><a href="mailto:araza2125012.pgc@gmail.com">araza2125012.pgc@gmail.com</a></strong></span>
          </div>
        </div>

        {/* Right column - Link list */}
        <div className="flex flex-wrap items-center justify-center gap-6" id="footer-right-links">
          {links.map((link, idx) => (
            <a 
              key={idx}
              href={link.href}
              id={`footer-link-${idx}`}
              onClick={(e) => handleLinkClick(e, link.label)}
              className="font-sans text-xs font-semibold text-[#45464D] hover:text-[#0A5ED6] transition-colors duration-150"
            >
              {link.label}
            </a>
          ))}
        </div>

      </div>
    </footer>
  );
}
