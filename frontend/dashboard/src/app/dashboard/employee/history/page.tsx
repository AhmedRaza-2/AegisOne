"use client";
import { useAuth } from "@/lib/auth-context";
import { scanHistory } from "@/lib/mock-data";
import { History, CheckCircle, AlertTriangle, XCircle, Download, Calendar } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

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
  const [defaultDates] = useState(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
  });

  const [startDate, setStartDate] = useState<string>(defaultDates.start);
  const [endDate, setEndDate] = useState<string>(defaultDates.end);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://100.104.105.20:8000/user/stats?email=${encodeURIComponent(user.email)}`)
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
    let result = dbScans;

    if (filter !== "all") {
      if (filter === "threats") result = result.filter(s => s.riskLevel !== "safe");
      else result = result.filter(s => s.scanType === filter || (filter === 'document' && s.scanType === 'attachment'));
    }

    if (startDate) {
      const start = new Date(startDate).getTime();
      result = result.filter(s => parseLocalDate(s.timestamp).getTime() >= start);
    }
    if (endDate) {
      // Add 24 hours to include the end date fully
      const end = new Date(endDate).getTime() + 86400000;
      result = result.filter(s => parseLocalDate(s.timestamp).getTime() <= end);
    }

    return result;
  }, [dbScans, filter, startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [filter, startDate, endDate, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, page, itemsPerPage]);

  const handleExport = () => {
    if (!filtered.length) return alert("No data to export");
    const headers = "ID,Type,Preview,Verdict,Risk Level,Action,Timestamp\n";
    const csv = filtered.map(s => {
      const preview = s.inputPreview ? s.inputPreview.replace(/[\n\r,]/g, ' ') : '';
      return `${s.id},${s.scanType},"${preview}",${s.riskLevel},${s.riskLevel},${s.decision},${s.timestamp}`;
    }).join("\n");
    const blob = new Blob([headers + csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegisone_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const isDateChanged = startDate !== defaultDates.start || endDate !== defaultDates.end;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <History className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Scan History
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{dbScans.length} total scans recorded</p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-4 rounded-xl">
        <div className="flex flex-wrap gap-1.5 bg-surface-100 dark:bg-white/[0.02] p-1 rounded-lg border border-surface-200 dark:border-white/[0.05]">
          {["all", "threats", "url", "document", "image", "email", "text"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${filter === f
                  ? "bg-white dark:bg-surface-800 text-[#4F84F8] shadow-sm border border-surface-200/50 dark:border-white/[0.08]"
                  : "text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white"
                }`}
            >
              {f === "all" ? "All" : f === "threats" ? "Threats Only" : f.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-surface-500 hidden sm:block" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-surface-50 dark:bg-[#0B0F19] border border-surface-200 dark:border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-surface-900 dark:text-white"
            />
            <span className="text-surface-500 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-surface-50 dark:bg-[#0B0F19] border border-surface-200 dark:border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-surface-900 dark:text-white"
            />
            {isDateChanged && (
              <button onClick={() => { setStartDate(defaultDates.start); setEndDate(defaultDates.end); }} className="text-xs text-red-500 hover:underline ml-2">Clear</button>
            )}
          </div>

          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#4F84F8] text-white hover:bg-[#3D6CE5] transition-colors whitespace-nowrap ml-auto sm:ml-0">
            <Download className="w-4 h-4" />
            Export Logs (CSV)
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-surface-200 dark:border-white/[0.04] overflow-hidden bg-white dark:bg-[#141A29]">
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
              {paginatedData.map(s => (
                <tr key={s.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-100 text-surface-700 dark:bg-white/[0.05] dark:text-surface-300">
                      {s.scanType}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 max-w-[300px] min-w-[200px]">
                    <p className="text-surface-850 dark:text-surface-200 truncate font-medium" title={s.inputPreview}>{s.inputPreview ? s.inputPreview.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim() : ''}</p>
                    {s.threatType && <p className="text-[11px] text-surface-500 truncate mt-0.5">{s.threatType.replace(/_/g, " ")}</p>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold capitalize ${s.riskLevel === "safe" ? "text-emerald-650 dark:text-emerald-450" : "text-red-650 dark:text-red-400"
                      }`}>
                      {s.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3.5"><RiskBadge level={s.riskLevel} /></td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md ${s.decision === 'block' ? 'bg-red-500/10 text-red-500' :
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
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-surface-500">
                    No matching scan history logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-surface-200 dark:border-white/[0.06] bg-surface-50/30 dark:bg-white/[0.01] gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-500">Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="bg-white dark:bg-[#0B0F19] border border-surface-200 dark:border-white/[0.1] rounded px-2 py-1 text-xs text-surface-900 dark:text-white outline-none"
            >
              <option value={10}>10</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs text-surface-500">
              Showing {filtered.length === 0 ? 0 : (page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filtered.length)} of {filtered.length} entries
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.1] text-surface-700 dark:text-surface-300 disabled:opacity-50 hover:bg-surface-50 dark:hover:bg-white/[0.05]"
              >
                Prev
              </button>
              <span className="text-xs font-semibold px-2 text-surface-700 dark:text-surface-300">
                {page} / {totalPages || 1}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.1] text-surface-700 dark:text-surface-300 disabled:opacity-50 hover:bg-surface-50 dark:hover:bg-white/[0.05]"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
