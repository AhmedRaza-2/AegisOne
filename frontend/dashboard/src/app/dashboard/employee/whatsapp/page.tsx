"use client";
import { useAuth } from "@/lib/auth-context";
import {
  MessageSquare, ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle2,
  RefreshCw, Link as LinkIcon, Flag, Info, BrainCircuit, MessageCircle, Lock, Layers
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

const CATEGORY_COLORS: Record<string, string> = {
  OTP_SCAM: "#ef4444",
  FINANCIAL_SCAM: "#f97316",
  JOB_SCAM: "#f59e0b",
  PRIZE_SCAM: "#8b5cf6",
  IMPERSONATION: "#ec4899",
  MALICIOUS_LINK: "#3b82f6",
  PHISHING_TEXT: "#ef4444",
  SOCIAL_ENGINEERING: "#06b6d4",
};

export default function EmployeeWhatsAppSecurityPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedThreat, setSelectedThreat] = useState<any>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const fetchWhatsAppStats = async () => {
    if (!user?.email) return;
    setRefreshing(true);
    try {
      const res = await fetch(`http://localhost:8000/analytics/whatsapp?email=${encodeURIComponent(user.email)}&role=employee`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching WhatsApp stats:", err);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWhatsAppStats();
  }, [user]);

  const submitFeedback = async (scanId: string, feedbackType: string) => {
    try {
      const res = await fetch(`http://localhost:8000/analytics/whatsapp/${scanId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_feedback: feedbackType, comments: "Reported via Employee Portal" })
      });
      if (res.ok) {
        setFeedbackSuccess(scanId);
        setTimeout(() => setFeedbackSuccess(null), 4000);
      }
    } catch (e) {
      console.error("Error submitting feedback:", e);
    }
  };

  const categories = data?.categories || {};
  const pieData = Object.entries(categories)
    .filter(([, val]: any) => val > 0)
    .map(([key, val]: any) => ({ name: key.replace(/_/g, " "), value: val, key }));

  const recentThreats = data?.recentThreats || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <motion.div variants={fadeUp} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-950 p-6 rounded-2xl border border-emerald-500/20 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-inner">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">WhatsApp Security Intelligence</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                Active Guard
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Real-time threat telemetry routed directly into AegisOne pre-trained AI models.
            </p>
          </div>
        </div>

        <button
          onClick={fetchWhatsAppStats}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-sm font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh Feed</span>
        </button>
      </motion.div>

      {/* Metric Cards Grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Messages Scanned</span>
            <MessageSquare className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-black text-white tracking-tight">{loading ? "—" : data?.totalMessages || 0}</div>
          <p className="text-xs text-slate-500">Incoming conversations analyzed</p>
        </div>

        <div className="bg-slate-900/60 border border-emerald-500/30 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Safe Rate</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-emerald-400 tracking-tight">{loading ? "—" : `${data?.safeRate || 100}%`}</div>
          <p className="text-xs text-slate-500">{data?.safeMessages || 0} verified safe messages</p>
        </div>

        <div className="bg-slate-900/60 border border-red-500/30 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-red-400">
            <span className="text-xs font-bold uppercase tracking-wider">Threats Intercepted</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-red-400 tracking-tight">{loading ? "—" : data?.threatMessages || 0}</div>
          <p className="text-xs text-slate-500">Phishing text & malicious links</p>
        </div>

        <div className="bg-slate-900/60 border border-blue-500/30 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-xs font-bold uppercase tracking-wider">Links Blocked</span>
            <LinkIcon className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-blue-400 tracking-tight">{loading ? "—" : data?.maliciousLinksBlocked || 0}</div>
          <p className="text-xs text-slate-500">Phishing URLs inside WhatsApp</p>
        </div>
      </motion.div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent WhatsApp Threat Activity List */}
        <motion.div variants={fadeUp} className="lg:col-span-2 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Recent WhatsApp Threat Log</span>
              </h2>
              <p className="text-xs text-slate-400">Inspected WhatsApp incoming messages and risk verdicts</p>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
              Live Feed
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading WhatsApp telemetry...</div>
          ) : recentThreats.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
              <span>No WhatsApp security threats detected. Your chats are secure!</span>
            </div>
          ) : (
            <div className="space-y-3">
              {recentThreats.map((item: any) => {
                const isBlocked = item.verdict === "phishing" || item.riskScore >= 76;
                const isWarned = item.verdict === "suspicious" || (item.riskScore >= 50 && item.riskScore < 76);
                const colorClass = isBlocked
                  ? "border-red-500/30 bg-red-500/5 text-red-400"
                  : isWarned
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
                    : "border-slate-800 bg-slate-800/20 text-emerald-400";

                return (
                  <div key={item.id} className={`p-4 rounded-xl border ${colorClass} transition-all hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate max-w-md">{item.preview}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                          {item.category.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>Chat: {item.chatTitle}</span>
                        <span>•</span>
                        <span>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${isBlocked ? "bg-red-500/20 text-red-400 border border-red-500/40" : isWarned ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"}`}>
                        {item.riskScore}% {item.verdict}
                      </span>
                      
                      <button
                        onClick={() => setSelectedThreat(item)}
                        className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        <span>XAI Evidence</span>
                      </button>

                      <button
                        onClick={() => submitFeedback(item.id, "false_positive")}
                        title="Report Detection Feedback"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Right: Category Distribution Chart */}
        <motion.div variants={fadeUp} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white">Threat Category Matrix</h2>
            <p className="text-xs text-slate-400">Distribution of detected WhatsApp scam vectors</p>
          </div>

          {pieData.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">No active threat vectors detected</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.key] || "#3b82f6"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", borderColor: "#334155", borderRadius: "10px" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </div>

      {/* XAI Evidence Drawer */}
      {selectedThreat && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-lg">AegisOne Core Model XAI Evidence</h3>
              </div>
              <button onClick={() => setSelectedThreat(null)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl">
                <span className="text-slate-400">Risk Assessment:</span>
                <span className="font-black text-red-400">{selectedThreat.riskScore}% ({selectedThreat.verdict})</span>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase">Inspected Content:</span>
                <p className="mt-1 p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs font-mono">{selectedThreat.preview}</p>
              </div>

              {/* Render Modality-Specific Model Evidence */}
              {selectedThreat.modalities && selectedThreat.modalities.length > 0 ? (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Contributing AI Model Modalities:</span>
                  {selectedThreat.modalities.map((m: any, idx: number) => {
                    const mr = m.model_result || m.xai || {};
                    return (
                      <div key={idx} className="p-3 bg-slate-950 border border-indigo-500/20 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300 uppercase">{m.type} Model ({m.model})</span>
                          <span className="font-black text-red-400">{m.score}% {m.verdict}</span>
                        </div>

                        {mr.explanation && (
                          <p className="text-slate-300 italic">{mr.explanation}</p>
                        )}

                        {mr.xai_words && mr.xai_words.length > 0 && (
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block mb-1">DistilBERT Key Attention Tokens:</span>
                            <div className="flex flex-wrap gap-1">
                              {mr.xai_words.map((w: string, wIdx: number) => (
                                <span key={wIdx} className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 rounded text-[10px] font-mono">
                                  {w}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {mr.top_factors && mr.top_factors.length > 0 && (
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block mb-1">XGBoost ML Feature Factors:</span>
                            <div className="space-y-1">
                              {mr.top_factors.map((f: any, fIdx: number) => (
                                <div key={fIdx} className="text-[11px] text-slate-300 flex items-center justify-between bg-slate-900 p-1.5 rounded">
                                  <span>{typeof f === "object" ? f.label || JSON.stringify(f) : f}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <span className="text-xs font-bold text-indigo-400 uppercase">Model Factor Output:</span>
                  <p className="mt-1 text-slate-300 text-xs leading-relaxed">{Array.isArray(selectedThreat.factors) ? selectedThreat.factors.join(" • ") : (selectedThreat.factors || "Evaluated by AegisOne core AI model.")}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  submitFeedback(selectedThreat.id, "false_positive");
                  setSelectedThreat(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
              >
                Report False Positive
              </button>
              <button onClick={() => setSelectedThreat(null)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all">
                Close Diagnosis
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
