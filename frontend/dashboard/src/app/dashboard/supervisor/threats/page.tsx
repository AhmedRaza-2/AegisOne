"use client";
import { useAuth } from "@/lib/auth-context";
import { ShieldAlert, Activity, Users, MessageSquare, AlertTriangle, BookOpen, ShieldCheck, Download, Key, Shield, Info, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// Mock Live Feed Data (Phase 4)
const liveFeed = [
  { id: 1, user: "Ahmed Raza", action: "Blocked phishing website", time: "Just now", type: "phishing", icon: ShieldAlert, color: "text-red-500" },
  { id: 2, user: "Sara Ahmed", action: "Safe download scanned", time: "2m ago", type: "safe", icon: Download, color: "text-emerald-500" },
  { id: 3, user: "Ali Khan", action: "Credential Guard triggered", time: "5m ago", type: "credential", icon: Key, color: "text-amber-500" },
  { id: 4, user: "Usman Tariq", action: "Image scan completed", time: "12m ago", type: "image", icon: ShieldCheck, color: "text-blue-500" },
  { id: 5, user: "Fatima Noor", action: "Malware download blocked", time: "15m ago", type: "malware", icon: Shield, color: "text-red-500" },
];

export default function ThreatCenterPage() {
  const { user } = useAuth();
  const [escalatingEmployee, setEscalatingEmployee] = useState<any>(null);
  const [escalationReason, setEscalationReason] = useState("");
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  
  useEffect(() => {
    const token = localStorage.getItem("aegis_token");
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};

    fetch("http://localhost:8000/admin/users", { headers })
      .then(res => res.json())
      .then(data => {
        if (data.users) {
          setDbUsers(data.users);
        }
      })
      .catch(console.error);
  }, []);

  const highRiskEmployees = dbUsers.map(emp => {
    // Generate mock risk scores based on DB users
    const threats = (emp.id * 3) % 15;
    const totalScans = threats + 20;
    const riskScore = threats > 0 ? Math.round((threats / Math.max(totalScans, 1)) * 100) : (emp.id % 15);
    
    return {
      id: emp.id,
      name: emp.full_name || emp.fullName || "Unknown",
      riskScore: riskScore,
      reason: riskScore > 50 ? "Multiple suspicious activities flagged by AI." : "Recent credential warning.",
    };
  }).filter(emp => emp.riskScore > 30).sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);

  if (!user) return null;

  const handleEscalate = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Incident escalated to Global Admin!\n\nEmployee: ${escalatingEmployee.name}\nReason: ${escalationReason}`);
    setEscalatingEmployee(null);
    setEscalationReason("");
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
            {liveFeed.map((event) => (
              <div key={event.id} className="p-3 rounded-xl border border-surface-200 dark:border-white/[0.05] bg-surface-50/50 dark:bg-white/[0.01] flex gap-3 hover:bg-surface-50 dark:hover:bg-white/[0.03] transition-colors">
                <div className={`p-2 rounded-lg bg-surface-100 dark:bg-white/[0.05] shrink-0 h-fit ${event.color}`}>
                  <event.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">{event.user}</p>
                    <span className="text-[10px] text-surface-400 shrink-0">{event.time}</span>
                  </div>
                  <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">{event.action}</p>
                </div>
              </div>
            ))}
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
            {highRiskEmployees.map((emp) => (
              <div key={emp.id} className="p-4 rounded-xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-surface-900 dark:text-white">{emp.name}</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Risk Score: {emp.riskScore}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-surface-600 dark:text-surface-400 mb-4 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" />
                  <span>{emp.reason}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => alert("Navigate to Employee Analytics (Phase 3 implementation)")} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 dark:border-white/[0.08] hover:bg-surface-100 dark:hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5 text-surface-700 dark:text-surface-300">
                    <Activity className="w-3.5 h-3.5" /> Analytics
                  </button>
                  <button onClick={() => alert("Open Direct Message to Employee")} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 dark:border-white/[0.08] hover:bg-surface-100 dark:hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5 text-surface-700 dark:text-surface-300">
                    <MessageSquare className="w-3.5 h-3.5" /> Message
                  </button>
                  <button onClick={() => setEscalatingEmployee(emp)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Escalate
                  </button>
                  <button onClick={() => alert("Assign Awareness Training")} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-200 dark:border-brand-900/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-brand-600 dark:text-brand-400 transition-colors flex items-center justify-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Training
                  </button>
                </div>
              </div>
            ))}
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
                  Escalating high-risk behavior for {escalatingEmployee.name} to Global Admin.
                </p>
              </div>
              <form onSubmit={handleEscalate} className="p-6 space-y-4">
                <div className="p-3 bg-surface-50 dark:bg-surface-950 rounded-lg border border-surface-200 dark:border-white/[0.05] text-sm text-surface-600 dark:text-surface-400">
                  <span className="block font-semibold text-surface-900 dark:text-white mb-1">AI Threat Summary</span>
                  {escalatingEmployee.reason}
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Priority Level</label>
                  <select className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-red-500">
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
                  <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" /> Submit Escalation
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
