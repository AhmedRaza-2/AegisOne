"use client";
import { auditLogs, getUserById } from "@/lib/mock-data";
import { ClipboardList, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";

const actionColors: Record<string, string> = {
  "user.role_changed": "bg-purple-500/10 text-purple-650 dark:text-purple-400",
  "policy.updated": "bg-brand-500/10 text-brand-650 dark:text-brand-400",
  "incident.resolved": "bg-emerald-500/10 text-emerald-650 dark:text-emerald-450",
  "user.deactivated": "bg-red-500/10 text-red-650 dark:text-red-400",
  "incident.assigned": "bg-amber-500/10 text-amber-650 dark:text-amber-400",
  "user.created": "bg-cyan-500/10 text-cyan-650 dark:text-cyan-400",
};

export default function AuditPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  if (!user) return null;

  const isGlobalAdmin = user.role === "global_admin";

  // Filter logs based on logged-in user's role and organization
  const roleFilteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (isGlobalAdmin) return true; // Global admin sees all system audits
      const actor = getUserById(log.userId);
      return actor && actor.organization === user.organization; // Org admin sees company audits
    });
  }, [user, isGlobalAdmin]);

  const filtered = useMemo(() => {
    if (!search) return roleFilteredLogs;
    const lowerSearch = search.toLowerCase();
    return roleFilteredLogs.filter(l => 
      l.action.toLowerCase().includes(lowerSearch) || 
      l.details.toLowerCase().includes(lowerSearch)
    );
  }, [roleFilteredLogs, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <ClipboardList className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Audit Logs
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {isGlobalAdmin 
              ? "Complete cross-tenant platform operation trail" 
              : "Company security and operational activity log"}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input 
            type="text" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Filter logs by action or details..." 
            className="pl-9 pr-4 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 transition-all w-full sm:w-[280px]" 
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] bg-surface-50/50 dark:bg-white/[0.01]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Authorized User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Action Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Activity Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-surface-500">
                    No activity logs found.
                  </td>
                </tr>
              ) : (
                filtered.map(log => {
                  const actor = getUserById(log.userId);
                  const tenantName = actor?.organization === "org-1" ? "U Bank" : actor?.organization === "org-2" ? "INARA" : "Apex Corp";
                  return (
                    <tr key={log.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5 text-xs text-surface-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-sm font-semibold text-surface-800 dark:text-surface-200">{actor?.fullName || "System Engine"}</div>
                        <div className="text-[10px] text-surface-500">{actor?.email} ({tenantName})</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-medium font-mono px-2 py-0.5 rounded ${actionColors[log.action] || "bg-surface-200 text-surface-700 dark:bg-surface-800 dark:text-surface-300"}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-surface-650 dark:text-surface-300 max-w-[400px] truncate" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
