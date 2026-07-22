"use client";
import { useAuth } from "@/lib/auth-context";
import { Network, ArrowRightLeft, ShieldAlert, FileText, AlertTriangle, CheckCircle, Search, MessageSquare, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// Mock Data
const activeRequests = [
  { id: 1, from: "IT", to: "Security Team", subject: "Need help investigating phishing campaign", status: "In Progress", priority: "High", date: "2 hours ago" },
  { id: 2, from: "Finance", to: "IT", subject: "Multiple employees reporting fake invoices", status: "Pending", priority: "Critical", date: "4 hours ago" },
  { id: 3, from: "IT", to: "HR", subject: "Security onboarding for new hires", status: "Resolved", priority: "Normal", date: "1 day ago" },
];

export default function InterDepartmentPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("requests");
  
  if (!user) return null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Network className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Inter-Department Coordination
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Collaborate with other departments and escalate critical incidents.
          </p>
        </div>
        <button className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> New Request
        </button>
      </motion.div>

      <motion.div variants={fadeUp} className="flex gap-2 p-1 bg-surface-100 dark:bg-surface-900 rounded-lg w-fit">
        <button onClick={() => setActiveTab("requests")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "requests" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"}`}>
          <div className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Department Requests</div>
        </button>
        <button onClick={() => setActiveTab("escalations")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "escalations" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"}`}>
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Escalation Queue</div>
        </button>
        <button onClick={() => setActiveTab("notes")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "notes" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"}`}>
          <div className="flex items-center gap-2"><FileText className="w-4 h-4" /> Shared Notes</div>
        </button>
      </motion.div>

      <motion.div variants={fadeUp} className="stat-card">
        {activeTab === "requests" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Active Collaboration Requests</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input type="text" placeholder="Search requests..." className="pl-9 pr-4 py-1.5 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-brand-500" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-white/[0.06]">
                    <th className="px-4 py-3 font-medium text-surface-500">Request</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Direction</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Priority</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Status</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRequests.map(req => (
                    <tr key={req.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{req.subject}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-surface-600 dark:text-surface-400">
                          <span className="font-semibold">{req.from}</span> <ArrowRightLeft className="w-3 h-3 text-surface-400" /> <span>{req.to}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${req.priority === 'Critical' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : req.priority === 'High' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-400'}`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 ${req.status === 'Resolved' ? 'text-emerald-500' : req.status === 'In Progress' ? 'text-blue-500' : 'text-amber-500'}`}>
                          {req.status === 'Resolved' ? <CheckCircle className="w-4 h-4" /> : <Activity className="w-4 h-4" />} {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-500">{req.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "escalations" && (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-surface-300 dark:text-surface-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Escalation Queue</h3>
            <p className="text-surface-500 mt-2 max-w-sm mx-auto">No active escalations. When you escalate an incident to the Global Admin or Security Team, it will appear here.</p>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-surface-300 dark:text-surface-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Shared Notes</h3>
            <p className="text-surface-500 mt-2 max-w-sm mx-auto">Collaborative workspace for cross-department security policies and incident post-mortems.</p>
            <button className="mt-4 px-4 py-2 border border-surface-200 dark:border-white/[0.08] hover:bg-surface-100 dark:hover:bg-white/[0.04] text-sm font-medium rounded-lg transition-colors text-surface-700 dark:text-surface-300">
              Create Note
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
