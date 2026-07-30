"use client";
import { AlignLeft, Activity, ShieldCheck, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function TextScanner() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleScan = async () => {
    if (!text) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("text", text);
      const res = await fetch("http://100.104.105.20:8000/analyze/text", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 h-full rounded-2xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] flex flex-col items-center text-center transition-all duration-300 hover:shadow-xl hover:shadow-[#4F84F8]/5 hover:border-[#4F84F8]/20 group">
      <div className="w-12 h-12 rounded-xl bg-[#4F84F8]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        <AlignLeft className="w-6 h-6 text-[#4F84F8]" />
      </div>
      <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Scan Text or Email</h3>
      <p className="text-xs text-surface-500 mb-6 max-w-sm flex-grow">Paste suspicious email content or messages for linguistic analysis.</p>

      <div className="w-full mt-auto">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Dear customer, your account..."
          rows={1}
          className="w-full bg-surface-50 dark:bg-[#0B0F19] border border-surface-200 dark:border-white/[0.1] rounded-xl px-4 py-3 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F84F8]/50 focus:border-[#4F84F8]/50 text-surface-900 dark:text-white resize-none transition-all"
        />
        <button
          onClick={handleScan}
          disabled={loading || !text}
          className="w-full py-3 bg-[#4F84F8] disabled:opacity-50 text-white rounded-xl font-bold text-sm hover:bg-[#3D6CE5] transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-[#4F84F8]/20 disabled:shadow-none hover:shadow-[#4F84F8]/40">
          {loading ? <Activity className="w-4 h-4 animate-spin" /> : 'Analyze Text'}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full mt-4 text-left">
            <div className={`p-4 rounded-xl border backdrop-blur-sm ${result.prediction === 'phishing' || result.phishing_probability > 0.5 ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'}`}>
              <div className="flex items-center gap-3 mb-1">
                {result.prediction === 'phishing' || result.phishing_probability > 0.5 ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                <span className="text-sm font-bold tracking-tight">
                  {result.prediction === 'phishing' || result.phishing_probability > 0.5 ? 'Suspicious Text Detected' : 'Text appears safe'}
                </span>
              </div>
              <div className="text-xs text-surface-600 dark:text-surface-400 pl-7">
                Risk Score: <span className={`font-black ${result.prediction === 'phishing' || result.phishing_probability > 0.5 ? 'text-red-500' : 'text-emerald-500'}`}>{Math.round((result.phishing_probability || 0) * 100)}%</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
