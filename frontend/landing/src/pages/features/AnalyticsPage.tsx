import React from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { BarChart3, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AnalyticsPage() {
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
              <BarChart3 className="w-10 h-10 text-[#0A5ED6]" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-[#0F172A] mb-6">Centralized Analytics Dashboard</h1>
            
            <div className="space-y-6 text-slate-600 leading-relaxed text-lg">
              <p>
                Visibility is critical for effective cybersecurity. The AEGIS-ONE Centralized Analytics Dashboard is an all-inclusive SaaS interface designed for displaying and managing enterprise-wide threat metrics.
              </p>
              
              <h3 className="text-2xl font-bold text-slate-800 pt-4">Dashboard Features</h3>
              <ul className="list-disc pl-6 space-y-3">
                <li><strong>Incident Monitoring & Reporting:</strong> Generates detailed incident reports covering attack timelines, source analysis, redirect chains, and AI reasoning.</li>
                <li><strong>User Risk Analytics:</strong> Assess user risk levels to identify which employees might benefit from targeted security awareness training.</li>
                <li><strong>Threat Trends Visualization:</strong> Track the evolution of phishing campaigns targeting your organization over time.</li>
                <li><strong>Policy Management:</strong> Configure role-based access control and customize data collection policies to respect enterprise privacy requirements.</li>
                <li><strong>False Positive Management:</strong> Includes admin review mechanisms to validate detections, feeding valuable feedback into the model retraining pipeline to continuously improve system reliability.</li>
              </ul>
              
              <p className="pt-4">
                The dashboard serves as the central command center, transforming isolated interception events into actionable, enterprise-wide threat intelligence.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer onOpenPrivacy={() => {}} onOpenTerms={() => {}} />
    </div>
  );
}
