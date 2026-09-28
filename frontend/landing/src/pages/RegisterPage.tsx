import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import AuthLoadingOverlay from '../components/AuthLoadingOverlay';
import {
  Building2, User, Mail, Lock, Phone, Globe, Users, Briefcase,
  ChevronRight, ChevronLeft, Shield, CheckCircle2, Loader2, Eye, EyeOff, X, Sparkles, Check,
  Search, ChevronDown
} from 'lucide-react';
import { registerOrganization } from '../lib/org-service';
import { supabase } from '../lib/supabase';
import { PRICING_PLANS, getPlanByEmployeeCount, getPlanById, isValidPlan } from '../config/pricingConfig';

// ─── Constants ───────────────────────────────────────────────────────────────
const INDUSTRIES = [
  'Technology', 'Finance & Banking', 'Healthcare', 'Education',
  'Manufacturing', 'Retail & E-Commerce', 'Legal & Compliance',
  'Government', 'Telecommunications', 'Other',
];

const ALL_COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
  'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
  'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'East Timor', 'Ecuador',
  'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau',
  'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait',
  'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
  'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru',
  'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman',
  'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino',
  'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
  'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden',
  'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia',
  'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

const EMP_RANGES = [
  { label: '1 – 100 Employees', value: 100 },
  { label: '101 – 1000 Employees', value: 500 },
  { label: '1000+ Employees', value: 1000 },
];

// ─── Country Dial Codes ───────────────────────────────────────────────────────
const COUNTRY_DIAL_CODES: Record<string, string> = {
  'Afghanistan': '+93', 'Albania': '+355', 'Algeria': '+213', 'Andorra': '+376',
  'Angola': '+244', 'Antigua and Barbuda': '+1-268', 'Argentina': '+54', 'Armenia': '+374',
  'Australia': '+61', 'Austria': '+43', 'Azerbaijan': '+994', 'Bahamas': '+1-242',
  'Bahrain': '+973', 'Bangladesh': '+880', 'Barbados': '+1-246', 'Belarus': '+375',
  'Belgium': '+32', 'Belize': '+501', 'Benin': '+229', 'Bhutan': '+975',
  'Bolivia': '+591', 'Bosnia and Herzegovina': '+387', 'Botswana': '+267', 'Brazil': '+55',
  'Brunei': '+673', 'Bulgaria': '+359', 'Burkina Faso': '+226', 'Burundi': '+257',
  'Cambodia': '+855', 'Cameroon': '+237', 'Canada': '+1', 'Cape Verde': '+238',
  'Central African Republic': '+236', 'Chad': '+235', 'Chile': '+56', 'China': '+86',
  'Colombia': '+57', 'Comoros': '+269', 'Congo': '+242', 'Costa Rica': '+506',
  'Croatia': '+385', 'Cuba': '+53', 'Cyprus': '+357', 'Czech Republic': '+420',
  'Denmark': '+45', 'Djibouti': '+253', 'Dominica': '+1-767', 'Dominican Republic': '+1-809',
  'East Timor': '+670', 'Ecuador': '+593', 'Egypt': '+20', 'El Salvador': '+503',
  'Equatorial Guinea': '+240', 'Eritrea': '+291', 'Estonia': '+372', 'Eswatini': '+268',
  'Ethiopia': '+251', 'Fiji': '+679', 'Finland': '+358', 'France': '+33',
  'Gabon': '+241', 'Gambia': '+220', 'Georgia': '+995', 'Germany': '+49',
  'Ghana': '+233', 'Greece': '+30', 'Grenada': '+1-473', 'Guatemala': '+502',
  'Guinea': '+224', 'Guinea-Bissau': '+245', 'Guyana': '+592', 'Haiti': '+509',
  'Honduras': '+504', 'Hungary': '+36', 'Iceland': '+354', 'India': '+91',
  'Indonesia': '+62', 'Iran': '+98', 'Iraq': '+964', 'Ireland': '+353',
  'Israel': '+972', 'Italy': '+39', 'Ivory Coast': '+225', 'Jamaica': '+1-876',
  'Japan': '+81', 'Jordan': '+962', 'Kazakhstan': '+7', 'Kenya': '+254',
  'Kiribati': '+686', 'Kuwait': '+965', 'Kyrgyzstan': '+996', 'Laos': '+856',
  'Latvia': '+371', 'Lebanon': '+961', 'Lesotho': '+266', 'Liberia': '+231',
  'Libya': '+218', 'Liechtenstein': '+423', 'Lithuania': '+370', 'Luxembourg': '+352',
  'Madagascar': '+261', 'Malawi': '+265', 'Malaysia': '+60', 'Maldives': '+960',
  'Mali': '+223', 'Malta': '+356', 'Marshall Islands': '+692', 'Mauritania': '+222',
  'Mauritius': '+230', 'Mexico': '+52', 'Micronesia': '+691', 'Moldova': '+373',
  'Monaco': '+377', 'Mongolia': '+976', 'Montenegro': '+382', 'Morocco': '+212',
  'Mozambique': '+258', 'Myanmar': '+95', 'Namibia': '+264', 'Nauru': '+674',
  'Nepal': '+977', 'Netherlands': '+31', 'New Zealand': '+64', 'Nicaragua': '+505',
  'Niger': '+227', 'Nigeria': '+234', 'North Korea': '+850', 'North Macedonia': '+389',
  'Norway': '+47', 'Oman': '+968', 'Pakistan': '+92', 'Palau': '+680',
  'Palestine': '+970', 'Panama': '+507', 'Papua New Guinea': '+675', 'Paraguay': '+595',
  'Peru': '+51', 'Philippines': '+63', 'Poland': '+48', 'Portugal': '+351',
  'Qatar': '+974', 'Romania': '+40', 'Russia': '+7', 'Rwanda': '+250',
  'Saint Kitts and Nevis': '+1-869', 'Saint Lucia': '+1-758', 'Saint Vincent and the Grenadines': '+1-784',
  'Samoa': '+685', 'San Marino': '+378', 'Sao Tome and Principe': '+239', 'Saudi Arabia': '+966',
  'Senegal': '+221', 'Serbia': '+381', 'Seychelles': '+248', 'Sierra Leone': '+232',
  'Singapore': '+65', 'Slovakia': '+421', 'Slovenia': '+386', 'Solomon Islands': '+677',
  'Somalia': '+252', 'South Africa': '+27', 'South Korea': '+82', 'South Sudan': '+211',
  'Spain': '+34', 'Sri Lanka': '+94', 'Sudan': '+249', 'Suriname': '+597',
  'Sweden': '+46', 'Switzerland': '+41', 'Syria': '+963', 'Taiwan': '+886',
  'Tajikistan': '+992', 'Tanzania': '+255', 'Thailand': '+66', 'Togo': '+228',
  'Tonga': '+676', 'Trinidad and Tobago': '+1-868', 'Tunisia': '+216', 'Turkey': '+90',
  'Turkmenistan': '+993', 'Tuvalu': '+688', 'Uganda': '+256', 'Ukraine': '+380',
  'United Arab Emirates': '+971', 'United Kingdom': '+44', 'United States': '+1',
  'Uruguay': '+598', 'Uzbekistan': '+998', 'Vanuatu': '+678', 'Vatican City': '+39',
  'Venezuela': '+58', 'Vietnam': '+84', 'Yemen': '+967', 'Zambia': '+260', 'Zimbabwe': '+263',
};

