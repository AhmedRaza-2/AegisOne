"use client";
import { useState } from "react";
import { Globe, Mail, FileText, Image, Upload, Loader2, ShieldCheck, ShieldAlert, ChevronDown, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ScanMode = "url" | "email" | "text" | "image";

interface ScanResult {
  prediction: string;
  confidence: number;
  phishingProbability: number;
  riskLevel: string;
  xaiExplanation: string;
  xaiWords: string[];
  category?: string;
  latencyMs: number;
}

// Mock scan function — replace with actual FastAPI call later
async function mockScan(mode: ScanMode, input: Record<string, string>): Promise<ScanResult> {
  await new Promise(r => setTimeout(r, 800 + Math.random() * 700));

  const suspicious = ["paypal", "verify", "login", "urgent", "suspend", "prize", "winner", "bitcoin", "password", "expire", "click here", "congratulations", "free", ".tk", ".xyz", "faceb00k"];
  const inputStr = Object.values(input).join(" ").toLowerCase();
  const isPhish = suspicious.some(s => inputStr.includes(s));

  if (isPhish) {
    const conf = 0.82 + Math.random() * 0.16;
    const words = suspicious.filter(s => inputStr.includes(s)).slice(0, 3);
    return {
      prediction: mode === "url" ? "malicious" : "phishing",
      confidence: parseFloat(conf.toFixed(4)),
      phishingProbability: parseFloat(conf.toFixed(4)),
      riskLevel: "danger",
      xaiExplanation: `AI flagged suspicious keywords: ${words.join(", ")}`,
      xaiWords: words,
      category: mode === "url" ? "phishing" : undefined,
      latencyMs: Math.round(20 + Math.random() * 60),
    };
  }

  return {
    prediction: "legitimate",
    confidence: 0.95 + Math.random() * 0.04,
    phishingProbability: parseFloat((0.01 + Math.random() * 0.08).toFixed(4)),
    riskLevel: "safe",
    xaiExplanation: "AI verified content appears safe — no suspicious patterns detected",
    xaiWords: [],
    category: mode === "url" ? "benign" : undefined,
    latencyMs: Math.round(15 + Math.random() * 40),
  };
}

export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode>("url");
  const [url, setUrl] = useState("");
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const modes: { key: ScanMode; label: string; icon: typeof Globe }[] = [
    { key: "url", label: "URL", icon: Globe },
    { key: "email", label: "Email", icon: Mail },
    { key: "text", label: "Text", icon: FileText },
    { key: "image", label: "Image", icon: Image },
  ];

  const handleScan = async () => {
    setLoading(true);
    setResult(null);
    let input: Record<string, string> = {};
    if (mode === "url") input = { url };
    else if (mode === "email") input = { sender, subject, body };
    else if (mode === "text") input = { text };
    else input = { text: "image_upload" };

    const res = await mockScan(mode, input);
    setResult(res);
    setLoading(false);
  };

  const canScan = mode === "url" ? url.trim() : mode === "email" ? (subject.trim() || body.trim()) : mode === "text" ? text.trim() : true;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">AI Scan</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Analyze URLs, emails, text, or images for phishing threats</p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 p-1 bg-surface-100 dark:bg-white/[0.03] rounded-lg border border-surface-200 dark:border-white/[0.06]">
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setResult(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
              mode === m.key ? "bg-brand-600/10 text-brand-600 dark:text-brand-400 border border-brand-500/20" : "text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white border border-transparent"
            }`}
          >
            <m.icon className="w-4 h-4" />
            {m.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="glass-card p-6 space-y-4">
        {mode === "url" && (
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">URL to scan</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/suspicious-link" className="w-full px-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-all" />
          </div>
        )}
        {mode === "email" && (
          <>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Sender</label>
              <input type="text" value={sender} onChange={e => setSender(e.target.value)} placeholder="sender@example.com" className="w-full px-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject line" className="w-full px-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Paste email body content here..." className="w-full px-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-all resize-none" />
            </div>
          </>
        )}
        {mode === "text" && (
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Text / SMS content</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Paste suspicious text, SMS, or web content here..." className="w-full px-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-all resize-none" />
          </div>
        )}
        {mode === "image" && (
          <div className="border-2 border-dashed border-surface-200 dark:border-white/[0.08] rounded-lg p-8 text-center hover:border-brand-500/20 dark:hover:border-white/[0.15] bg-surface-100/20 dark:bg-transparent transition-colors cursor-pointer">
            <Upload className="w-8 h-8 text-surface-500 mx-auto mb-3" />
            <p className="text-sm text-surface-600 dark:text-surface-400">Drop a screenshot or click to upload</p>
            <p className="text-xs text-surface-400 dark:text-surface-600 mt-1">PNG, JPG up to 10MB</p>
          </div>
        )}

        <button
          onClick={handleScan}
          disabled={!canScan || loading}
          className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Brain className="w-4 h-4" /> Analyze with AI</>}
        </button>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`glass-card p-6 border-l-4 ${result.riskLevel === "safe" ? "border-l-emerald-500" : result.riskLevel === "suspicious" ? "border-l-amber-500" : "border-l-red-500"}`}>
            <div className="flex items-start gap-4">
              {result.riskLevel === "safe" ? (
                <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-10 h-10 text-red-600 dark:text-red-400 shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-lg font-bold ${result.riskLevel === "safe" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {result.prediction === "legitimate" ? "Safe" : result.prediction.charAt(0).toUpperCase() + result.prediction.slice(1)}
                  </span>
                  <span className="text-sm text-surface-500 dark:text-surface-400">
                    {Math.round(result.phishingProbability * 100)}% risk
                  </span>
                </div>
                <p className="text-sm text-surface-700 dark:text-surface-300">{result.xaiExplanation}</p>
                {result.xaiWords.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {result.xaiWords.map(w => (
                      <span key={w} className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-mono">{w}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-4 text-xs text-surface-500">
                  <span>Confidence: {(result.confidence * 100).toFixed(1)}%</span>
                  <span>Latency: {result.latencyMs}ms</span>
                  {result.category && <span>Category: {result.category}</span>}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
