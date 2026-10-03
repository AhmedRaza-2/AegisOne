"use client";
import { useAuth } from "@/lib/auth-context";
import { ShieldAlert, Activity, Users, MessageSquare, AlertTriangle, BookOpen, ShieldCheck, Download, Key, Shield, Info, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// Helper to map backend event models to UI styles and icons
const getEventMetadata = (event: any) => {
  const type = event.event_type || "";
  const decision = event.decision || "";
  const severity = event.severity || "";
  const threatType = event.threat_type || "";
  const domain = event.domain || "";

  if (decision === "block" || severity === "high" || type === "website_threat" || type === "download_blocked") {
    return {
      icon: ShieldAlert,
      color: "text-red-500",
      action: `Blocked threat: ${threatType || "Malicious Page"} on ${domain || "website"}`
    };
  }
  if (type === "credential_warning" || type === "credential_intercept") {
    return {
      icon: Key,
      color: "text-amber-500",
      action: `Credential warning triggered on ${domain || "website"}`
    };
  }
  if (decision === "warn") {
    return {
      icon: AlertTriangle,
      color: "text-amber-500",
      action: `Warned user: ${threatType || "Suspicious Activity"} on ${domain || "website"}`
    };
  }
  return {
    icon: ShieldCheck,
    color: "text-emerald-500",
    action: `Safe scan completed on ${domain || "website"}`
  };
};

const formatEventTime = (timestampStr: string) => {
  try {
    const cleanStr = timestampStr.includes(".") ? timestampStr.split(".")[0] : timestampStr;
    const eventTime = new Date(cleanStr.replace(" ", "T"));
    const diffMs = Date.now() - eventTime.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return eventTime.toLocaleDateString();
  } catch (e) {
    return "Just now";
  }
};

export default function ThreatCenterPage() {
  const { user } = useAuth();
  const [escalatingEmployee, setEscalatingEmployee] = useState<any>(null);
  const [escalationReason, setEscalationReason] = useState("");
  const [highRisk, setHighRisk] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [priority, setPriority] = useState("High");
  const [submitting, setSubmitting] = useState(false);
  const [trainingModule, setTrainingModule] = useState("phishing");

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};

    const loadData = () => {
      // High-risk employees, each with the concrete events that put them on the list
      fetch(`${getApiBaseUrl()}/manager/incidents/high-risk-employees`, { headers })
        .then(res => res.ok ? res.json() : { employees: [] })
        .then(data => setHighRisk(data.employees || []))
        .catch(err => console.error("High-risk load error:", err));

      // Fetch Live Events
      fetch(`${getApiBaseUrl()}/admin/events?page=1&page_size=100`, { headers })
        .then(res => res.json())
        .then(data => {
          if (data.events) {
            // Filter events that match the supervisor's department name
            const deptFiltered = data.events.filter((evt: any) => 
              evt.department?.toLowerCase() === user.department?.toLowerCase()
            );
            setEvents(deptFiltered.slice(0, 20));
          }
        })
        .catch(err => console.error("Events load error:", err));
    };

    // Load immediately
    loadData();

    // Poll every 5 seconds for real-time threat center updates
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const router = require("next/navigation").useRouter();
  const [assigningTraining, setAssigningTraining] = useState<any>(null);

  const highRiskEmployees = highRisk.map(emp => ({
    id: emp.id,
    name: emp.name,
    riskScore: emp.top_risk,
    flagged: emp.flagged_count,
    blocked: emp.blocked_count,
    events: emp.events || [],
    reason: emp.events?.[0]?.finding
      ? `${emp.flagged_count} flagged event(s). Most recent: ${emp.events[0].finding}.`
      : `${emp.flagged_count} flagged event(s).`,
  }));

  if (!user) return null;

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const handleEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalatingEmployee) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/manager/incidents/escalate-employee`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ employee_id: escalatingEmployee.id, priority, notes: escalationReason }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Escalation failed");
      const data = await res.json();
      toast(`Escalated ${escalatingEmployee.name} to the admin queue as ${data.incident_id} (${data.priority} priority).`);
      setEscalatingEmployee(null);
      setEscalationReason("");
    } catch (err: any) {
      toast(err.message || "Could not escalate. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const TRAINING: Record<string, { title: string; body: string }> = {
    phishing: { title: "Phishing Defense 101", body: "Please complete the Phishing Defense 101 refresher: how to spot look-alike links, fake login pages and urgent-payment scams." },
    passwords: { title: "Credential Security", body: "Please complete the Credential Security refresher: password hygiene, MFA, and what to do when a site asks you to log in unexpectedly." },
    data: { title: "Data Protection", body: "Please complete the Data Protection refresher: what company data can leave the organisation and how to share it safely." },
  };

  const handleTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningTraining) return;
    setSubmitting(true);
    try {
      const t = TRAINING[trainingModule];
      const res = await fetch(`${getApiBaseUrl()}/communication/send`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          receiver_id: assigningTraining.id, msg_type: "direct", priority: "High",
          title: `Training assigned: ${t.title}`, content: t.body,
        }),
      });
      if (!res.ok) throw new Error("Could not send the training assignment");
      toast(`"${t.title}" sent to ${assigningTraining.name}. They will see it in their inbox.`);
      setAssigningTraining(null);
    } catch (err: any) {
      toast(err.message || "Could not assign training.", "error");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <ShieldAlert className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Threat Center
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Department: {user.department} — Live security feeds and high-risk monitoring
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* Phase 4: Live Department Feed */}
        <motion.div variants={fadeUp} className="stat-card flex flex-col h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white">
              <Activity className="w-4 h-4 text-brand-500" /> Live Department Feed
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-surface-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {events.length === 0 ? (
              <div className="text-center text-xs text-surface-400 py-12">No recent security events in this department.</div>
            ) : (
              events.map((event) => {
                const meta = getEventMetadata(event);
                const IconComponent = meta.icon;
                return (
                  <div key={event.event_id || event.id} className="p-3 rounded-xl border border-surface-200 dark:border-white/[0.05] bg-surface-50/50 dark:bg-white/[0.01] flex gap-3 hover:bg-surface-50 dark:hover:bg-white/[0.03] transition-colors">
                    <div className={`p-2 rounded-lg bg-surface-100 dark:bg-white/[0.05] shrink-0 h-fit ${meta.color}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-surface-900 dark:text-white">{event.user_name || "System"}</p>
                        <span className="text-[10px] text-surface-400 shrink-0">{formatEventTime(event.timestamp)}</span>
                      </div>
                      <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">{meta.action}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Phase 5: High Risk Employees */}
        <motion.div variants={fadeUp} className="stat-card flex flex-col h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white">
              <Users className="w-4 h-4 text-red-500" /> High Risk Employees
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
            {highRiskEmployees.length === 0 ? (
              <div className="text-center text-xs text-surface-400 py-12">No high risk employees detected.</div>
            ) : (
              highRiskEmployees.map((emp) => (
                <div key={emp.id} className="p-4 rounded-xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-surface-900 dark:text-white">{emp.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Top risk {emp.riskScore}% • {emp.flagged} flagged • {emp.blocked} blocked
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Where the risk came from</p>
                    {emp.events.map((ev: any, i: number) => (
                      <div key={i} className="text-xs text-surface-700 dark:text-surface-300 rounded-lg bg-white/70 dark:bg-white/[0.03] border border-red-100 dark:border-red-900/30 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold uppercase text-[10px] text-red-600 dark:text-red-400">{ev.kind} • {ev.risk_score}%</span>
                          <span className="text-[10px] text-surface-400">{ev.when ? formatEventTime(ev.when) : ""}</span>
                        </div>
                        <div className="truncate text-surface-500" title={ev.target}>{ev.target}</div>
                        <div className="mt-0.5 first-letter:uppercase">{ev.finding}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => router.push('/dashboard/supervisor/analytics')} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 dark:border-white/[0.08] hover:bg-surface-100 dark:hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5 text-surface-700 dark:text-surface-300">
                      <Activity className="w-3.5 h-3.5" /> Analytics
                    </button>
                    <button onClick={() => router.push('/dashboard/supervisor/communication')} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 dark:border-white/[0.08] hover:bg-surface-100 dark:hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5 text-surface-700 dark:text-surface-300">
                      <MessageSquare className="w-3.5 h-3.5" /> Message
                    </button>
                    <button onClick={() => setEscalatingEmployee(emp)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Escalate
                    </button>
                    <button onClick={() => setAssigningTraining(emp)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-200 dark:border-brand-900/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-brand-600 dark:text-brand-400 transition-colors flex items-center justify-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> Training
                    </button>
                  </div>
                </div>
              )))}
          </div>
        </motion.div>

      </div>

      {/* Phase 8: Incident Escalation Modal */}
      <AnimatePresence>
        {escalatingEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEscalatingEmployee(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] w-full max-w-md rounded-xl shadow-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06] bg-red-50/50 dark:bg-red-500/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-red-900 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Escalate Incident
                  </h3>
                  <button onClick={() => setEscalatingEmployee(null)} className="text-surface-400 hover:text-surface-600"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-red-700/70 dark:text-red-400/70 mt-1">
                  Escalating {escalatingEmployee.name} to your organisation's admin team.
                </p>
              </div>
              <form onSubmit={handleEscalate} className="p-6 space-y-4">
                <div className="p-3 bg-surface-50 dark:bg-surface-950 rounded-lg border border-surface-200 dark:border-white/[0.05] text-sm text-surface-600 dark:text-surface-400">
                  <span className="block font-semibold text-surface-900 dark:text-white mb-1">Evidence attached to this escalation</span>
                  {escalatingEmployee.reason}
                  <span className="block text-[11px] mt-1 text-surface-500">The flagged events listed on the card are included automatically.</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Priority Level</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-red-500">
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Manager Notes</label>
                  <textarea required value={escalationReason} onChange={e => setEscalationReason(e.target.value)} rows={3} placeholder="Add context for the security team..." className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-red-500 resize-none" />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" onClick={() => setEscalatingEmployee(null)} className="px-4 py-2 text-xs font-medium text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" /> {submitting ? "Escalating..." : "Submit Escalation"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {assigningTraining && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAssigningTraining(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] w-full max-w-md rounded-xl shadow-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06] bg-brand-50/50 dark:bg-brand-500/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-brand-900 dark:text-brand-400 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" /> Assign Training
                  </h3>
                  <button onClick={() => setAssigningTraining(null)} className="text-surface-400 hover:text-surface-600"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-brand-700/70 dark:text-brand-400/70 mt-1">
                  Assigning mandatory security awareness training to {assigningTraining.name}.
                </p>
              </div>
              <form onSubmit={handleTraining} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Training Module</label>
                  <select value={trainingModule} onChange={e => setTrainingModule(e.target.value)} className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500">
                    <option value="phishing">Phishing Defense 101</option>
                    <option value="passwords">Credential Security</option>
                    <option value="data">Data Protection</option>
                  </select>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" onClick={() => setAssigningTraining(null)} className="px-4 py-2 text-xs font-medium text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" /> {submitting ? "Sending..." : "Assign"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

