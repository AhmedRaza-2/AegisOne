"use client";
import { getGlobalStats, modelHealth, threatTrends, departmentStats, incidents, scanHistory, getUserById, users } from "@/lib/mock-data";
import { Shield, Users, AlertTriangle, Activity, BarChart3, TrendingUp, Cpu, Clock, Globe, Mail, FileText, Image, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useMemo } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export default function AdminDashboard() {
  const { user, theme } = useAuth();
  if (!user) return null;

  const isGlobalAdmin = user.role === "global_admin";

  // Pre-calculate filtered dataset based on organization if not Global Admin
  const orgUsers = useMemo(() => {
    if (isGlobalAdmin) return [];
    return users.filter(u => u.organization === user.organization);
  }, [user.organization, isGlobalAdmin]);

  const orgUserIds = useMemo(() => {
    return orgUsers.map(u => u.id);
  }, [orgUsers]);

  // Dynamic Statistics
  const dashboardStats = useMemo(() => {
    if (isGlobalAdmin) {
      return getGlobalStats();
    } else {
      // Organization Admin Stats
      const companyUsers = users.filter(u => u.organization === user.organization);
      const companyScans = scanHistory.filter(s => companyUsers.some(u => u.id === s.userId));
      const companyThreats = companyScans.filter(s => s.prediction !== "legitimate");
      const companyIncidents = incidents.filter(i => companyUsers.some(u => u.id === i.reportedBy));

      return {
        totalScans: companyScans.length * 12 + 142,
        threatsBlocked: companyThreats.length * 3 + 12,
        activeUsers: companyUsers.filter(u => u.isActive).length,
        openIncidents: companyIncidents.filter(i => i.status === "open" || i.status === "investigating").length,
        modelsOnline: modelHealth.filter(m => m.status === "online").length,
        totalModels: modelHealth.length,
      };
    }
  }, [isGlobalAdmin, user.organization]);

  const activeThreats = useMemo(() => {
    if (isGlobalAdmin) {
      // For Platform Head: see all open incidents from all organizations
      return incidents.filter(i => i.status === "open" || i.status === "investigating");
    } else {
      // For Org Admin: see only their organization's incidents
      return incidents.filter(i => orgUserIds.includes(i.reportedBy) && (i.status === "open" || i.status === "investigating"));
    }
  }, [isGlobalAdmin, orgUserIds]);

  const platformThreats = useMemo(() => {
    if (isGlobalAdmin) {
      return scanHistory.filter(s => s.prediction !== "legitimate").slice(0, 5);
    } else {
      return scanHistory.filter(s => orgUserIds.includes(s.userId) && s.prediction !== "legitimate").slice(0, 5);
    }
  }, [isGlobalAdmin, orgUserIds]);

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipColor = isDark ? "#ffffff" : "#0f172a";

  const modelIcons: Record<string, typeof Mail> = { email: Mail, url: Globe, text: FileText, image: Image, attachment: Cpu };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            {isGlobalAdmin ? "Platform Operations Command" : "Organization Admin Center"}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {isGlobalAdmin 
              ? "Global multi-tenant system statistics and model health metrics" 
              : `Security policies, threat feeds, and users directory for ${user.organization === "org-1" ? "U Bank Limited" : "INARA Technologies"}`}
          </p>
        </div>
      </motion.div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Scans", value: dashboardStats.totalScans.toLocaleString(), icon: BarChart3, color: "text-brand-600 dark:text-brand-400" },
          { label: "Threats Blocked", value: dashboardStats.threatsBlocked.toString(), icon: Shield, color: "text-red-650 dark:text-red-400" },
          { label: "Active Users", value: dashboardStats.activeUsers.toString(), icon: Users, color: "text-emerald-650 dark:text-emerald-400" },
          { label: "Open Incidents", value: dashboardStats.openIncidents.toString(), icon: AlertTriangle, color: "text-amber-650 dark:text-amber-400" },
          { label: "AI Models", value: `${dashboardStats.modelsOnline}/${dashboardStats.totalModels}`, icon: Activity, color: "text-purple-600 dark:text-purple-400" },
        ].map((s, i) => (
          <motion.div key={s.label} variants={fadeUp} className="stat-card">
            <s.icon className={`w-5 h-5 ${s.color} mb-3`} />
            <div className="text-2xl font-bold text-surface-900 dark:text-white">{s.value}</div>
            <div className="text-xs text-surface-500 mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* AI Model Health */}
      <motion.div variants={fadeUp} className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white"><Activity className="w-4 h-4 text-brand-600 dark:text-brand-400" /> AI Inference Engine Nodes</h3>
          {!isGlobalAdmin && (
            <button onClick={() => window.location.href = "/dashboard/admin/models"} className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">Details →</button>
          )}
        </div>
        <div className="grid md:grid-cols-5 gap-3">
          {modelHealth.map(m => {
            const Icon = modelIcons[m.key] || Cpu;
            return (
              <div key={m.key} className="px-4 py-3 rounded-lg bg-surface-100/30 dark:bg-white/[0.02] border border-surface-200 dark:border-white/[0.04] hover:border-brand-500/20 dark:hover:border-white/[0.08] transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-surface-500 dark:text-surface-400" />
                  <span className="text-sm font-medium text-surface-800 dark:text-surface-200">{m.name}</span>
                  <span className={`ml-auto w-2 h-2 rounded-full ${m.status === "online" ? "bg-emerald-500 dark:bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><span className="text-surface-500">Accuracy</span><div className="font-semibold text-emerald-650 dark:text-emerald-400">{m.accuracy}%</div></div>
                  <div><span className="text-surface-500">Latency</span><div className="font-semibold text-brand-650 dark:text-brand-400">{m.avgLatency}ms</div></div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-5">
        <motion.div variants={fadeUp} className="lg:col-span-2 stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white"><TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Threat Trends (7 Days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={threatTrends}>
              <defs>
                <linearGradient id="aGradPhish" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                <linearGradient id="aGradSafe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }} labelStyle={{ color: tooltipColor }} />
              <Area type="monotone" dataKey="safe" stroke="#22c55e" fill="url(#aGradSafe)" strokeWidth={2} name="Safe Scans" />
              <Area type="monotone" dataKey="phishing" stroke="#ef4444" fill="url(#aGradPhish)" strokeWidth={2} name="Phishing" />
              <Area type="monotone" dataKey="malware" stroke="#f59e0b" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" name="Malware" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={fadeUp} className="stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
            {isGlobalAdmin ? <Building2 className="w-4 h-4 text-brand-650 dark:text-brand-400" /> : <BarChart3 className="w-4 h-4 text-brand-600 dark:text-brand-400" />} 
            {isGlobalAdmin ? "Tenant Activity Distribution" : "Department Risk Levels"}
          </h3>
          <div className="space-y-3">
            {isGlobalAdmin ? (
              // Global Tenant List
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-surface-700 dark:text-surface-300">U Bank Limited</span>
                    <span className="text-brand-650 dark:text-brand-400 font-semibold">65% load</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: "65%" }} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-surface-700 dark:text-surface-300">INARA Technologies</span>
                    <span className="text-brand-650 dark:text-brand-400 font-semibold">25% load</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: "25%" }} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-surface-700 dark:text-surface-300">Apex Financial Corp</span>
                    <span className="text-brand-650 dark:text-brand-400 font-semibold">10% load</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: "10%" }} />
                  </div>
                </div>
              </>
            ) : (
              // Local Org Department Risk
              departmentStats.map(d => (
                <div key={d.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-surface-700 dark:text-surface-300">{d.name}</span>
                    <span className={d.riskScore > 40 ? "text-red-500 font-medium" : d.riskScore > 20 ? "text-amber-500" : "text-emerald-500"}>{d.riskScore}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-white/[0.04] overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${d.riskScore > 40 ? "bg-red-500" : d.riskScore > 20 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${d.riskScore}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Active Incidents + Recent Scans */}
      <div className="grid lg:grid-cols-2 gap-5">
        <motion.div variants={fadeUp} className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> 
              {isGlobalAdmin ? "Cross-Tenant Incidents Feed (Privacy Shielded)" : "Active Incidents Queue"}
            </h3>
            {!isGlobalAdmin && (
              <button onClick={() => window.location.href = "/dashboard/admin/incidents"} className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">View all →</button>
            )}
          </div>
          <div className="space-y-2">
            {activeThreats.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-6">No active incidents found.</p>
            ) : (
              activeThreats.slice(0, 4).map(inc => {
                const reporter = getUserById(inc.reportedBy);
                const tenantName = reporter?.organization === "org-1" ? "U Bank" : reporter?.organization === "org-2" ? "INARA" : "Apex Corp";
                return (
                  <div key={inc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-100/30 dark:bg-white/[0.02] hover:bg-surface-100/50 dark:hover:bg-white/[0.04] transition-colors">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${inc.severity === "critical" ? "bg-red-500 animate-pulse" : "bg-amber-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-800 dark:text-surface-200 truncate">
                        {isGlobalAdmin ? `Confidential Threat Event ID: ${inc.id.toUpperCase()}` : inc.title}
                      </p>
                      <p className="text-[10px] text-surface-500">
                        Tenant: {tenantName} · {isGlobalAdmin ? "User Masked" : `Reporter: ${reporter?.fullName || "System"}`} · {inc.severity} severity
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${inc.status === "open" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>{inc.status}</span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white">
              <Clock className="w-4 h-4 text-brand-650 dark:text-brand-400" /> Platform Threat Telemetry
            </h3>
          </div>
          <div className="space-y-2">
            {platformThreats.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-6">No threat events monitored.</p>
            ) : (
              platformThreats.map(s => {
                const reporter = getUserById(s.userId);
                const tenantName = reporter?.organization === "org-1" ? "U Bank" : reporter?.organization === "org-2" ? "INARA" : "Apex Corp";
                const maskedPreview = s.scanType === "url" 
                  ? s.inputPreview.replace(/(https?:\/\/)([^\/]+)(.*)/, "$1$2/***") 
                  : `${s.scanType.toUpperCase()} threat flag detected`;
                
                return (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-100/30 dark:bg-white/[0.02]">
                    <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-650 dark:text-red-400">{s.scanType}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-800 dark:text-surface-200 truncate">
                        {isGlobalAdmin ? `Masked ${s.scanType.toUpperCase()} Signal` : maskedPreview}
                      </p>
                      <p className="text-[10px] text-surface-500">
                        Domain: {tenantName} · {Math.round(s.phishingProbability * 100)}% Phish Index
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
