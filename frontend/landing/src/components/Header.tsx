import React from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onScrollTo: (elementId: string) => void;
}

export default function Header({ onScrollTo }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { label: 'Why In-House?', id: 'why-in-house' },
    { label: 'How It Works', id: 'how-it-works' },
    { label: 'Architecture', id: 'architecture' },
    { label: 'Deployment', id: 'deployment' },
    { label: 'Documentation', id: 'documentation' },
  ];

  const handleNavClick = (id: string) => {
    setMobileMenuOpen(false);
    onScrollTo(id);
  };

  return (
    <header id="header-root" className="sticky top-0 z-50 bg-[#F8FAFC]/90 backdrop-blur-md border-b border-[#E2E8F0] px-6 py-4 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div 
          id="logo-container" 
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          {/* Custom generated precise vector logo icon matching screenshot */}
          <svg className="w-6 h-6 shrink-0 transition-transform duration-200 group-hover:scale-105" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#0F172A"/>
            <path d="M12 5.5L6.5 7.5V11.5C6.5 14.85 8.85 17.95 12 18.5C15.15 17.95 17.5 14.85 17.5 11.5V7.5L12 5.5Z" fill="#0A5ED6"/>
            <path d="M11.5 8H12.5V14.5H11.5V8ZM12 16C11.5 16 11.25 15.75 11.25 15.25C11.25 14.75 11.5 14.5 12 14.5C12.5 14.5 12.75 14.75 12.75 15.25C12.75 15.75 12.5 16 12 16Z" fill="white"/>
          </svg>
          <span className="font-sans font-bold text-xl text-[#0F172A] tracking-tight">
            Aegis<span className="text-[#0A5ED6]">One</span>
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav id="desktop-nav" className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => handleNavClick(item.id)}
              className="font-sans text-sm font-medium text-[#45464D] hover:text-[#0F172A] transition-colors duration-200 cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Desktop CTAs matching screenshot */}
        <div id="desktop-ctas" className="hidden md:flex items-center gap-6">
          <Link
            to="/login"
            className="font-sans text-sm font-medium text-[#45464D] hover:text-[#0F172A] transition-colors duration-200 cursor-pointer"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="font-sans text-sm font-semibold bg-[#0A5ED6] text-white hover:bg-[#0B63E0] px-5 py-2.5 rounded-lg shadow-xs transition-all duration-200 cursor-pointer"
          >
            Register Org
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <div className="flex md:hidden items-center gap-3">
          <Link
            to="/login"
            className="font-sans text-xs font-semibold px-2.5 py-1.5 rounded-md bg-slate-100 text-[#0F172A]"
          >
            Login
          </Link>
          <button
            id="mobile-menu-trigger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-[#0F172A] hover:bg-slate-100 rounded-md transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div id="mobile-nav-dropdown" className="md:hidden mt-4 pt-4 border-t border-[#E2E8F0] flex flex-col gap-4 animate-fadeIn">
          {navItems.map((item) => (
            <button
              key={item.id}
              id={`mobile-nav-item-${item.id}`}
              onClick={() => handleNavClick(item.id)}
              className="font-sans text-left text-sm font-medium text-[#45464D] hover:text-[#0F172A] py-1"
            >
              {item.label}
            </button>
          ))}
          <div className="h-[1px] bg-slate-200 my-1" />
          <Link
            to="/register"
            onClick={() => setMobileMenuOpen(false)}
            className="font-sans w-full text-center text-sm font-semibold bg-[#0A5ED6] text-white hover:bg-[#0B63E0] py-2.5 rounded-lg block"
          >
            Register Org
          </Link>
        </div>
      )}
    </header>
  );
}

