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
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedScan, setSelectedScan] = useState<ScanItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const getToken = useCallback(() => {
    return localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token") || "";
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const userEmail = user?.email || "";
      const url = `http://localhost:8000/analytics/email?period=${period}&scope=employee${userEmail ? `&email=${encodeURIComponent(userEmail)}` : ''}`;
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
          {(["7d", "30d", "90d", "all"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                period === p
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-200 dark:hover:bg-slate-900"
              }`}
            >
              {p === "all" ? "All Time" : `Last ${p}`}
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
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-slate-400">Total Scanned</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400"><Mail className="w-4 h-4" /></div>
          </div>
          <div className="text-3xl font-black text-surface-900 dark:text-white mt-3">{data?.summary.total_scanned || 0}</div>
          <p className="text-xs text-surface-500 dark:text-slate-400 mt-1">Verified email instances</p>
        </motion.div>

        {/* Phishing Blocked */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white dark:bg-[#141A29] p-5 rounded-xl border border-surface-200 dark:border-white/[0.04] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-slate-400">Phishing Blocked</span>
            <div className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-600 dark:text-red-400"><ShieldAlert className="w-4 h-4" /></div>
          </div>
          <div className="text-3xl font-black text-red-600 dark:text-red-400 mt-3">{data?.summary.phishing || 0}</div>
          <p className="text-xs text-surface-500 dark:text-slate-400 mt-1">High-confidence malicious targets</p>
        </motion.div>

        {/* Threat Rate % */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white dark:bg-[#141A29] p-5 rounded-xl border border-surface-200 dark:border-white/[0.04] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-slate-400">Threat Rate</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400"><AlertTriangle className="w-4 h-4" /></div>
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-3">
            {((data?.summary.threat_rate || 0) * 100).toFixed(1)}%
          </div>
          <p className="text-xs text-surface-500 dark:text-slate-400 mt-1">Ratio of non-safe email content</p>
        </motion.div>

        {/* Avg Risk Score */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white dark:bg-[#141A29] p-5 rounded-xl border border-surface-200 dark:border-white/[0.04] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-slate-400">Avg Risk Index</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400"><ShieldCheck className="w-4 h-4" /></div>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-3">
            {data?.summary.average_risk_score || 0}
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
            <p className="text-xs text-surface-500 dark:text-slate-400">Detailed security logs of emails processed by Aegis AI.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by subject or verdict..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface-50 dark:bg-slate-950/80 border border-surface-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 dark:bg-slate-950/60 text-surface-500 dark:text-slate-400 font-semibold border-b border-surface-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-5">Target Email / Subject</th>
                <th className="py-3.5 px-5">Risk Score</th>
                <th className="py-3.5 px-5">Verdict</th>
                <th className="py-3.5 px-5">Action Taken</th>
                <th className="py-3.5 px-5">Scanned Date</th>
                <th className="py-3.5 px-5 text-right">XAI Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-slate-800/60 text-surface-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-surface-500 dark:text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500 dark:text-indigo-400" />
                    Loading Email Security Records...
                  </td>
                </tr>
              ) : filteredScans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-surface-500 dark:text-slate-500">
                    No email security records found for this period.
                  </td>
                </tr>
              ) : (
                filteredScans.map(scan => {
                  const score = scan.risk_score;
                  const isPhish = scan.verdict === "phishing";
                  const isSusp = scan.verdict === "suspicious";

                  const emailSubject = scan.subject || scan.url;
                  const emailSender = scan.sender || "";
                  const gmailLink = scan.thread_url || (scan.url.startsWith("http") ? scan.url : null);

                  return (
                    <tr key={scan.id} className="hover:bg-surface-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5 max-w-md">
                        <div className="font-bold text-surface-900 dark:text-white truncate" title={emailSubject}>
                          {emailSubject}
                        </div>
                        {emailSender && (
                          <div className="text-[11px] text-surface-500 dark:text-slate-400 font-mono truncate mt-0.5">
                            From: {emailSender}
                          </div>
                        )}
                        {gmailLink && (
                          <a
                            href={gmailLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                          >
                            Open in Gmail <ArrowUpRight className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                      <td className="py-3.5 px-5 font-bold">
                        <span className={isPhish ? "text-red-600 dark:text-red-400" : isSusp ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {score}%
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
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
                      <td className="py-3.5 px-5 capitalize text-surface-500 dark:text-slate-400">
                        {scan.decision || "allow"}
                      </td>
                      <td className="py-3.5 px-5 text-surface-500 dark:text-slate-400">
                        {scan.created_at ? new Date(scan.created_at).toLocaleString() : "Recently"}
                      </td>
                      <td className="py-3.5 px-5 text-right">
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
      </div>

      {/* ── XAI Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedScan && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedScan(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-indigo-500/30 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-surface-900 dark:text-white relative"
            >
              <div className="flex items-center justify-between border-b border-surface-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Explainable AI Email Analysis</h3>
                    <p className="text-xs font-medium text-surface-900 dark:text-white mt-0.5 line-clamp-1">{selectedScan.subject || selectedScan.url}</p>
                    {selectedScan.sender && (
                      <p className="text-[11px] text-surface-500 dark:text-slate-400 font-mono mt-0.5">From: {selectedScan.sender}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedScan(null)} className="text-surface-400 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white text-sm">✕</button>
              </div>

              {/* Score & Verdict Banner */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-50 dark:bg-slate-950/80 border border-surface-200 dark:border-slate-800">
                <div className="w-14 h-14 rounded-full border-4 border-indigo-500/50 flex flex-col items-center justify-center bg-indigo-50/50 dark:bg-black/40 shrink-0">
                  <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{selectedScan.risk_score}%</span>
                </div>
                <div>
                  <div className="text-sm font-bold capitalize text-surface-900 dark:text-white">Verdict: {selectedScan.verdict}</div>
                  <p className="text-xs text-surface-500 dark:text-slate-400 mt-0.5">
                    Evaluated by AegisOne Neural Email Engine
                  </p>
                </div>
              </div>

              {/* Risk Factors / Indicators */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Flagged Risk Indicators</span>
                {selectedScan.top_factors && selectedScan.top_factors.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedScan.top_factors.map((factor, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-surface-50 dark:bg-slate-950/60 border border-surface-200 dark:border-slate-800 text-xs text-surface-700 dark:text-slate-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span>{factor}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-surface-50 dark:bg-slate-950/50 rounded-lg text-xs text-surface-500 dark:text-slate-400">
                    All neural AI and structural email security checks passed cleanly.
                  </div>
                )}
              </div>

              {/* Deep Link to Open Email */}
              {(selectedScan.thread_url || selectedScan.url.startsWith("http")) && (
                <a
                  href={selectedScan.thread_url || selectedScan.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  Open Email in Gmail <ArrowUpRight className="w-4 h-4" />
                </a>
              )}

              <button
                onClick={() => setSelectedScan(null)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Close Analysis
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
