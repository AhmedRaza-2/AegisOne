"use client";
import { Sparkles, Cloud, ShieldCheck, AlertTriangle, Activity, Image as ImageIcon, FileText, Link2 } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "@/lib/api";

export function IntelligentScanner() {
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'intelligent' | 'cloud'>('intelligent');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const extractUrls = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  const analyzeUrl = async (urlToScan: string) => {
    const formData = new FormData();
    formData.append("url", urlToScan);
    const res = await fetch(`${API_BASE}/analyze/url`, { method: "POST", body: formData });
    const data = await res.json();
    return { type: 'URL', input: urlToScan, data };
  };

  const analyzeText = async (textToScan: string) => {
    const formData = new FormData();
    formData.append("text", textToScan);
    const res = await fetch(`${API_BASE}/analyze/text`, { method: "POST", body: formData });
    const data = await res.json();
    return { type: 'Text', input: textToScan.substring(0, 30) + '...', data };
  };

  const analyzeFileOrImage = async (fileToScan: File) => {
    const formData = new FormData();
    formData.append("file", fileToScan);
    
    const isImage = fileToScan.type.startsWith('image/');
    const endpoint = isImage ? '/analyze/image' : '/analyze/document';
    
    const res = await fetch(`${API_BASE}${endpoint}`, { method: "POST", body: formData });
    const data = await res.json();
    return { type: isImage ? 'Image' : 'Document', input: fileToScan.name, data };
  };

  const handleScan = async () => {
    if (!input.trim() && !file) return;
    
    setLoading(true);
    setResults([]);
    
    try {
      const scanPromises: Promise<any>[] = [];
      
      if (file) {
        scanPromises.push(analyzeFileOrImage(file));
      }
      
      if (input.trim()) {
        const urls = extractUrls(input);
        const textWithoutUrls = input.replace(/(https?:\/\/[^\s]+)/g, '').trim();
        
        urls.forEach(url => scanPromises.push(analyzeUrl(url)));
        
        if (textWithoutUrls.length > 10) {
          scanPromises.push(analyzeText(textWithoutUrls));
        }
      }
      
      const newResults = await Promise.all(scanPromises);
      setResults(newResults);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 md:p-8 rounded-3xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] shadow-xl w-full">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#4F84F8]" /> Intelligent Scanner
          </h2>
          <p className="text-sm text-surface-500 mt-1">Paste text, URLs, or drop files. AegisOne will auto-detect and route them.</p>
        </div>
        
        <div className="flex items-center bg-surface-100 dark:bg-[#141A29] rounded-xl p-1 border border-surface-200 dark:border-white/[0.04]">
          <button
            onClick={() => setMode('intelligent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'intelligent' ? 'bg-[#4F84F8] text-white shadow-sm' : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200'}`}
          >
            <ShieldCheck className="w-4 h-4" /> Local AI
          </button>
          <button
            onClick={() => setMode('cloud')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'cloud' ? 'bg-[#4F84F8] text-white shadow-sm' : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200'}`}
          >
            <Cloud className="w-4 h-4" /> Cloud Deep Scan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 flex flex-col">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste suspicious text or URLs here..."
            className="w-full h-40 bg-surface-50 dark:bg-[#0B0F19] border border-surface-200 dark:border-white/[0.1] rounded-2xl p-4 text-sm focus:outline-none focus:border-[#4F84F8]/50 text-surface-900 dark:text-white resize-none"
          />
        </div>

        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-40 bg-surface-50 dark:bg-[#0B0F19] border-2 border-dashed border-surface-200 dark:border-white/[0.1] rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[#4F84F8]/50 hover:bg-[#4F84F8]/5 transition-all text-center p-4"
        >
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          {file ? (
            <>
              {file.type.startsWith('image/') ? <ImageIcon className="w-8 h-8 text-[#4F84F8] mb-2" /> : <FileText className="w-8 h-8 text-[#4F84F8] mb-2" />}
              <span className="text-sm font-bold text-surface-900 dark:text-white truncate max-w-[200px]">{file.name}</span>
              <span className="text-xs text-surface-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </>
          ) : (
            <>
              <Cloud className="w-8 h-8 text-surface-400 mb-2" />
              <span className="text-sm font-bold text-surface-700 dark:text-surface-300">Drag & Drop Image or Document</span>
              <span className="text-xs text-surface-500 mt-1">Or click to browse files</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={handleScan}
          disabled={loading || (!input.trim() && !file)}
          className="w-full py-4 bg-[#4F84F8] disabled:opacity-50 text-white rounded-2xl font-bold text-sm hover:bg-[#3D6CE5] transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-[#4F84F8]/20 disabled:shadow-none hover:shadow-[#4F84F8]/40"
        >
          {loading ? <Activity className="w-5 h-5 animate-spin" /> : 'Run Intelligent Scan'}
        </button>
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
            <h3 className="text-sm font-bold text-surface-500 uppercase tracking-wider mb-4 border-b border-surface-200 dark:border-white/[0.04] pb-2">Analysis Results</h3>
            {results.map((res, idx) => {
              const isPhishing = res.data.prediction === 'phishing' || (res.data.phishing_probability && res.data.phishing_probability > 0.5) || res.data.risk_score > 50 || res.data.verdict === 'danger';
              const prob = res.data.phishing_probability || (res.data.risk_score ? res.data.risk_score / 100 : 0);
              return (
                <div key={idx} className={`p-4 rounded-xl border backdrop-blur-sm flex items-center justify-between ${isPhishing ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPhishing ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {res.type === 'URL' ? <Link2 className="w-5 h-5" /> : res.type === 'Text' ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-xs text-surface-500 font-bold mb-0.5">{res.type} Scan</div>
                      <div className="text-sm font-medium text-surface-900 dark:text-white max-w-sm truncate">{res.input}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold flex items-center justify-end gap-1.5 ${isPhishing ? 'text-red-500' : 'text-emerald-500'}`}>
                      {isPhishing ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      {isPhishing ? 'Malicious' : 'Safe'}
                    </div>
                    <div className="text-xs text-surface-500 mt-1">Risk Score: <span className="font-bold">{Math.round(prob * 100)}%</span></div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
