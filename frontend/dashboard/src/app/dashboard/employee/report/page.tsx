"use client";
import { useState } from "react";
import { Flag, Send, AlertTriangle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { getApiBaseUrl } from "@/lib/api";

function authHeaders() {
  const t = typeof window !== "undefined"
    ? (localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token"))
    : null;
  return { Authorization: `Bearer ${t || ""}`, "Content-Type": "application/json" };
}

export default function ReportPage() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/reports`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          report_type: "phishing",
          target_type: url ? "url" : "text",
          target_ref: url || title,
          risk_score: severity === "critical" ? 90 : severity === "high" ? 70 : severity === "medium" ? 45 : 20,
          user_notes: `${title}\n\n${description}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to submit report.");
      }
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      setTitle(""); setUrl(""); setDescription(""); setSeverity("medium");
    } catch (err: any) {
      setError(err.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Flag className="w-6 h-6 text-amber-400" /> Report a Threat</h1>
        <p className="text-sm text-surface-400 mt-1">Report suspicious content for investigation by your security team</p>
      </div>

      {submitted && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle className="w-5 h-5" /> Report submitted successfully. Your security team will investigate.
        </motion.div>
      )}

      {error && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-5 h-5" /> {error}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Incident Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} placeholder="e.g., Suspicious PayPal login email" className="w-full px-4 py-2.5 bg-surface-900 border border-white/[0.08] rounded-lg text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-all" />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Suspicious URL (optional)</label>
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} maxLength={500} placeholder="https://suspicious-site.com" className="w-full px-4 py-2.5 bg-surface-900 border border-white/[0.08] rounded-lg text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-all" />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Severity</label>
          <div className="flex gap-2">
            {["low", "medium", "high", "critical"].map(s => (
              <button key={s} type="button" onClick={() => setSeverity(s)} className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all capitalize ${severity === s ? (s === "critical" ? "border-red-500/40 bg-red-500/10 text-red-400" : s === "high" ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : s === "medium" ? "border-blue-500/40 bg-blue-500/10 text-blue-400" : "border-surface-600 bg-surface-800 text-surface-300") : "border-white/[0.06] text-surface-500 hover:text-surface-300"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={4} maxLength={9000} placeholder="Describe what happened, how you encountered it, and any relevant details..." className="w-full px-4 py-2.5 bg-surface-900 border border-white/[0.08] rounded-lg text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-all resize-none" />
        </div>
        <button type="submit" disabled={submitting} className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
          <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}
