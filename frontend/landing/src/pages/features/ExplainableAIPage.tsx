import React from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { Eye, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ExplainableAIPage() {
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
              <Eye className="w-10 h-10 text-[#0A5ED6]" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-[#0F172A] mb-6">Explainable AI (XAI)</h1>
            
            <div className="space-y-6 text-slate-600 leading-relaxed text-lg">
              <p>
                Enterprise adoption of AI-based security tools is often hindered when detection decisions are opaque. AEGIS-ONE solves this through our integrated Explainable AI (XAI) module.
              </p>
              
              <h3 className="text-2xl font-bold text-slate-800 pt-4">Building Trust Through Transparency</h3>
              <p>
                Our XAI module provides a clear, human-readable logic behind every detection decision. When a threat is blocked, the system explains exactly *why* it was flagged.
              </p>

              <ul className="list-disc pl-6 space-y-3">
                <li><strong>Feature Attribution:</strong> Using validated techniques like SHAP and LIME, we highlight the exact elements that contributed to a risk score (e.g., suspicious domain age, visual impersonation similarity, obfuscated scripts).</li>
                <li><strong>Clear Explanations:</strong> Generates plain-text summaries of AI logic, ensuring that users aren't left confused by blocked pages.</li>
                <li><strong>Actionable Insights for Admins:</strong> Provides detailed threat reasoning in incident reports, allowing security administrators to audit decisions effectively and refine corporate policies.</li>
              </ul>
              
              <p className="pt-4">
                By demystifying the black box of artificial intelligence, AEGIS-ONE ensures that organizations can trust their security infrastructure implicitly.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer onOpenPrivacy={() => {}} onOpenTerms={() => {}} />
    </div>
  );
}
