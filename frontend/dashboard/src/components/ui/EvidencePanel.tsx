"use client";
import { ShieldAlert, Cpu, Globe, Image as ImageIcon, FileText, Mail, Download, User } from "lucide-react";

const KIND_META: Record<string, { label: string; icon: any }> = {
  page: { label: "Web page or link", icon: Globe },
  image: { label: "Image (picture + text inside)", icon: ImageIcon },
  text: { label: "Text", icon: FileText },
  email: { label: "Email message", icon: Mail },
  download: { label: "Downloaded file", icon: Download },
  employee_escalation: { label: "Manager escalation", icon: User },
};

/**
 * Shows *why* something was flagged and *where the risk came from*: the source type,
 * the model that fired, and the plain-language findings captured when it was reported.
 * `evidence` is the snapshot stored on the incident / report / training sample.
 */
export function EvidencePanel({ evidence, compact = false }: { evidence?: any; compact?: boolean }) {
  if (!evidence || typeof evidence !== "object") {
    return (
      <div className="rounded-xl border border-dashed border-surface-300 dark:border-white/[0.1] p-3 text-xs text-surface-500">
        No evidence snapshot was captured for this item (it was reported before evidence capture was enabled).
      </div>
    );
  }
  const kind = evidence.scan_kind || "page";
  const meta = KIND_META[kind] || KIND_META.page;
  const findings: string[] = evidence.findings || [];
  const signals: string[] = evidence.signals || [];
  const reporter = evidence.reporter_view || {};
  const Icon = meta.icon;

  return (
    <div className="rounded-xl border border-surface-200 dark:border-white/[0.06] bg-surface-50 dark:bg-[#141A29] p-4 space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-white/[0.06] border border-surface-200 dark:border-white/[0.08] font-semibold text-surface-700 dark:text-surface-200">
          <Icon className="w-3.5 h-3.5" /> {meta.label}
        </span>
        {evidence.source_model && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-white/[0.06] border border-surface-200 dark:border-white/[0.08] text-surface-600 dark:text-surface-300">
            <Cpu className="w-3.5 h-3.5" /> {evidence.source_model}
          </span>
        )}
        {typeof evidence.risk_score === "number" && (
          <span className={`px-2 py-1 rounded-md font-bold ${evidence.risk_score >= 75 ? "bg-red-500/10 text-red-600 dark:text-red-400" : evidence.risk_score >= 50 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
            {evidence.risk_score}% risk
          </span>
        )}
        {evidence.decision && <span className="px-2 py-1 rounded-md bg-surface-200/70 dark:bg-white/[0.06] capitalize text-surface-600 dark:text-surface-300">{String(evidence.decision).toLowerCase()}</span>}
      </div>

      {evidence.target && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500 mb-1">Where it came from</p>
          <p className="font-mono break-all text-surface-800 dark:text-surface-300">{evidence.target}</p>
        </div>
      )}

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500 mb-1 flex items-center gap-1.5"><ShieldAlert className="w-3 h-3" /> Why it was flagged</p>
        {findings.length === 0 ? (
          <p className="text-surface-500">No specific findings were recorded.</p>
        ) : (
          <ul className="space-y-1.5 text-surface-700 dark:text-surface-200 leading-relaxed">
            {(compact ? findings.slice(0, 2) : findings).map((f, i) => <li key={i} className="first-letter:uppercase">• {f}</li>)}
          </ul>
        )}
      </div>

      {!compact && signals.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500 mb-1">Raw model signals</p>
          <ul className="space-y-0.5 font-mono text-[11px] text-surface-600 dark:text-surface-400">
            {signals.map((s, i) => <li key={i}>– {s}</li>)}
          </ul>
        </div>
      )}

      {!compact && (reporter.page_url || reporter.page_title) && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500 mb-1">Page the reporter was on</p>
          <p className="text-surface-600 dark:text-surface-300 break-all">{reporter.page_title ? `${reporter.page_title} — ` : ""}{reporter.page_url}</p>
        </div>
      )}
      {!compact && evidence.reported_from && (
        <p className="text-surface-400">Reported from: {String(evidence.reported_from).replace(/_/g, " ")}</p>
      )}
    </div>
  );
}
