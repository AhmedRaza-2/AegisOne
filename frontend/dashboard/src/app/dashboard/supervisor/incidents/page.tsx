"use client";
import { incidents, getUserById, getGlobalStats } from "@/lib/mock-data";
import { AlertTriangle, Clock, CheckCircle, XCircle, Search, ShieldAlert } from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";

export default function IncidentsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");

  if (!user) return null;

  const isGlobalAdmin = user.role === "global_admin";
  const isSuperAdmin = user.role === "super_admin";
  const isOfficeAdmin = user.role === "office_admin";

  // Filter based on roles and organizational borders
  const roleFilteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      const reporter = getUserById(inc.reportedBy);
      if (!reporter) return false;

      if (isGlobalAdmin) {
        return true; // Platform Head can view all telemetry signals
      }
      
      if (isSuperAdmin) {
        return reporter.organization === user.organization; // Org admin sees whole company
      }

      if (isOfficeAdmin) {
        return reporter.organization === user.organization && reporter.department === user.department; // Supervisor sees department
      }

      return false;
    });
  }, [user, isGlobalAdmin, isSuperAdmin, isOfficeAdmin]);

  const finalFiltered = useMemo(() => {
    return filter === "all" 
      ? roleFilteredIncidents 
      : roleFilteredIncidents.filter(i => i.status === filter);
  }, [roleFilteredIncidents, filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <AlertTriangle className="w-6 h-6 text-amber-500" /> Incidents Queue
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          {isGlobalAdmin 
            ? "Global cross-tenant threat incidents telemetry feeds" 
            : `Active reported security issues and resolution logs`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "open", "investigating", "resolved", "false_positive"].map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)} 
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
              filter === f 
                ? "bg-brand-600/10 text-brand-650 dark:text-brand-400 border border-brand-500/20" 
                : "text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white border border-transparent hover:bg-surface-100 dark:hover:bg-white/[0.04]"
            }`}
          >
            {f === "all" ? "All Incidents" : f.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {finalFiltered.length === 0 ? (
          <div className="glass-card p-8 text-center text-surface-500">
            No incidents found matching these parameters.
          </div>
        ) : (
          finalFiltered.map(inc => {
            const reporter = getUserById(inc.reportedBy);
            const assignee = inc.assignedTo ? getUserById(inc.assignedTo) : null;
            const tenantName = reporter?.organization === "org-1" ? "U Bank" : reporter?.organization === "org-2" ? "INARA" : "Apex Corp";

            // Shield employee name for Global Admin
            const reporterDisplayName = isGlobalAdmin 
              ? `Masked User Profile (${tenantName})` 
              : reporter?.fullName || "System Core";

            return (
              <div key={inc.id} className="glass-card p-5 hover:border-surface-300 dark:hover:border-white/[0.12] transition-all">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                    inc.severity === "critical" 
                      ? "bg-red-500 animate-pulse" 
                      : inc.severity === "high" 
                      ? "bg-amber-500" 
                      : inc.severity === "medium" 
                      ? "bg-blue-500" 
                      : "bg-surface-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                        {isGlobalAdmin ? `Anonymized Threat Pattern ID: ${inc.id.toUpperCase()}` : inc.title}
                      </h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                        inc.status === "open" 
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                          : inc.status === "investigating" 
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                          : inc.status === "resolved" 
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450" 
                          : "bg-surface-200 text-surface-600 dark:bg-surface-800 dark:text-surface-400"
                      }`}>{inc.status.replace("_", " ")}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                        inc.severity === "critical" 
                          ? "bg-red-500/10 text-red-650 dark:text-red-400" 
                          : inc.severity === "high" 
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                          : "bg-surface-250 text-surface-700 dark:bg-surface-800 dark:text-surface-400"
                      }`}>{inc.severity} priority</span>
                    </div>
                    <p className="text-sm text-surface-600 dark:text-surface-300">
                      {isGlobalAdmin ? "Content hidden due to enterprise privacy shield." : inc.description}
                    </p>
                    {inc.resolutionNotes && (
                      <p className="text-sm text-emerald-650 dark:text-emerald-400 font-medium mt-2 italic">
                        Resolution: {inc.resolutionNotes}
                      </p>
                    )}
                    <div className="mt-3.5 pt-3.5 border-t border-surface-150 dark:border-white/[0.04] flex flex-wrap gap-4 text-xs text-surface-500">
                      <span>Reported: <strong className="font-medium text-surface-700 dark:text-surface-300">{reporterDisplayName}</strong></span>
                      {assignee && (
                        <span>Assigned to: <strong className="font-medium text-surface-700 dark:text-surface-300">{assignee.fullName}</strong></span>
                      )}
                      <span>Time: {new Date(inc.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
