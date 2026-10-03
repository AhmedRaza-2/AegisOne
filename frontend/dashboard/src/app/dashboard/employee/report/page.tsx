"use client";
import { useState, useEffect } from "react";
import { Flag, Send, Link2, Paperclip, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { getApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/components/ui/toast";
import Link from "next/link";

function authHeaders() {
  const t = typeof window !== "undefined"
    ? (localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token"))
    : null;
  return { Authorization: `Bearer ${t || ""}`, "Content-Type": "application/json" };
}

const KINDS = [
  { id: "link", label: "Suspicious link or website", type: "url", reportType: "phishing" },
  { id: "message", label: "Suspicious email or message", type: "email", reportType: "phishing" },
  { id: "file", label: "Suspicious file or download", type: "file", reportType: "phishing" },
  { id: "missed", label: "AegisOne missed something", type: "url", reportType: "false_negative" },
];

const SEVERITIES = [
  { id: "low", label: "Low", score: 20, on: "border-surface-400 bg-surface-100 text-surface-700 dark:bg-white/[0.08] dark:text-surface-200" },
  { id: "medium", label: "Medium", score: 45, on: "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  { id: "high", label: "High", score: 70, on: "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { id: "critical", label: "Critical", score: 90, on: "border-red-500 bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
];

const field =
  "w-full px-3.5 py-2.5 bg-white dark:bg-[#0F1423] border border-surface-200 dark:border-white/[0.1] rounded-lg text-sm " +
  "text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 " +
  "focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all";

export default function ReportPage() {
  const { user } = useAuth();
  const [kind, setKind] = useState("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [attachId, setAttachId] = useState("");
  const [recent, setRecent] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    fetch(`${getApiBaseUrl()}/user/threats?email=${encodeURIComponent(user.email)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setRecent((d?.recent || []).slice(0, 10)))
      .catch(() => { });
  }, [user]);

  const attached = recent.find(r => r.id === attachId);
  const selectedKind = KINDS.find(k => k.id === kind)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const sev = SEVERITIES.find(s => s.id === severity)!;
    const target = attached?.target || url.trim() || title.trim();
    try {
      const res = await fetch(`${getApiBaseUrl()}/reports`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          report_type: selectedKind.reportType,
          target_type: attached ? (attached.kind === "page" ? "url" : attached.kind) : selectedKind.type,
          target_ref: target,
          scan_id: attached?.id || undefined,
          risk_score: attached ? Math.round(attached.riskScore) : sev.score,
          user_notes: `${title.trim()}\n\n${description.trim()}`,
          evidence: {
            reported_from: "dashboard_report_form",
            target_url: target,
            risk_score: attached ? Math.round(attached.riskScore) : sev.score,
            threat_type: attached?.category || selectedKind.label,
            findings: [
              ...(attached?.findings || []),
              `Reporter described it as: ${description.trim().slice(0, 240)}`,
            ],
            summary: `${selectedKind.label} — reported by the employee with ${sev.label.toLowerCase()} severity`,
            captured_at: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.detail === "string" ? body.detail : "Failed to submit report.");
      }
      toast("Report submitted. Your manager and security team can now review it with the evidence you attached.");
      setTitle(""); setUrl(""); setDescription(""); setSeverity("medium"); setAttachId("");
    } catch (err: any) {
      toast(err.message || "Failed to submit report. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <Flag className="w-6 h-6 text-amber-500" /> Report a Threat
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Tell your security team about something suspicious. Reports are reviewed with the evidence you attach.
        </p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="stat-card space-y-5"
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2">What are you reporting?</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {KINDS.map(k => (
              <button key={k.id} type="button" onClick={() => setKind(k.id)}
                className={`text-left px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-all ${kind === k.id
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  : "border-surface-200 dark:border-white/[0.08] text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-white/[0.03]"}`}>
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">Short title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} required maxLength={200}
            placeholder="e.g. Fake PayPal login email" className={field} />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
            Link or address <span className="font-normal normal-case text-surface-400">(optional)</span>
          </label>
          <div className="relative">
            <Link2 className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} maxLength={500}
              placeholder="https://suspicious-site.com" className={`${field} pl-9`} disabled={!!attached} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
            Attach a detection <span className="font-normal normal-case text-surface-400">(sends AegisOne&apos;s own findings as evidence)</span>
          </label>
          <div className="relative">
            <Paperclip className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select value={attachId} onChange={e => setAttachId(e.target.value)} className={`${field} pl-9`}>
              <option value="">None — I&apos;ll describe it myself</option>
              {recent.map(r => (
                <option key={r.id} value={r.id}>
                  {r.riskScore}% • {(r.target || "").slice(0, 60)}
                </option>
              ))}
            </select>
          </div>
          {attached && (
            <div className="mt-2 p-3 rounded-lg bg-surface-50 dark:bg-white/[0.03] border border-surface-200 dark:border-white/[0.06] text-xs text-surface-600 dark:text-surface-300 space-y-1">
              <div className="font-semibold text-surface-800 dark:text-white flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Evidence that will be attached</div>
              <div>{attached.source} • detected by {attached.model}</div>
              {(attached.findings || []).slice(0, 3).map((f: string, i: number) => <div key={i} className="first-letter:uppercase">• {f}</div>)}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2">How serious does it look?</label>
          <div className="grid grid-cols-4 gap-2">
            {SEVERITIES.map(s => (
              <button key={s.id} type="button" onClick={() => setSeverity(s.id)}
                className={`py-2 text-xs font-semibold rounded-lg border transition-all ${severity === s.id
                  ? s.on
                  : "border-surface-200 dark:border-white/[0.08] text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-white/[0.03]"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">What happened?</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={4} maxLength={9000}
            placeholder="Where did you see it, what did it ask you to do, and did you click or enter anything?"
            className={`${field} resize-none`} />
        </div>

        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
          <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit report"}
        </button>
        <p className="text-[11px] text-surface-400 text-center">
          Track the outcome any time in <Link href="/dashboard/employee/reports" className="text-brand-600 dark:text-brand-400 underline">My Reports</Link>.
        </p>
      </motion.form>
    </div>
  );
}