const getDialCode = (country: string): string => COUNTRY_DIAL_CODES[country] ?? '';

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <React.Fragment key={step}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 ${step < current ? 'bg-emerald-500 text-white' :
              step === current ? 'bg-[#0A5ED6] text-white ring-4 ring-[#0A5ED6]/30' :
                'bg-slate-200 text-slate-500'
            }`}>
            {step < current ? <CheckCircle2 className="w-4 h-4" /> : step}
          </div>
          {step < total && (
            <div className={`h-px w-10 transition-all duration-300 ${step < current ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Input Component ─────────────────────────────────────────────────────────
interface InputProps {
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}
function Field({ label, icon, error, children }: InputProps) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
        {icon} {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
    </div>
  );
}

const inputCls = "w-full bg-[#F6FAFD] border border-[#E1EBF2] rounded-lg px-3.5 py-2 text-sm text-[#0A1931] placeholder-[#8CA3B8] focus:outline-none focus:border-[#4A7FA7] focus:ring-[3px] focus:ring-[#4A7FA7]/15 focus:bg-white transition-all";
const selectCls = inputCls + " appearance-none cursor-pointer";

// ─── Country Selector Component ───────────────────────────────────────────────
function CountrySelector({
  value,
  onChange,
  error
}: {
  value: string;
  onChange: (val: string) => void;
  error?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter countries by search query
  const filteredCountries = useMemo(() => {
    if (!search.trim()) return ALL_COUNTRIES;
    const q = search.toLowerCase().trim();
    return ALL_COUNTRIES.filter(c => c.toLowerCase().includes(q));
  }, [search]);

  // Group filtered countries by initial letter
  const groupedCountries = useMemo(() => {
    const groups: { [key: string]: string[] } = {};
    filteredCountries.forEach(country => {
      const firstLetter = country[0].toUpperCase();
      if (!groups[firstLetter]) groups[firstLetter] = [];
      groups[firstLetter].push(country);
    });
    return groups;
  }, [filteredCountries]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        id="country-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`${selectCls} flex items-center justify-between text-left ${
          !value ? 'text-[#8CA3B8]' : 'text-[#0A1931] font-medium'
        } ${error ? 'border-red-400 ring-2 ring-red-400/20' : ''}`}
      >
        <span className="truncate">{value || 'Select country...'}</span>
        <ChevronDown className={`w-4 h-4 text-[#4A6D8C] transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-[#E1EBF2] rounded-xl shadow-xl p-3 text-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8CA3B8]" />
            <input
              type="text"
              placeholder="Search country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F6FAFD] border border-[#E1EBF2] rounded-lg pl-9 pr-8 py-1.5 text-xs text-[#0A1931] placeholder-[#8CA3B8] focus:outline-none focus:border-[#4A7FA7] focus:ring-2 focus:ring-[#4A7FA7]/15 transition-all"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Scrollable Countries List */}
          <div
            ref={listRef}
            onWheel={(e) => e.stopPropagation()}
            style={{ overscrollBehavior: 'contain' }}
            className="max-h-64 overflow-y-auto pr-1 space-y-2 custom-scrollbar divide-y divide-slate-100 touch-pan-y"
          >
            {Object.keys(groupedCountries).length === 0 ? (
              <div className="py-6 text-center text-slate-400 font-medium text-xs">
                No countries match "{search}"
              </div>
            ) : (
              Object.entries(groupedCountries).map(([letter, countries]) => (
                <div key={letter} className="pt-2 first:pt-0">
                  <div className="sticky top-0 bg-white/95 backdrop-blur-xs py-0.5 px-2 text-[10px] font-extrabold text-[#0A5ED6] uppercase tracking-wider border-b border-slate-100 z-10">
                    {letter}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {countries.map((c) => {
                      const isSelected = value === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            onChange(c);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-md flex items-center justify-between text-xs font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 text-[#0A5ED6] font-bold'
                              : 'text-slate-700 hover:bg-[#F6FAFD] hover:text-[#0A1931]'
                          }`}
                        >
                          <span>{c}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#0A5ED6]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [registeredEmail, setRegisteredEmail] = useState(''); // '' = not done, email = show success screen
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Countdown timer for rate-limit cooldown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setTimeout(() => setCooldownSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldownSeconds]);

  // Countdown timer for resend email cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Auto-redirect to portal if email is confirmed in another tab
  useEffect(() => {
    if (!registeredEmail) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate('/portal', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [registeredEmail, navigate]);

  // Form state
  const [form, setForm] = useState({
    name: '',
    industry: '',
    employee_count: 100,
    country: '',
    admin_name: '',
    admin_email: '',
    phone: '',
    password: '',
    confirm_password: '',
    agreed: false,
  });
  const [customIndustry, setCustomIndustry] = useState('');

  // Parse URL query params on mount for plan & billing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    const billingParam = params.get('billing');

    if (billingParam === 'monthly' || billingParam === 'annual') {
      setBillingCycle(billingParam);
    }

    if (isValidPlan(planParam)) {
      const initialPlan = getPlanById(planParam);
      setForm(prev => ({ ...prev, employee_count: initialPlan.apiValue }));
    }
  }, []);

  // Derive active package tier dynamically from employee_count (real-time bi-directional sync)
  const activePlan = useMemo(() => {
    return getPlanByEmployeeCount(form.employee_count);
  }, [form.employee_count]);

  // ── Emoji stripper ────────────────────────────────────────────────────────
  const stripEmoji = (str: string): string =>
    str.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{200D}\u{20E3}\u{FE4F}\u{FFF0}-\u{FFFF}]/gu,
      ''
    );

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setError('');
    let val: string | boolean;
    if (e.target.type === 'checkbox') {
      val = (e.target as HTMLInputElement).checked;
    } else {
      // Strip emojis from every text-type input
      val = stripEmoji(e.target.value);
    }
    setForm(prev => ({ ...prev, [key]: val }));
  };

  // ── Validation per step ────────────────────────────────────────────────────
  const validateStep = (s: number): string => {
    if (s === 1) {
      const orgName = form.name.trim();
      if (!orgName) return 'Organization name is required.';
      if (orgName.length < 2) return 'Organization name must be at least 2 characters.';
      if (orgName.length > 100) return 'Organization name must not exceed 100 characters.';
      if (!/^[a-zA-Z0-9\s\-\&\.\,\'\/\(\)]+$/.test(orgName)) {
        return 'Organization name contains invalid special characters.';
      }
      if (!/[a-zA-Z0-9]/.test(orgName)) {
        return 'Organization name must contain valid letters or numbers.';
      }

      if (!form.industry) return 'Please select an industry.';
      if (form.industry === 'Other') {
        const custInd = customIndustry.trim();
        if (!custInd) return 'Please enter your custom industry name.';
        if (custInd.length < 2) return 'Custom industry name must be at least 2 characters.';
        if (!/^[a-zA-Z0-9\s\-\&\/\,\.\(\)]+$/.test(custInd)) {
          return 'Industry name contains invalid special characters.';
        }
      }

      if (!form.country) return 'Please select a country / region.';
    }

    if (s === 2) {
      const adminName = form.admin_name.trim();
      if (!adminName) return 'Admin full name is required.';
      if (adminName.length < 2) return 'Admin full name must be at least 2 characters.';
      // Name regex: strictly letters, spaces, hyphens, apostrophes, and dots (NO DIGITS or special chars like #$@!)
      const nameRegex = /^[a-zA-Z\s\-\'\.\u00C0-\u024F]+$/;
      if (!nameRegex.test(adminName)) {
        return 'Admin full name can only contain letters, spaces, hyphens, and apostrophes (no numbers or special characters).';
      }

      const email = form.admin_email.trim();
      if (!email) return 'Business email is required.';
      // Strict RFC email validation with valid TLD (min 2 chars)
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email) || email.includes('..')) {
        return 'Please enter a valid business email address (e.g. name@company.com).';
      }
      
      // Block obvious fake domains or keyboard smashing (e.g., GMAILLL.COMMM)
      const domainPart = email.split('@')[1].toLowerCase();
      if (/([a-z])\1{2,}/.test(domainPart)) {
        return 'Please enter a valid business email address. The domain format looks incorrect or contains too many repeating letters.';
      }
      // Block weird invalid TLDs commonly typed by accident like .comm, .con, .cm
      const invalidTlds = ['comm', 'commm', 'con', 'cm', 'gmial', 'gmai', 'gmal'];
      if (invalidTlds.some(invalid => domainPart.includes(invalid))) {
         return 'Email domain appears to have a typo (e.g. .comm instead of .com). Please double check.';
      }

      const phone = form.phone.trim();
      if (!phone) return 'Phone number is required.';
      const cleanDigits = phone.replace(/\D/g, '');
      
      // Dynamic Phone Length Check based on selected country
      const countryLengths: Record<string, number> = {
        'Pakistan': 10,       // e.g. 336 1234567
        'United States': 10,  // e.g. 202 555 1234
        'Canada': 10,
        'India': 10,
        'United Kingdom': 10, // Mobile without leading 0
        'Australia': 9,       // Mobile without leading 0
        'Saudi Arabia': 9,
        'United Arab Emirates': 9,
      };

      if (form.country && countryLengths[form.country]) {
        const expectedLen = countryLengths[form.country];
        if (cleanDigits.length !== expectedLen) {
          return `Invalid phone number length. Local numbers in ${form.country} must be exactly ${expectedLen} digits long. (Do not include the country dial code again).`;
        }
        if (form.country === 'Pakistan' && !cleanDigits.startsWith('3')) {
          return 'Pakistani local numbers must start with 3 (e.g. 336 1234567).';
        }
      } else {
        // Generic fallback for other countries
        if (cleanDigits.length < 5 || cleanDigits.length > 15 || !/^\+?[0-9\s\-\(\)\.]{5,20}$/.test(phone)) {
          return 'Please enter a valid phone number (between 5 and 15 digits).';
        }
      }
    }

    if (s === 3) {
      if (form.password.length < 8) return 'Password must be at least 8 characters long.';
      if (form.password.length > 128) return 'Password must not exceed 128 characters.';
      // Only allow standard printable ASCII — blocks SQL injection strings, quotes, dashes etc.
      // Allowed: letters, digits, and safe specials: !@#$%^&*()_+-=[]{}|;:,.?/~`
      const allowedPassChars = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;:,.?/~`]+$/;
      if (!allowedPassChars.test(form.password)) {
        return "Password contains invalid characters. Use letters, numbers, and symbols like !@#$%^&*()_+-=[]{}|;:,.?";
      }
      // Block obvious injection / scripting patterns
      const injectionPattern = /('\s*(OR|AND)\s*'[^']*'\s*=\s*'[^']*')|(--|;|\bOR\b\s+\d+=\d+|\bAND\b\s+\d+=\d+|<script|SELECT\s+\*|DROP\s+TABLE|INSERT\s+INTO|UNION\s+SELECT)/i;
      if (injectionPattern.test(form.password)) {
        return 'Password contains disallowed patterns. Please choose a different password.';
      }
      if (!/[A-Z]/.test(form.password)) return 'Password must contain at least one uppercase letter (A-Z).';
      if (!/[a-z]/.test(form.password)) return 'Password must contain at least one lowercase letter (a-z).';
      if (!/[0-9]/.test(form.password)) return 'Password must contain at least one number (0-9).';
      if (!form.confirm_password) return 'Please confirm your password by re-entering it below.';
      if (form.password !== form.confirm_password) return 'Passwords do not match. Please check and try again.';
      if (!form.agreed) return 'You must agree to the Terms of Service and Privacy Policy.';
    }
    return '';
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setStep(s => s + 1);
    setError('');
  };

  // ── Friendly error mapper ──────────────────────────────────────────────────
  const sanitizeError = (raw: string): string => {
    const r = raw.toLowerCase();
    // Supabase RLS / DB errors
    if (r.includes('row-level security') || r.includes('rls') || r.includes('policy for table'))
      return 'Registration is temporarily restricted. Please contact support or try again later.';
    if (r.includes('duplicate key') || r.includes('already registered') || r.includes('already exists'))
      return 'This email address is already registered. Please sign in or use a different email.';
    if (r.includes('email rate limit') || r.includes('rate limit') || r.includes('too many requests'))
      return 'Too many sign-up attempts. Please wait a few minutes and try again.';
    if (r.includes('invalid email') || r.includes('invalid_email'))
      return 'The email address provided is not valid. Please check and try again.';
    if (r.includes('weak password') || r.includes('password should be'))
      return 'Your password is too weak. Please choose a stronger password (min. 8 characters, uppercase, number).';
    if (r.includes('network') || r.includes('fetch') || r.includes('failed to fetch'))
      return 'A network error occurred. Please check your connection and try again.';
    if (r.includes('user already registered') || r.includes('user_already_exists'))
      return 'An account with this email already exists. Please sign in instead.';
    if (r.includes('signup disabled') || r.includes('signups not allowed'))
      return 'New registrations are temporarily paused. Please try again later or contact support.';
    if (r.includes('organization') && r.includes('already registered'))
      return raw; // This one is already user-friendly from org-service.ts
    // Generic fallback — never expose raw db errors in production, but helpful for debugging
    return `Registration failed. Please review your details and try again, or contact support. (Debug: ${raw})`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStep(3);
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');
    try {
      const finalIndustry = form.industry === 'Other' ? customIndustry.trim() : form.industry;

      // Trigger org-service registration
      const dialCode = getDialCode(form.country);
      const fullPhone = dialCode && !form.phone.trim().startsWith('+')
        ? `${dialCode} ${form.phone.trim()}`
        : form.phone.trim();

      const org = await registerOrganization({
        name: form.name.trim(),
        industry: finalIndustry,
        employee_count: form.employee_count,
        country: form.country,
        admin_name: form.admin_name.trim(),
        admin_email: form.admin_email.trim(),
        phone: fullPhone,
        password: form.password,
      });

      // Send Admin Welcome & Credentials email via public auth API
      try {
        const apiHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
        await fetch(`http://${apiHost}:8000/auth/send-admin-credentials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.admin_email,
            full_name: form.admin_name,
            password: form.password,
            org_name: form.name
          })
        });
      } catch (e) {
        console.warn("[RegisterPage] Admin credentials email dispatch notify skipped/logged:", e);
      }

      // Temporarily store the password in sessionStorage so PortalPage can pass it to the local setup wizard
      sessionStorage.setItem('tempAdminPassword', form.password);

      // Show email confirmation screen instead of navigating directly
      setRegisteredEmail(form.admin_email.trim());
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const friendly = sanitizeError(rawMsg);
      setError(friendly);
      // If it's a rate limit error, start a 60-second cooldown
      if (rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('too many')) {
        setCooldownSeconds(60);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Resend confirmation email ───────────────────────────────────────────────
  const handleResendEmail = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendSuccess(false);
    try {
      const { error } = await (await import('../lib/supabase')).supabase.auth.resend({
        type: 'signup',
        email: registeredEmail,
        options: { emailRedirectTo: `${window.location.origin}/portal` },
      });
      if (error) throw error;
      setResendSuccess(true);
      setResendCooldown(60);
    } catch {
      // silently ignore — countdown still protects spam
      setResendCooldown(30);
    } finally {
      setResendLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // ── Email confirmation success screen ──────────────────────────────────────
  if (registeredEmail) {
    return (
      <div className="min-h-screen bg-[#F6FAFD] text-[#0A1931] flex flex-col font-sans">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
            <div className="w-[600px] h-[600px] bg-[#4A7FA7]/5 rounded-full blur-[120px]" />
          </div>
          <div className="w-full max-w-md relative z-10 text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0A5ED6] to-[#4A7FA7] flex items-center justify-center shadow-lg shadow-blue-200">
                <Mail className="w-9 h-9 text-white" />
              </div>
            </div>

            {/* Heading */}
            <div>
              <h1 className="text-2xl font-bold text-[#0A1931]">Check Your Inbox</h1>
              <p className="text-sm text-[#4A6D8C] mt-2 leading-relaxed">
                We've sent a confirmation email to
              </p>
              <p className="text-sm font-bold text-[#0A5ED6] mt-1 break-all">{registeredEmail}</p>
            </div>

            {/* Steps card */}
            <div className="bg-white border border-[#E1EBF2] rounded-2xl p-5 shadow-sm text-left space-y-3">
              {[
                { n: '1', text: 'Open the email from AegisOne in your inbox (check Spam too).' },
                { n: '2', text: 'Click the "Confirm my email" button inside the email.' },
                { n: '3', text: 'You\'ll be redirected to your portal to complete setup.' },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-[#0A5ED6] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {n}
                  </div>
                  <p className="text-xs text-[#4A6D8C] leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            {/* Resend */}
            <div className="space-y-2">
              {resendSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs text-emerald-700 font-medium flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirmation email resent successfully!
                </div>
              )}
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resendCooldown > 0 || resendLoading}
                className="w-full flex items-center justify-center gap-2 border border-[#E1EBF2] bg-white hover:bg-[#F6FAFD] disabled:opacity-60 disabled:cursor-not-allowed text-[#4A6D8C] font-semibold text-sm py-3 rounded-xl transition-all"
              >
                {resendLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : resendCooldown > 0 ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Resend available in {resendCooldown}s</>
                ) : (
                  <><Mail className="w-4 h-4" /> Didn't receive it? Resend Email</>
                )}
              </button>
              <p className="text-xs text-[#8CA3B8]">
                Already confirmed?{' '}
                <Link to="/login" className="text-[#4A7FA7] font-semibold hover:text-[#3D6C90]">
                  Sign in to Portal
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6FAFD] text-[#0A1931] flex flex-col font-sans">
      <Header />

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-4 md:py-6 relative z-10">
        {/* Decorative background positioned behind the form area */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
          <div className="w-[600px] h-[600px] bg-[#4A7FA7]/5 rounded-full blur-[120px]" />
        </div>

        <div className="w-full max-w-2xl relative z-10">

          {/* Header — single clean title */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-[#0A1931]">
              {step === 1 && 'Register Your Organization'}
              {step === 2 && 'Administrator Details'}
              {step === 3 && 'Create Your Password'}
            </h1>
            <p className="text-xs text-[#4A6D8C] mt-1">
              {step === 1 && 'Tell us about your organization.'}
              {step === 2 && 'Who is the primary security administrator?'}
              {step === 3 && 'Secure your admin portal account.'}
            </p>
          </div>

          <StepIndicator current={step} total={3} />

          {/* Form Card */}
          <div className="bg-white border border-[#E1EBF2] rounded-2xl p-5 md:p-6 shadow-md">
            <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} className="space-y-4" noValidate>

                  {/* ── STEP 1: Organization ── */}
                  {step === 1 && (
                    <>
                      <Field label="Organization Name" icon={<Building2 className="w-3 h-3 text-[#4A6D8C]" />}>
                        <input
                          id="org-name"
                          type="text"
                          className={inputCls}
                          placeholder="e.g. ABC Software House"
                          value={form.name}
                          onChange={set('name')}
                          autoFocus
                        />
                      </Field>

                      <Field label="Industry" icon={<Briefcase className="w-3 h-3 text-[#4A6D8C]" />}>
                        <select id="industry" className={selectCls} value={form.industry} onChange={set('industry')}>
                          <option value="">Select industry...</option>
                          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>

                        {form.industry === 'Other' && (
                          <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <input
                              id="custom-industry"
                              type="text"
                              className={inputCls}
                              placeholder="Specify your custom industry name..."
                              value={customIndustry}
                              onChange={(e) => {
                                setError('');
                                setCustomIndustry(stripEmoji(e.target.value));
                              }}
                              autoFocus
                            />
                          </div>
                        )}
                      </Field>

                      <Field label="Country / Region" icon={<Globe className="w-3 h-3 text-[#4A6D8C]" />}>
                        <CountrySelector
                          value={form.country}
                          onChange={(c) => {
                            setError('');
                            setForm(prev => ({
                              ...prev,
                              country: c,
                            }));
                          }}
                        />
                      </Field>

                      {/* Single Unified Protection Plan & Organization Size Selector */}
                      <Field label="Security Package & Workforce Scale" icon={<Users className="w-3 h-3 text-[#4A6D8C]" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          {EMP_RANGES.map(r => {
                            const plan = getPlanByEmployeeCount(r.value);
                            const isSelected = form.employee_count === r.value;
                            const price = billingCycle === 'annual' ? plan.annualEquivalentMonthly : plan.monthlyPrice;

                            return (
                              <button
                                type="button"
                                key={r.value}
                                onClick={() => setForm(p => ({ ...p, employee_count: r.value }))}
                                className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between relative cursor-pointer ${
                                  isSelected
                                    ? 'bg-gradient-to-b from-blue-50/80 to-white border-[#0A5ED6] ring-2 ring-[#0A5ED6]/20 shadow-sm'
                                    : 'bg-[#F6FAFD] border-[#E1EBF2] hover:border-[#0A5ED6]/50 hover:bg-white text-slate-700'
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#0A5ED6] text-white flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                  </div>
                                )}

                                <div>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className={`text-xs font-extrabold ${isSelected ? 'text-[#0A5ED6]' : 'text-[#0A1931]'}`}>
                                      {plan.name}
                                    </span>
                                  </div>
                                  <span className="text-xs font-semibold text-slate-600 block mb-2">
                                    {r.label}
                                  </span>
                                </div>

                                <div className="border-t border-[#E1EBF2]/80 pt-2 flex items-baseline justify-between w-full">
                                  <span className="text-sm font-extrabold text-[#0A1931]">${price}<span className="text-[10px] font-normal text-slate-500">/mo</span></span>
                                  <span className="text-[10px] text-slate-400 font-medium">{billingCycle === 'annual' ? 'Billed annually' : 'Monthly'}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </Field>
                    </>
                  )}

              {/* ── STEP 2: Admin ── */}
              {step === 2 && (
                <>
                  <Field label="Full Name" icon={<User className="w-3 h-3" />}>
                    <input
                      id="admin-name"
                      type="text"
                      className={inputCls}
                      placeholder="Ahmed Raza"
                      value={form.admin_name}
                      onChange={set('admin_name')}
                      autoFocus
                    />
                  </Field>

                  <Field label="Business Email" icon={<Mail className="w-3 h-3" />}>
                    <input
                      id="admin-email"
                      type="email"
                      className={inputCls}
                      placeholder="admin@company.com"
                      value={form.admin_email}
                      onChange={set('admin_email')}
                    />
                  </Field>

                  <Field label="Phone Number" icon={<Phone className="w-3 h-3" />}>
                    <div className="relative flex items-stretch">
                      {/* Dial code badge */}
                      {form.country && getDialCode(form.country) && (
                        <div className="shrink-0 flex items-center gap-1.5 bg-[#EBF4FC] border border-r-0 border-[#C7DAE8] rounded-l-lg px-2.5 text-xs font-bold text-[#0A5ED6] select-none">
                          <Phone className="w-3 h-3 text-[#4A7FA7]" />
                          {getDialCode(form.country)}
                        </div>
                      )}
                      <input
                        id="phone"
                        type="tel"
                        className={`${inputCls} ${
                          form.country && getDialCode(form.country) ? 'rounded-l-none border-l-0 focus:ring-offset-0' : ''
                        }`}
                        placeholder={form.country && getDialCode(form.country) ? 'e.g. 300 1234567' : '300 1234567'}
                        value={form.phone}
                        onChange={(e) => {
                          setError('');
                          let raw = stripEmoji(e.target.value);
                          const dialCode = getDialCode(form.country);
                          if (dialCode && raw.startsWith(dialCode)) {
                            raw = raw.slice(dialCode.length).trim();
                          }
                          setForm(prev => ({ ...prev, phone: raw }));
                        }}
                      />
                    </div>
                    {form.country && getDialCode(form.country) && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Country code <span className="font-semibold text-[#4A6D8C]">{getDialCode(form.country)}</span> attached on left. Enter local number only.
                      </p>
                    )}
                  </Field>
                </>
              )}

              {/* ── STEP 3: Security ── */}
              {step === 3 && (
                <>
                  <Field label="Portal Password" icon={<Lock className="w-3 h-3" />}>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className={inputCls + ' pr-11'}
                        placeholder="Min. 8 chars, 1 uppercase, 1 number"
                        value={form.password}
                        onChange={set('password')}
                        autoFocus
                      />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0A5ED6] transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Strength bar */}
                    {form.password && (
                      <div className="mt-1.5 h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${form.password.length < 8 ? 'w-1/4 bg-red-500' :
                            !/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password) ? 'w-2/4 bg-amber-500' :
                              'w-full bg-emerald-500'
                          }`} />
                      </div>
                    )}
                  </Field>

                  <Field label="Confirm Password" icon={<Lock className="w-3 h-3" />}>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        className={inputCls + ' pr-11'}
                        placeholder="Re-enter password"
                        value={form.confirm_password}
                        onChange={set('confirm_password')}
                      />
                      <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#4A7FA7] transition-colors">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      id="terms"
                      type="checkbox"
                      checked={form.agreed}
                      onChange={set('agreed')}
                      className="mt-0.5 w-4 h-4 rounded border-[#E1EBF2] bg-white accent-[#4A7FA7] cursor-pointer"
                    />
                    <span className="text-xs text-[#4A6D8C] leading-relaxed">
                      I agree to AegisOne's{' '}
                      <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTermsModal(true); }} className="text-[#4A7FA7] hover:text-[#3D6C90] cursor-pointer underline">Terms of Service</span>{' '}
                      and{' '}
                      <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPrivacyModal(true); }} className="text-[#4A7FA7] hover:text-[#3D6C90] cursor-pointer underline">Privacy Policy</span>.
                      I understand that organization data is stored only on my own server.
                    </span>
                  </label>
                </>
              )}

              {/* Error */}
              {error && (
                <div className={`border rounded-xl px-4 py-3 text-xs font-medium flex items-center gap-2 ${
                  cooldownSeconds > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    cooldownSeconds > 0 ? 'bg-amber-500' : 'bg-red-600'
                  }`} />
                  {error}
                  {cooldownSeconds > 0 && (
                    <span className="ml-auto font-bold text-amber-600 tabular-nums shrink-0">
                      {cooldownSeconds}s
                    </span>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => { setStep(s => s - 1); setError(''); setCooldownSeconds(0); }}
                    className="flex items-center gap-1.5 px-4 py-[11px] rounded-lg border border-[#E1EBF2] text-[#4A6D8C] text-sm font-semibold hover:border-[#C7DAE8] hover:bg-[#F6FAFD] transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || cooldownSeconds > 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#4A7FA7] hover:bg-[#3D6C90] disabled:bg-[#4A7FA7]/50 disabled:cursor-not-allowed text-white font-semibold py-[11px] rounded-lg text-sm transition-all shadow-sm"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating Organization...</>
                  ) : cooldownSeconds > 0 ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Please wait {cooldownSeconds}s...</>
                  ) : step < 3 ? (
                    <>Continue <ChevronRight className="w-4 h-4" /></>
                  ) : (
                    <>Complete Registration <CheckCircle2 className="w-4 h-4" /></>
                  )}
                </button>
              </div>

            </form>
          </div>

          <div className="mt-8 text-center space-y-3">
            <p className="text-sm text-[#4A6D8C]">
              Already registered?{' '}
              <Link to="/login" className="text-[#4A7FA7] font-semibold hover:text-[#3D6C90] transition-colors">
                Sign In to Portal
              </Link>
            </p>
            <p className="text-xs text-[#8CA3B8]">
              We only store your organization profile. No employee, threat, or internal data ever reaches our servers.
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <AuthLoadingOverlay
          title="Creating your organization"
          steps={['Validating details', 'Securing admin account', 'Deploying your workspace']}
        />
      )}

      {/* PRIVACY POLICY MODAL */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden text-left">
            <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <span className="font-sans font-bold text-lg text-[#0F172A]">AegisOne Privacy Commitment</span>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto space-y-4 text-xs text-[#45464D] leading-relaxed">
              <p className="font-semibold text-[#0F172A] text-sm">Your Data Stays With You — Always.</p>
              <p>
                At AegisOne, we design security tools around the fundamental right to data sovereignty. Unlike other link check and phishing services, our software functions directly inside your private hardware or corporate VPC. We do not inspect, upload, store, or transmit your URL checks, internal email activities, or employee credentials to our own external database servers.
              </p>
              <h4 className="font-bold text-[#0F172A] uppercase">1. Zero Log Transmission</h4>
              <p>
                All link inspection, scam diagnostics, and threat score calculations are completed entirely in memory on your private node. No log data or metadata containing user identity is sent back to AegisOne or any third-party analytics provider.
              </p>
              <h4 className="font-bold text-[#0F172A] uppercase">2. Local Storage Control</h4>
              <p>
                The audit trail, blocked scam URLs, and administrative threat reports generated by the software are saved directly onto your office local PostgreSQL database. You hold the unique decryption keys and maintain absolute control over security logs.
              </p>
              <h4 className="font-bold text-[#0F172A] uppercase">3. Strict Compliance</h4>
              <p>
                Because AegisOne does not act as a central data processor for your user traffic, using AegisOne greatly simplifies your GDPR, HIPAA, and SOC2 compliance profiles. No "cross-border data transfer" agreements are required for our core perimeter checks.
              </p>
            </div>
            <div className="bg-[#F8FAFC] border-t border-slate-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-5 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Accept &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TERMS OF SERVICE MODAL */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden text-left">
            <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <span className="font-sans font-bold text-lg text-[#0F172A]">AegisOne Software Terms of Use</span>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto space-y-4 text-xs text-[#45464D] leading-relaxed">
              <p className="font-semibold text-[#0F172A] text-sm">Simple, Direct License Agreements</p>
              <h4 className="font-bold text-[#0F172A] uppercase">1. Sovereign Node Licensing</h4>
              <p>
                AegisOne grants you a non-exclusive, non-transferable license to execute our sovereign link filtering container on your own physical computer servers or cloud VPC subnets. You are solely responsible for setting up and keeping the Docker container active.
              </p>
              <h4 className="font-bold text-[#0F172A] uppercase">2. No Malicious Misuse</h4>
              <p>
                The provided AegisOne software is created solely to detect, block, and log phishing emails, scam portals, and credential stealing links targeting your staff. You may not reverse engineer, redistribute, or use our cognitive heuristics for malicious purposes.
              </p>
              <h4 className="font-bold text-[#0F172A] uppercase">3. Support &amp; SLA</h4>
              <p>
                Our team provides direct support, updates to local AI heuristics, and remote system integration consults for custom Cloud VPC deployments. You can trigger support updates and request revisions directly at araza2125012.pgc@gmail.com.
              </p>
            </div>
            <div className="bg-[#F8FAFC] border-t border-slate-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowTermsModal(false)}
                className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-5 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Accept Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

