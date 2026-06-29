import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ExplainerVideo from './components/ExplainerVideo';
import InvisibleRisk from './components/InvisibleRisk';
import Compliance from './components/Compliance';
import OnboardingFlow from './components/OnboardingFlow';
import TechnicalBlueprint from './components/TechnicalBlueprint';
import DeploymentStack from './components/DeploymentStack';
import ReadySection from './components/ReadySection';
import Footer from './components/Footer';

import { 
  ShieldCheck, X, Check, Server, Database, Key, Send, Copy, Sparkles, 
  ArrowRight, Calendar, Clock, Mail, User, MessageSquare, ExternalLink, ShieldAlert
} from 'lucide-react';

export default function App() {
  // Setup Request Modal States
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [nodeRegion, setNodeRegion] = useState('Pakistan Edge');
  const [deploymentCloud, setDeploymentCloud] = useState('Local Office PC');

  // Live Demo Booking Modal States
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoStep, setDemoStep] = useState(1);
  const [demoName, setDemoName] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [selectedDate, setSelectedDate] = useState('2026-06-29');
  const [selectedTime, setSelectedTime] = useState('02:00 PM PKT');

  // Privacy Policy & Terms Modal States
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [successToast, setSuccessToast] = useState<string | null>(null);

  const availableDates = [
    { label: 'Mon, Jun 29', value: 'Monday, June 29' },
    { label: 'Tue, Jun 30', value: 'Tuesday, June 30' },
    { label: 'Wed, Jul 01', value: 'Wednesday, July 01' },
  ];

  const availableTimes = [
    { label: '11:00 AM PKT', value: '11:00 AM PKT' },
    { label: '02:00 PM PKT', value: '02:00 PM PKT' },
    { label: '04:30 PM PKT', value: '04:30 PM PKT' },
  ];

  const handleScrollTo = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };

  const handleOnboardingSelectPhase = (phaseNum: number) => {
    showToast(`Phase ${phaseNum} Interactive configuration simulated successfully.`);
  };

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !workEmail) {
      showToast('Please enter both Company Name and Work Email.');
      return;
    }
    setSetupStep(2);
    showToast(`Setup request generated for ${companyName}! Notification emails dispatched.`);
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoName || !demoEmail) {
      showToast('Please enter both your Name and Email address.');
      return;
    }
    setDemoStep(2);
    showToast(`Live Demo requested on ${selectedDate} at ${selectedTime}!`);
  };

  const isCloudDeployment = deploymentCloud === 'AWS Private Cloud' || deploymentCloud === 'Google Cloud VPC';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900 relative">
      
      {/* Toast Notification */}
      {successToast && (
        <div 
          id="toast-notification"
          className="fixed bottom-6 right-6 z-50 bg-[#0F172A] border border-slate-800 text-white rounded-xl py-3.5 px-5 shadow-2xl flex items-center gap-3 animate-fadeIn glow-blue"
        >
          <div className="bg-[#0A5ED6] p-1.5 rounded-full text-white">
            <Check className="w-4 h-4" />
          </div>
          <span className="font-sans text-sm font-semibold">{successToast}</span>
        </div>
      )}

      {/* Navigation Header */}
      <Header onScrollTo={handleScrollTo} />

      {/* Main Container */}
      <main className="flex-1" id="main-content">
        {/* High-Fidelity Landing Page Views */}
        <div className="animate-fadeIn">
          {/* Hero Banner Section */}
          <Hero 
            onRequestSetup={() => {
              setSetupStep(1);
              setShowSetupModal(true);
            }}
            onViewArchitecture={() => handleScrollTo('architecture')}
          />

          {/* Interactive 3D Video Explainer Tour Section */}
            <ExplainerVideo onShowNotification={showToast} />

            {/* Cloud Risk Analysis Section */}
            <InvisibleRisk />

            {/* Compliance Governance Section */}
            <Compliance 
              onDownloadWhitepaper={() => {
                showToast('AegisOne Security Whitepaper downloaded successfully.');
              }}
            />

            {/* Onboarding Timeline Section */}
            <OnboardingFlow 
              onStartOnboarding={() => {
                setSetupStep(1);
                setShowSetupModal(true);
              }}
              onSelectPhase={handleOnboardingSelectPhase}
            />

            {/* Technical Blueprint Section */}
            <TechnicalBlueprint />

            {/* Deployment Stack Section */}
            <DeploymentStack />

            {/* Ready Call-To-Action Section */}
            <ReadySection 
              onRequestSetup={() => {
                setSetupStep(1);
                setShowSetupModal(true);
              }}
              onScheduleDemo={() => {
                setDemoStep(1);
                setShowDemoModal(true);
              }}
            />
          </div>
      </main>

      {/* Footer Brand bar */}
      <Footer 
        onOpenPrivacy={() => setShowPrivacyModal(true)}
        onOpenTerms={() => setShowTermsModal(true)}
      />

      {/* 1. SETUP REQUEST / CONFIGURATOR MODAL */}
      {showSetupModal && (
        <div id="setup-modal-overlay" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="setup-modal" className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden animate-scaleIn text-left">
            
            {/* Modal Header */}
            <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="24" height="24" rx="6" fill="#0F172A"/>
                  <path d="M12 5.5L6.5 7.5V11.5C6.5 14.85 8.85 17.95 12 18.5C15.15 17.95 17.5 14.85 17.5 11.5V7.5L12 5.5Z" fill="#0A5ED6"/>
                  <path d="M11.5 8H12.5V14.5H11.5V8ZM12 16C11.5 16 11.25 15.75 11.25 15.25C11.25 14.75 11.5 14.5 12 14.5C12.5 14.5 12.75 14.75 12.75 15.25C12.75 15.75 12.5 16 12 16Z" fill="white"/>
                </svg>
                <span className="font-sans font-bold text-lg text-[#0F172A]">AegisOne Quick Configurator</span>
              </div>
              <button 
                onClick={() => setShowSetupModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {setupStep === 1 ? (
                /* Step 1: Input Form */
                <form onSubmit={handleSetupSubmit} className="space-y-4" id="setup-step1-form">
                  <p className="font-sans text-xs text-[#45464D] leading-relaxed">
                    Configure your private link protection system. Once you fill this form, we will generate setup steps tailored to your selected hosting environment.
                  </p>

                  {/* Company Name */}
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-semibold text-slate-700">Company Name</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Acme Ltd or Local SME"
                      className="font-sans text-sm w-full bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] placeholder-slate-400 outline-hidden transition-colors"
                    />
                  </div>

                  {/* Work Email */}
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-semibold text-slate-700">Work Email</label>
                    <input
                      type="email"
                      required
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="font-sans text-sm w-full bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] placeholder-slate-400 outline-hidden transition-colors"
                    />
                  </div>

                  {/* Regional Config & Cloud */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-sans text-xs font-semibold text-slate-700">Hosting Area</label>
                      <select
                        value={nodeRegion}
                        onChange={(e) => setNodeRegion(e.target.value)}
                        className="font-sans text-sm w-full bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] outline-hidden cursor-pointer"
                      >
                        <option>Pakistan Edge</option>
                        <option>Asia South</option>
                        <option>Global Free-Tier</option>
                        <option>On-Premises Office</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-sans text-xs font-semibold text-slate-700">Office Server</label>
                      <select
                        value={deploymentCloud}
                        onChange={(e) => setDeploymentCloud(e.target.value)}
                        className="font-sans text-sm w-full bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] outline-hidden cursor-pointer"
                      >
                        <option>Local Office PC</option>
                        <option>Docker / Bare Metal</option>
                        <option>AWS Private Cloud</option>
                        <option>Google Cloud VPC</option>
                      </select>
                    </div>
                  </div>

                  {/* Submit buttons */}
                  <button
                    type="submit"
                    className="font-sans w-full text-center text-sm font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white py-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors mt-6"
                  >
                    Generate Setup Blueprint
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                /* Step 2: Dynamic Result based on Local vs Cloud Choice */
                <div className="space-y-4" id="setup-step2-success">
                  {isCloudDeployment ? (
                    /* Cloud VPC Deployment Consultation Flow (Requires Discussion) */
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5 text-blue-700 bg-blue-50 border border-blue-100 p-3.5 rounded-xl">
                        <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0" />
                        <span className="font-sans text-sm font-bold">Cloud VPC Integration Triggered</span>
                      </div>

                      <p className="font-sans text-sm text-[#45464D] leading-relaxed">
                        Excellent choice. Because <strong>{deploymentCloud}</strong> settings require isolated subnet routes and private DNS redirection, our network engineering team must assist you with deployment.
                      </p>

                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-700 font-semibold">
                          <Check className="w-4 h-4 text-emerald-600" />
                          Architecture Proposal Sent to: <span className="font-mono text-blue-600">{workEmail}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700 font-semibold">
                          <Check className="w-4 h-4 text-emerald-600" />
                          AegisOne Setup Desk Notified: <span className="font-mono text-[#0F172A]">araza2125012.pgc@gmail.com</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700 font-semibold">
                          <Check className="w-4 h-4 text-emerald-600" />
                          Deployment Area Assigned: <span className="font-semibold text-slate-800">{nodeRegion}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <h4 className="font-sans text-xs font-bold text-[#0F172A] mb-2 uppercase">Need immediate setup?</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <a 
                            href="https://wa.me/923001234567" 
                            target="_blank" 
                            referrerPolicy="no-referrer"
                            className="font-sans flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-lg transition-colors text-center"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Chat via WhatsApp
                          </a>
                          <a 
                            href={`mailto:araza2125012.pgc@gmail.com?subject=AegisOne Cloud VPC Setup Proposal for ${companyName}`}
                            className="font-sans flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-black text-white font-bold text-xs py-2.5 rounded-lg transition-colors text-center"
                          >
                            <Mail className="w-3.5 h-3.5" /> Direct Support Email
                          </a>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex justify-end">
                        <button
                          onClick={() => setShowSetupModal(false)}
                          className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-5 py-2.5 rounded-lg cursor-pointer transition-colors"
                        >
                          Finish Setup
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Local Docker / Local PC Flow (Immediate Self-Serve) */
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 p-3 rounded-lg">
                        <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
                        <span className="font-sans text-sm font-semibold">Local Node License Generated!</span>
                      </div>

                      <p className="font-sans text-xs text-[#45464D] leading-relaxed">
                        We have successfully dispatched configuration blueprints to both <strong className="text-[#0F172A]">{workEmail}</strong> and our monitoring desk at <strong className="text-[#0F172A]">araza2125012.pgc@gmail.com</strong>. Copy the local deployment command to boot:
                      </p>

                      {/* Copy code display */}
                      <div className="relative bg-slate-900 rounded-lg p-4 border border-slate-800 font-mono text-[11px] text-slate-200 leading-relaxed overflow-x-auto whitespace-pre">
                        {`# Run this command on your office server\ndocker run -d --name aegisone-perimeter \\\n  -e LICENSE_KEY="aegis_sme_${companyName.toLowerCase().replace(/\s+/g, '_')}_99x" \\\n  -e SERVER_PORT="3000" \\\n  -p 3000:3000 \\\n  aegisone/core:v2.4.0`}
                      </div>

                      {/* Copy blueprint button */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`docker run -d --name aegisone-perimeter -e LICENSE_KEY="aegis_sme_${companyName.toLowerCase().replace(/\s+/g, '_')}_99x" -p 3000:3000 aegisone/core:v2.4.0`);
                            showToast('Launch command copied to clipboard.');
                          }}
                          className="font-sans flex-1 text-center text-xs font-bold bg-slate-100 hover:bg-slate-200 text-[#0F172A] py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy Command
                        </button>
                        <button
                          onClick={() => {
                            setShowSetupModal(false);
                            setIsDashboardOpen(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            showToast('Live Threat Dashboard launched successfully!');
                          }}
                          className="font-sans flex-1 text-center text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          Open Live Dashboard
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 2. STATEFUL LIVE DEMO SCHEDULER MODAL */}
      {showDemoModal && (
        <div id="demo-modal-overlay" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="demo-modal" className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden animate-scaleIn text-left">
            
            {/* Modal Header */}
            <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#0A5ED6]" />
                <span className="font-sans font-bold text-lg text-[#0F172A]">Schedule a Live Interactive Demo</span>
              </div>
              <button 
                onClick={() => setShowDemoModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {demoStep === 1 ? (
                /* Step 1: Selection Form */
                <form onSubmit={handleDemoSubmit} className="space-y-4" id="demo-form">
                  <p className="font-sans text-xs text-[#45464D] leading-relaxed">
                    Pick a convenient date and slot below. We will demonstrate how AegisOne operates inside your local servers to block scammers without reading your private links.
                  </p>

                  {/* Name Input */}
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" /> Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={demoName}
                      onChange={(e) => setDemoName(e.target.value)}
                      placeholder="e.g. Haris Khan"
                      className="font-sans text-sm w-full bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] placeholder-slate-400 outline-hidden transition-colors"
                    />
                  </div>

                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" /> Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={demoEmail}
                      onChange={(e) => setDemoEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="font-sans text-sm w-full bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] placeholder-slate-400 outline-hidden transition-colors"
                    />
                  </div>

                  {/* Date Picker Input */}
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> Preferred Date
                    </label>
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => {
                        // Format the date back nicely for user display
                        setSelectedDate(e.target.value);
                      }}
                      className="font-sans text-sm w-full bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] outline-none transition-colors"
                    />
                  </div>

                  {/* Time Picker Slot */}
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Preferred Time Slot (Enter any time or timezone)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        placeholder="e.g. 02:30 PM PKT or 11:00 AM EST"
                        className="font-sans text-sm flex-1 bg-slate-50 border border-slate-200 focus:border-[#0A5ED6] focus:bg-white rounded-lg px-3.5 py-2.5 text-[#0F172A] placeholder-slate-400 outline-none transition-colors"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-500 font-sans">Quick slots:</span>
                      {['11:00 AM PKT', '02:00 PM PKT', '04:30 PM PKT', '09:00 AM EST'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSelectedTime(preset)}
                          className="font-sans text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="font-sans w-full text-center text-sm font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white py-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors mt-6"
                  >
                    Confirm Live Demo Booking
                    <Check className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                /* Step 2: Confirmation / Simulated Outbound Email logs */
                <div className="space-y-5" id="demo-success-view">
                  <div className="flex items-center gap-2.5 text-emerald-600 bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                    <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <h4 className="font-sans font-bold text-sm">Demo Successfully Scheduled!</h4>
                      <p className="font-sans text-xs text-emerald-700">Google Calendar invites dispatched.</p>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-slate-200 font-sans text-xs space-y-2.5">
                    <div className="border-b border-slate-800 pb-2 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                      Invitee Details
                    </div>
                    <div>
                      <span className="text-slate-400">Guest Name:</span> <strong className="text-white">{demoName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Date &amp; Time:</span> <strong className="text-white text-[#0A5ED6]">{selectedDate} at {selectedTime}</strong>
                    </div>
                    <div className="pt-2 border-t border-slate-800 space-y-1.5 font-mono text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Sent calendar invite to: <span className="text-blue-400">{demoEmail}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Dispatched briefing copy to: <span className="text-white">araza2125012.pgc@gmail.com</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Meeting Location: Google Meet (Private Link enclosed in mail)
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h5 className="font-sans text-xs font-bold text-slate-700 uppercase">Alternative Instant Contact</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <a 
                        href="https://wa.me/923001234567" 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        className="font-sans flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-lg transition-colors text-center"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Chat via WhatsApp
                      </a>
                      <a 
                        href={`mailto:araza2125012.pgc@gmail.com?subject=Scheduled AegisOne Demo Support for ${demoName}`}
                        className="font-sans flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-black text-white font-bold text-xs py-2.5 rounded-lg transition-colors text-center"
                      >
                        <Mail className="w-3.5 h-3.5" /> Direct Support Email
                      </a>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex justify-end">
                    <button
                      onClick={() => setShowDemoModal(false)}
                      className="font-sans text-xs font-bold bg-[#0A5ED6] hover:bg-[#0B63E0] text-white px-5 py-2.5 rounded-lg cursor-pointer transition-colors"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 3. PRIVACY POLICY MODAL */}
      {showPrivacyModal && (
        <div id="privacy-modal-overlay" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="privacy-modal" className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden animate-scaleIn text-left">
            {/* Modal Header */}
            <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#0A5ED6]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-sans font-bold text-lg text-[#0F172A]">AegisOne Privacy Commitment</span>
              </div>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
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

              <p className="italic text-slate-500 pt-2 border-t border-slate-100">
                For questions regarding security architecture, custom air-gapped systems, or isolated office networks, please write directly to our desk at araza2125012.pgc@gmail.com
              </p>
            </div>

            {/* Modal Footer */}
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

      {/* 4. TERMS OF SERVICE MODAL */}
      {showTermsModal && (
        <div id="terms-modal-overlay" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="terms-modal" className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden animate-scaleIn text-left">
            {/* Modal Header */}
            <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#0A5ED6]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-sans font-bold text-lg text-[#0F172A]">AegisOne Software Terms of Use</span>
              </div>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
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

              <h4 className="font-bold text-[#0F172A] uppercase">4. Limitations</h4>
              <p>
                AegisOne checks links on a localized best-effort basis using premium localized rulesets with speed in mind. While we strive for near 100% scam block accuracy, network environments should combine AegisOne with active personnel training.
              </p>
            </div>

            {/* Modal Footer */}
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
