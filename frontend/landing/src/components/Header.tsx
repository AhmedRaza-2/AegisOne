import React from 'react';
import { Menu, X, ArrowLeft, Shield, Lock, HelpCircle } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  onScrollTo?: (elementId: string) => void;
}

export default function Header({ onScrollTo }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthPage = ['/login', '/register'].includes(location.pathname);

  const navItems = [
    { label: 'Why In-House?', id: 'why-in-house' },
    { label: 'How It Works', id: 'how-it-works' },
    { label: 'Architecture', id: 'architecture' },
    { label: 'Deployment', id: 'deployment' },
  ];

  // Trust badges shown on auth pages instead of nav links
  const trustBadges = [
    { icon: Shield, label: 'Enterprise-Grade Security' },
    { icon: Lock,   label: 'End-to-End Encrypted' },
    { icon: HelpCircle, label: 'Support', href: '/#contact' },
  ];

  const handleNavClick = (id: string) => {
    setMobileMenuOpen(false);
    if (onScrollTo) {
      onScrollTo(id);
    } else {
      navigate('/?scroll=' + id);
    }
  };

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const scrollId = params.get('scroll');
    if (scrollId && onScrollTo) {
      setTimeout(() => onScrollTo(scrollId), 100);
      navigate('/', { replace: true });
    }
  }, [location, onScrollTo, navigate]);

  return (
    <header id="header-root" className="sticky top-0 z-50 bg-[#F8FAFC]/90 backdrop-blur-md border-b border-[#E2E8F0] px-6 py-4 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">

        {/* Logo */}
        <div
          id="logo-container"
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => {
            if (location.pathname === '/') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              navigate('/');
            }
          }}
        >
          <img src="/logo.png" alt="AegisOne" className="h-7 w-auto shrink-0 transition-transform duration-200 group-hover:scale-105" />
          <span className="font-sans font-bold text-lg text-[#0A1931] tracking-tight">AegisOne</span>
        </div>

        {isAuthPage ? (
          /* ── Auth pages: show trust badges + back link instead of nav ── */
          <>
            <div className="hidden md:flex items-center gap-6">
              {trustBadges.map(({ icon: Icon, label, href }) =>
                href ? (
                  <a key={label} href={href} className="flex items-center gap-1.5 text-xs font-medium text-[#4A6D8C] hover:text-[#0A1931] transition-colors">
                    <Icon className="w-3.5 h-3.5 text-[#4A7FA7]" />
                    {label}
                  </a>
                ) : (
                  <span key={label} className="flex items-center gap-1.5 text-xs font-medium text-[#4A6D8C]">
                    <Icon className="w-3.5 h-3.5 text-[#4A7FA7]" />
                    {label}
                  </span>
                )
              )}
            </div>
            <button
              onClick={() => navigate('/')}
              className="hidden md:flex items-center gap-1.5 text-sm font-medium text-[#4A7FA7] hover:text-[#0A1931] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          </>
        ) : (
          /* ── Landing page: show full navigation ── */
          <>
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

            <div id="desktop-ctas" className="hidden md:flex items-center gap-6">
              <Link
                to="/login"
                className="font-sans text-sm font-medium text-[#45464D] hover:text-[#0F172A] transition-colors duration-200"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="font-sans text-sm font-semibold bg-[#4A7FA7] hover:bg-[#3D6C90] text-white px-5 py-2.5 rounded-lg shadow-xs transition-all duration-200"
              >
                Register Org
              </Link>
            </div>
          </>
        )}

        {/* Mobile menu trigger */}
        <div className="flex md:hidden items-center gap-3">
          {isAuthPage ? (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-slate-100 text-[#0F172A]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Home
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Mobile Navigation Dropdown — landing page only */}
      {mobileMenuOpen && !isAuthPage && (
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
            className="font-sans w-full text-center text-sm font-semibold bg-[#4A7FA7] text-white hover:bg-[#3D6C90] py-2.5 rounded-lg block"
          >
            Register Org
          </Link>
        </div>
      )}
    </header>
  );
}
