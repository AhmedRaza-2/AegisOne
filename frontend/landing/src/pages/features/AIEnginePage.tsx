import React from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { BrainCircuit, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AIEnginePage() {
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
              <BrainCircuit className="w-10 h-10 text-[#0A5ED6]" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-[#0F172A] mb-6">AI Risk Intelligence Engine</h1>
            
            <div className="space-y-6 text-slate-600 leading-relaxed text-lg">
              <p>
                The AI Risk Intelligence Engine is the core detection framework of AEGIS-ONE. It leverages advanced machine learning models and heuristic rules to identify phishing threats across multiple digital channels.
              </p>
              
              <h3 className="text-2xl font-bold text-slate-800 pt-4">Core Capabilities</h3>
              <ul className="list-disc pl-6 space-y-3">
                <li><strong>Machine learning-based phishing classification:</strong> Utilizes fine-tuned BERT/RoBERTa models to analyze email content and identify sophisticated threats.</li>
                <li><strong>Heuristic rule engine:</strong> Employs hard-coded rules to instantly block known bad patterns, providing a reliable first layer of defense against zero-day threats.</li>
                <li><strong>Domain reputation scoring:</strong> Analyzes domain age, registration details, and WHOIS data to determine the trustworthiness of links.</li>
                <li><strong>Real-time risk scoring:</strong> Produces a unified risk score on a 0–100 scale, combining insights from all detection modules to offer a clear threat assessment.</li>
              </ul>
              
              <p className="pt-4">
                By combining these techniques into an ensemble model, our engine provides adversarial robustness, making it significantly harder for attackers to bypass our security measures.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer onOpenPrivacy={() => {}} onOpenTerms={() => {}} />
    </div>
  );
}
