"use client";
import { useAuth } from "@/lib/auth-context";
import { ShieldAlert, Activity, Users, MessageSquare, AlertTriangle, BookOpen, ShieldCheck, Download, Key, Shield, Info } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

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

// Mock High Risk Employees (Phase 5)
const highRiskEmployees = [
  { id: "e1", name: "Ahmed Raza", riskScore: 82, reason: "Multiple phishing attempts in the last 48 hours." },
  { id: "e2", name: "Ali Khan", riskScore: 79, reason: "Repeated visits to newly registered suspicious domains." },
  { id: "e3", name: "Fatima Noor", riskScore: 76, reason: "Frequent risky downloads and credential warnings." },
];

export default function ThreatCenterPage() {
  const { user } = useAuth();
  
  if (!user) return null;

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
                  <button onClick={() => alert("Escalate Incident to Admin")} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors flex items-center justify-center gap-1.5">
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
    </motion.div>
  );
}
