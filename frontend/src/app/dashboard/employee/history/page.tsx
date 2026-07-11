"use client";
import { useAuth } from "@/lib/auth-context";
import { scanHistory } from "@/lib/mock-data";
import { History, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useState, useMemo } from "react";

function RiskBadge({ level }: { level: string }) {
  if (level === "safe") return <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-650 dark:text-emerald-400"><CheckCircle className="w-3 h-3" />Safe</span>;
  if (level === "suspicious") return <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-650 dark:text-amber-400"><AlertTriangle className="w-3 h-3" />Suspicious</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-650 dark:text-red-400"><XCircle className="w-3 h-3" />Danger</span>;
}

// Parse UTC string correctly to local date
function parseLocalDate(dateStr: string) {
  if (!dateStr) return new Date();
  if (!dateStr.endsWith("Z") && !dateStr.includes("+")) {
    dateStr += "Z";
  }
  return new Date(dateStr);
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  const [dbScans, setDbScans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:9000/user/stats?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(data => {
          setDbScans(data.scans || []);
          setIsLoading(false);
        })
        .catch(err => {
          console.error(err);
          setIsLoading(false);
        });
    }
  }, [user]);

  if (!user) return null;

  const filtered = useMemo(() => {
    return filter === "all" 
      ? dbScans 
      : filter === "threats" 
      ? dbScans.filter(s => s.riskLevel !== "safe") 
      : dbScans.filter(s => s.scanType === filter);
  }, [dbScans, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <History className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Scan History
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{dbScans.length} total scans recorded</p>
        </div>
        <div className="flex flex-wrap gap-1.5 bg-surface-100 dark:bg-white/[0.02] p-1 rounded-lg border border-surface-200 dark:border-white/[0.05]">
          {["all", "threats", "url", "email", "text"].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)} 
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                filter === f 
                  ? "bg-white dark:bg-surface-800 text-brand-650 dark:text-brand-400 shadow-sm border border-surface-200/50 dark:border-white/[0.08]" 
                  : "text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f === "threats" ? "Threats Only" : f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] bg-surface-50/50 dark:bg-white/[0.01]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Content Preview</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Verdict</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Risk Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Action Taken</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-100 text-surface-700 dark:bg-white/[0.05] dark:text-surface-300">
                      {s.scanType}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 max-w-[300px] min-w-[200px]">
                    <p className="text-surface-850 dark:text-surface-200 truncate font-medium" title={s.inputPreview}>{s.inputPreview}</p>
                    {s.threatType && <p className="text-[11px] text-surface-500 truncate mt-0.5">{s.threatType.replace(/_/g, " ")}</p>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold capitalize ${
                      s.riskLevel === "safe" ? "text-emerald-650 dark:text-emerald-450" : "text-red-650 dark:text-red-400"
                    }`}>
                      {s.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3.5"><RiskBadge level={s.riskLevel} /></td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                      s.decision === 'block' ? 'bg-red-500/10 text-red-500' : 
                      s.decision === 'warn' ? 'bg-amber-500/10 text-amber-500' : 
                      'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {s.decision ? s.decision.toUpperCase() : 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-surface-500 whitespace-nowrap">
                    {parseLocalDate(s.timestamp).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-surface-500">
                    No matching scan history logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
