import React from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { Activity, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RealTimeMonitoringPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Header onScrollTo={() => {}} />
      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6 space-y-8 animate-fadeIn">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 text-[#0A5ED6] hover:text-[#0B63E0] font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>
          
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-slate-200">
            <div className="bg-blue-50 w-20 h-20 rounded-2xl flex items-center justify-center mb-8">
              <Activity className="w-10 h-10 text-[#0A5ED6]" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-[#0F172A] mb-6">Real-Time Interception & Prevention</h1>
            
            <div className="space-y-6 text-slate-600 leading-relaxed text-lg">
              <p>
                The Active Prevention Module acts as an instant security barrier that evaluates digital actions in real-time. It ensures that threats are not just flagged, but completely neutralized before they can cause harm.
              </p>
              
              <h3 className="text-2xl font-bold text-slate-800 pt-4">Key Features</h3>
              <ul className="list-disc pl-6 space-y-3">
                <li><strong>Browser-Based Monitoring:</strong> Analyzes web content and user behavior directly within the browser, entirely on the client device.</li>
                <li><strong>Credential Interception:</strong> Actively prevents the submission of sensitive information (like passwords and login details) to fake authentication portals or malicious forms.</li>
                <li><strong>QR Code & Link Protection:</strong> Scans and blocks harmful URLs and QR codes immediately, neutralizing multi-channel attacks.</li>
                <li><strong>Privacy First:</strong> All content analysis is performed locally. The extension does not store browsing history or transmit raw page content—only anonymized risk scores are sent to the dashboard.</li>
              </ul>
              
              <p className="pt-4">
                By shifting security from reactive filtering to active prevention, AEGIS-ONE protects organizations exactly when they are most vulnerable—at the moment of user interaction.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer onOpenPrivacy={() => {}} onOpenTerms={() => {}} />
    </div>
  );
}
