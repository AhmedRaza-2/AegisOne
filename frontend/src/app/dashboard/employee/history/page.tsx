"use client";
import { useAuth } from "@/lib/auth-context";
import { scanHistory } from "@/lib/mock-data";
import { History, CheckCircle, AlertTriangle, XCircle, Filter } from "lucide-react";
import { useState } from "react";

function RiskBadge({ level }: { level: string }) {
  if (level === "safe") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400"><CheckCircle className="w-3 h-3" />Safe</span>;
  if (level === "suspicious") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400"><AlertTriangle className="w-3 h-3" />Suspicious</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400"><XCircle className="w-3 h-3" />Danger</span>;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  if (!user) return null;

  const myScans = scanHistory.filter(s => s.userId === user.id);
  const filtered = filter === "all" ? myScans : filter === "threats" ? myScans.filter(s => s.prediction !== "legitimate") : myScans.filter(s => s.scanType === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><History className="w-6 h-6 text-brand-400" /> Scan History</h1>
          <p className="text-sm text-surface-400 mt-1">{myScans.length} total scans recorded</p>
        </div>
        <div className="flex gap-2">
          {["all", "threats", "url", "email", "text"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filter === f ? "bg-brand-600/10 text-brand-600 dark:text-brand-400 border border-brand-500/20" : "text-surface-500 hover:text-surface-900 border border-transparent hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-white/[0.04]"}`}>
              {f === "all" ? "All" : f === "threats" ? "Threats Only" : f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 dark:border-white/[0.06]">
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Content</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Verdict</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Risk</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Source</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3"><span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-surface-100 text-surface-700 dark:bg-white/[0.05] dark:text-surface-300">{s.scanType}</span></td>
                <td className="px-4 py-3 max-w-[300px]">
                  <p className="text-surface-800 dark:text-surface-200 truncate">{s.inputPreview}</p>
                  {s.xaiExplanation && <p className="text-xs text-surface-500 truncate mt-0.5">{s.xaiExplanation}</p>}
                </td>
                <td className="px-4 py-3"><span className={`text-xs font-medium ${s.prediction === "legitimate" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{s.prediction}</span></td>
                <td className="px-4 py-3"><RiskBadge level={s.riskLevel} /></td>
                <td className="px-4 py-3"><span className="text-xs text-surface-500 dark:text-surface-400">{s.source}</span></td>
                <td className="px-4 py-3"><span className="text-xs text-surface-500 whitespace-nowrap">{new Date(s.scannedAt).toLocaleDateString()}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-surface-500">No scans found for this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
