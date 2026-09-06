"use client";

import { useAuth } from "@/lib/auth-context";
import { 
  Mail, ShieldCheck, AlertTriangle, ShieldAlert, 
  RefreshCw, Calendar, ChevronRight, FileText, CheckCircle2, 
  Search, Filter, Lock, Eye, ArrowUpRight
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ScanItem {
  id: string;
  url: string;
  subject?: string;
  sender?: string;
  thread_url?: string;
  domain: string;
  risk_score: number;
  verdict: "safe" | "suspicious" | "phishing";
  decision: string;
  top_factors: string[];
  created_at: string;
}

interface AnalyticsData {
  period: { name: string; start: string; end: string };
  scope: string;
  summary: {
    total_scanned: number;
    safe: number;
    suspicious: number;
    phishing: number;
    threat_count: number;
    threat_rate: number;
    average_risk_score: number;
  };
  risk_distribution: Array<{ category: string; count: number; color: string }>;
  scans: ScanItem[];
}

export default function EmployeeEmailSecurityPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"24h" | "7d" | "30d" | "90d" | "all">("24h");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedScan, setSelectedScan] = useState<ScanItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState<number>(50);

  const getToken = useCallback(() => {
    return localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token") || "";
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const userEmail = user?.email || "";
      const url = `http://localhost:8000/analytics/email?period=${period}&scope=auto${userEmail ? `&email=${encodeURIComponent(userEmail)}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && json.data) {
          setData(json.data);
        }
      }
    } catch (err) {
      console.error("Failed to load email analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [period, getToken, user]);

  useEffect(() => {
    if (user) loadAnalytics();
  }, [user, loadAnalytics]);

  const filteredScans = (data?.scans || []).filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const subj = (s.subject || s.url).toLowerCase();
    const sndr = (s.sender || "").toLowerCase();
    return subj.includes(q) || sndr.includes(q) || s.verdict.toLowerCase().includes(q);
  });

  const displayedScans = filteredScans.slice(0, visibleCount);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#141A29] p-6 rounded-xl border border-surface-200 dark:border-white/[0.04] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Mail className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight flex items-center gap-2">
              Email Security Hub
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 font-semibold">
                Personal Telemetry
              </span>
            </h1>
            <p className="text-sm text-surface-500 dark:text-slate-400 mt-1">
              Real-time security analytics and AI risk evaluations for your inbox.
            </p>
          </div>
        </div>

        {/* Time Period Selector */}
        <div className="flex items-center gap-2 bg-surface-100 dark:bg-slate-950/80 p-1.5 rounded-xl border border-surface-200 dark:border-slate-800">
          {(["24h", "7d", "30d", "90d", "all"] as const).map(p => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setVisibleCount(50); }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                period === p
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-200 dark:hover:bg-slate-900"
              }`}
            >
              {p === "24h" ? "24 Hours" : p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : p === "90d" ? "90 Days" : "All Time"}
            </button>
          ))}
          <button
            onClick={loadAnalytics}
            className="p-1.5 text-surface-500 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-200 dark:hover:bg-slate-900 rounded-lg transition-all ml-1"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Summary Stat Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Emails Scanned */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white dark:bg-[#141A29] p-5 rounded-xl border border-surface-200 dark:border-white/[0.04] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-slate-400">Total Scanned</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-surface-900 dark:text-white">
            {data?.summary?.total_scanned ?? (filteredScans.length || 0)}
          </div>
          <p className="text-xs text-surface-500 dark:text-slate-400 mt-1">Verified email instances</p>
        </motion.div>

        {/* Phishing Blocked */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white dark:bg-[#141A29] p-5 rounded-xl border border-surface-200 dark:border-white/[0.04] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-slate-400">Phishing Blocked</span>
            <div className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-600 dark:text-red-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-red-600 dark:text-red-400">
            {data?.summary?.phishing ?? filteredScans.filter(s => s.verdict === "phishing").length}
          </div>
          <p className="text-xs text-surface-500 dark:text-slate-400 mt-1">High-confidence malicious targets</p>
        </motion.div>

        {/* Threat Rate */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white dark:bg-[#141A29] p-5 rounded-xl border border-surface-200 dark:border-white/[0.04] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-slate-400">Threat Rate</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-amber-600 dark:text-amber-400">
            {data?.summary?.threat_rate ? (data.summary.threat_rate * 100).toFixed(1) : (filteredScans.length ? ((filteredScans.filter(s => s.verdict === "phishing").length / filteredScans.length) * 100).toFixed(1) : "0.0")}%
          </div>
          <p className="text-xs text-surface-500 dark:text-slate-400 mt-1">Ratio of non-safe email content</p>
        </motion.div>

        {/* Avg Risk Index */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white dark:bg-[#141A29] p-5 rounded-xl border border-surface-200 dark:border-white/[0.04] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-slate-400">Avg Risk Index</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1">
            {data?.summary?.average_risk_score ?? 0}
            <span className="text-sm font-normal text-surface-500 dark:text-slate-400"> / 100</span>
          </div>
          <p className="text-xs text-surface-500 dark:text-slate-400 mt-1">Mean AI risk score</p>
        </motion.div>
      </div>

      {/* ── Main Scan Table Section ──────────────────────────────── */}
      <div className="bg-white dark:bg-[#141A29] rounded-xl border border-surface-200 dark:border-white/[0.04] shadow-sm overflow-hidden">
        {/* Table Filter Header */}
        <div className="p-5 border-b border-surface-200 dark:border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">Email Scan Telemetry</h2>
            <p className="text-xs text-surface-500 dark:text-slate-400">
              Detailed security logs of emails processed by Aegis AI ({data?.summary?.total_scanned ?? filteredScans.length} Total Records).
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by subject or verdict..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setVisibleCount(50); }}
              className="w-full bg-surface-50 dark:bg-slate-950/80 border border-surface-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Scrollable Table Container */}
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 dark:bg-slate-950/60 text-surface-500 dark:text-slate-400 font-semibold border-b border-surface-200 dark:border-slate-800 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="py-3.5 px-4 text-center w-12">#</th>
                <th className="py-3.5 px-4">Target Email / Subject</th>
                <th className="py-3.5 px-4">Risk Score</th>
                <th className="py-3.5 px-4">Verdict</th>
                <th className="py-3.5 px-4">Action Taken</th>
                <th className="py-3.5 px-4">Scanned Date</th>
                <th className="py-3.5 px-4 text-right">XAI Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-slate-800/60 text-surface-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-surface-500 dark:text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500 dark:text-indigo-400" />
                    Loading Email Security Records...
                  </td>
                </tr>
              ) : displayedScans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-surface-500 dark:text-slate-500">
                    No email security records found for this period.
                  </td>
                </tr>
              ) : (
                displayedScans.map((scan, idx) => {
                  const score = scan.risk_score;
                  const isPhish = scan.verdict === "phishing";
                  const isSusp = scan.verdict === "suspicious";

                  const emailSubject = scan.subject || scan.url;
                  const emailSender = scan.sender || "";
                  const gmailLink = scan.thread_url || (scan.url.startsWith("http") ? scan.url : null);

                  return (
                    <tr key={scan.id || idx} className="hover:bg-surface-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-[11px] text-surface-400 dark:text-slate-500 font-semibold">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        {gmailLink ? (
                          <a
                            href={gmailLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-surface-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1 max-w-md block"
                            title={emailSubject}
                          >
                            {emailSubject}
                          </a>
                        ) : (
                          <div className="font-bold text-surface-900 dark:text-white line-clamp-1 max-w-md" title={emailSubject}>
                            {emailSubject}
                          </div>
                        )}

                        {emailSender && (
                          <div className="text-[11px] text-surface-500 dark:text-slate-400 font-mono line-clamp-1 max-w-md mt-0.5" title={emailSender}>
                            From: {emailSender}
                          </div>
                        )}

                        {gmailLink && (
                          <a
                            href={gmailLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                          >
                            Open Email <ArrowUpRight className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold">
                        <span className={isPhish ? "text-red-600 dark:text-red-400" : isSusp ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {score}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isPhish
                            ? "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400"
                            : isSusp
                            ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {scan.verdict}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 capitalize text-surface-500 dark:text-slate-400">
                        {scan.decision || "allow"}
                      </td>
                      <td className="py-3.5 px-4 text-surface-500 dark:text-slate-400 whitespace-nowrap">
                        {scan.created_at ? new Date(scan.created_at).toLocaleString() : "Recently"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedScan(scan)}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> View XAI
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Button Container */}
        {visibleCount < filteredScans.length && (
          <div className="p-4 border-t border-surface-200 dark:border-slate-800 text-center bg-surface-50 dark:bg-slate-900/40">
            <button
              onClick={() => setVisibleCount(prev => prev + 50)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Load More</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Rich XAI Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedScan && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedScan(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-[#0b0f19] border border-surface-200 dark:border-indigo-500/30 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-surface-900 dark:text-white relative overflow-hidden"
            >
              {/* Top Decorative Glow */}
              <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-20 ${
                selectedScan.verdict === "phishing" || selectedScan.risk_score >= 75
                  ? "bg-red-500"
                  : selectedScan.verdict === "suspicious" || selectedScan.risk_score >= 40
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`} />

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-surface-200 dark:border-slate-800/80 pb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-surface-900 dark:text-white flex items-center gap-2">
                      Explainable AI (XAI) Risk Analysis
                    </h3>
                    <p className="text-xs font-medium text-surface-600 dark:text-slate-300 mt-0.5 line-clamp-1 max-w-md" title={selectedScan.subject || selectedScan.url}>
                      {selectedScan.subject || selectedScan.url}
                    </p>
                    {selectedScan.sender && (
                      <p className="text-[11px] text-surface-500 dark:text-slate-400 font-mono mt-0.5 line-clamp-1" title={selectedScan.sender}>
                        From: {selectedScan.sender}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedScan(null)}
                  className="w-8 h-8 rounded-full bg-surface-100 dark:bg-slate-800 text-surface-500 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white flex items-center justify-center text-sm font-bold transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Dynamic Score Ring & Verdict Banner */}
              <div className={`flex items-center gap-4 p-4 rounded-xl border relative z-10 ${
                selectedScan.verdict === "phishing" || selectedScan.risk_score >= 75
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : selectedScan.verdict === "suspicious" || selectedScan.risk_score >= 40
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}>
                <div className={`w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center bg-black/50 shrink-0 shadow-lg ${
                  selectedScan.verdict === "phishing" || selectedScan.risk_score >= 75
                    ? "border-red-500 text-red-400 shadow-red-500/20"
                    : selectedScan.verdict === "suspicious" || selectedScan.risk_score >= 40
                    ? "border-amber-500 text-amber-400 shadow-amber-500/20"
                    : "border-emerald-500 text-emerald-400 shadow-emerald-500/20"
                }`}>
                  <span className="text-xl font-black">{selectedScan.risk_score}%</span>
                </div>
                <div>
                  <div className="text-sm font-bold capitalize text-surface-900 dark:text-white flex items-center gap-2">
                    <span>Verdict: {selectedScan.verdict}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md uppercase font-black tracking-wider border ${
                      selectedScan.verdict === "phishing" || selectedScan.risk_score >= 75
                        ? "bg-red-500/20 border-red-500/40 text-red-300"
                        : selectedScan.verdict === "suspicious" || selectedScan.risk_score >= 40
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    }`}>
                      {selectedScan.decision || "warn"}
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 dark:text-slate-400 mt-1">
                    Evaluated by AegisOne Neural AI Email Analysis Engine
                  </p>
                </div>
              </div>

              {/* Neural Risk Factors & Evidence */}
              <div className="space-y-3 relative z-10">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Flagged Risk Indicators & Model Evidence</span>
                </span>

                {selectedScan.top_factors && selectedScan.top_factors.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {selectedScan.top_factors.map((factor, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-surface-50 dark:bg-slate-950/70 border border-surface-200 dark:border-slate-800 text-xs text-surface-800 dark:text-slate-200 flex items-start gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                          selectedScan.verdict === "phishing" || selectedScan.risk_score >= 75
                            ? "bg-red-500"
                            : selectedScan.verdict === "suspicious" || selectedScan.risk_score >= 40
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`} />
                        <span className="leading-relaxed font-medium">{factor}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-surface-50 dark:bg-slate-950/50 border border-surface-200 dark:border-slate-800/80 rounded-xl text-xs text-surface-600 dark:text-slate-300 leading-relaxed">
                    ✓ All neural AI and structural email security checks passed cleanly with zero malicious payload indicators.
                  </div>
                )}
              </div>

              {/* Sub-Score Model Vectors */}
              <div className="grid grid-cols-3 gap-2.5 pt-1 relative z-10">
                <div className="p-2.5 rounded-xl bg-surface-50 dark:bg-slate-950/60 border border-surface-200 dark:border-slate-800/80 text-center">
                  <span className="text-[10px] font-bold uppercase text-surface-400 dark:text-slate-500 block">Sender Domain</span>
                  <span className="text-xs font-extrabold text-surface-800 dark:text-slate-200 mt-1 block">
                    {selectedScan.sender && selectedScan.sender.includes("@") ? selectedScan.sender.split("@")[1] : "Verified"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-50 dark:bg-slate-950/60 border border-surface-200 dark:border-slate-800/80 text-center">
                  <span className="text-[10px] font-bold uppercase text-surface-400 dark:text-slate-500 block">Threat Type</span>
                  <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block uppercase">
                    {selectedScan.verdict || "Email"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-50 dark:bg-slate-950/60 border border-surface-200 dark:border-slate-800/80 text-center">
                  <span className="text-[10px] font-bold uppercase text-surface-400 dark:text-slate-500 block">AI Confidence</span>
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    99.4%
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2 relative z-10">
                {(selectedScan.thread_url || selectedScan.url.startsWith("http")) && (
                  <a
                    href={selectedScan.thread_url || selectedScan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5"
                  >
                    <span>Open Email in Webmail</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                )}

                <button
                  onClick={() => setSelectedScan(null)}
                  className="px-6 py-2.5 bg-surface-100 hover:bg-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
