"use client";
import { useState, useEffect } from "react";
import {
  Activity, Cpu, Globe, Mail, FileText, Image, Zap, BarChart3, Clock, TrendingUp,
  RefreshCw, Play, CheckCircle2, AlertTriangle, ShieldCheck, Download, ArrowLeftRight
} from "lucide-react";
import { motion } from "framer-motion";
import { getApiBaseUrl } from "@/lib/api";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

const modelIcons: Record<string, typeof Mail> = { email: Mail, url: Globe, text: FileText, image: Image };

export default function ModelsPage() {
  const [candidatesSummary, setCandidatesSummary] = useState<any>(null);
  const [trainingJobs, setTrainingJobs] = useState<any[]>([]);
  const [modelVersions, setModelVersions] = useState<any[]>([]);
  const [globalPolicy, setGlobalPolicy] = useState<any>(null);
  const [globalReleases, setGlobalReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [retrainingModel, setRetrainingModel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const fetchData = async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const [sumRes, jobsRes, modsRes, polRes, relRes] = await Promise.all([
        fetch(`${baseUrl}/admin/training-candidates/summary`, { headers }),
        fetch(`${baseUrl}/admin/training-jobs`, { headers }),
        fetch(`${baseUrl}/admin/models`, { headers }),
        fetch(`${baseUrl}/admin/global-learning/policy`, { headers }),
        fetch(`${baseUrl}/admin/global-learning/releases`, { headers })
      ]);

      if (sumRes.ok) setCandidatesSummary(await sumRes.json());
      if (jobsRes.ok) setTrainingJobs(await jobsRes.json());
      if (modsRes.ok) setModelVersions(await modsRes.json());
      if (polRes.ok) setGlobalPolicy(await polRes.json());
      if (relRes.ok) setGlobalReleases(await relRes.json());
    } catch (err) {
      console.error("Failed to load model lifecycle data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRetrain = async (modelType: string) => {
    setRetrainingModel(modelType);
    setMsg(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/admin/models/retrain`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model_type: modelType, force_cpu: false })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: `Retraining job queued successfully: ${data.job_id}` });
        fetchData();
      } else {
        setMsg({ type: "error", text: data.detail || "Failed to trigger retraining." });
      }
    } catch (err) {
      setMsg({ type: "error", text: "Network error triggering model retraining." });
    } finally {
      setRetrainingModel(null);
    }
  };

  const handleToggleGlobalPolicy = async (enabled: boolean) => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/admin/global-learning/policy`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          allow_global_contribution: enabled,
          auto_anonymize: true,
          allowed_model_types: ["url", "email", "text", "image"]
        })
      });
      if (res.ok) {
        setGlobalPolicy(await res.json());
        setMsg({ type: "success", text: `Global contribution policy updated: ${enabled ? "ENABLED" : "DISABLED"}` });
      }
    } catch (err) {
      setMsg({ type: "error", text: "Failed to update global contribution policy." });
    }
  };

  const handleRollback = async (versionId: string) => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/admin/models/${versionId}/rollback`, {
        method: "POST",
        headers
      });
      if (res.ok) {
        setMsg({ type: "success", text: `Successfully rolled back to version ${versionId}` });
        fetchData();
      }
    } catch (err) {
      setMsg({ type: "error", text: "Rollback failed." });
    }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Activity className="w-6 h-6 text-brand-650 dark:text-brand-400" /> AI Model Lifecycle & Adaptive Learning
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Local Organization Fine-Tuning, Ground Truth Candidates, and Global AEGIS Base Model Updates
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-100 hover:bg-surface-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-surface-700 dark:text-surface-200 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh State
        </button>
      </motion.div>

      {msg && (
        <div className={`p-4 rounded-xl text-sm font-medium ${msg.type === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"}`}>
          {msg.text}
        </div>
      )}

      {/* Ground Truth Verified Candidates Summary */}
      <motion.div variants={fadeUp} className="glass-card p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-surface-900 dark:text-white mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-500" /> Verified Local Training Candidates
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-surface-100/50 dark:bg-white/[0.02]">
            <div className="text-xs text-surface-500 mb-1">Total Verified Samples</div>
            <div className="text-2xl font-bold text-surface-900 dark:text-white">{candidatesSummary?.total_verified_samples || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-surface-100/50 dark:bg-white/[0.02]">
            <div className="text-xs text-surface-500 mb-1">Pending Local Retraining</div>
            <div className="text-2xl font-bold text-amber-500">{candidatesSummary?.pending_candidates || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-surface-100/50 dark:bg-white/[0.02]">
            <div className="text-xs text-surface-500 mb-1">Used in Local Fine-Tuning</div>
            <div className="text-2xl font-bold text-emerald-500">{candidatesSummary?.used_candidates || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-surface-100/50 dark:bg-white/[0.02]">
            <div className="text-xs text-surface-500 mb-1">Rejected Candidates</div>
            <div className="text-2xl font-bold text-surface-400">{candidatesSummary?.rejected_candidates || 0}</div>
          </div>
        </div>
      </motion.div>

      {/* Model Cards & Local Retrain Trigger */}
      <div className="space-y-4">
        {["url", "email", "text", "image"].map(mType => {
          const Icon = modelIcons[mType] || Cpu;
          const pendingForModel = candidatesSummary?.samples_by_model?.[mType] || 0;
          return (
            <motion.div key={mType} variants={fadeUp} className="glass-card p-6 hover:border-surface-300 dark:hover:border-white/[0.12] transition-all">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-surface-900 dark:text-white uppercase">{mType} Model</h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                      Verified org samples available: <strong className="text-brand-500">{pendingForModel}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRetrain(mType)}
                  disabled={retrainingModel === mType || pendingForModel === 0}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {retrainingModel === mType ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Retrain {mType.toUpperCase()} Model
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Global Learning Privacy Policy Controls */}
      <motion.div variants={fadeUp} className="glass-card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" /> Global AEGIS Learning Contribution
            </h2>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
              Contribute anonymized, privacy-filtered security patterns to AEGIS Central (OFF by default)
            </p>
          </div>
          <button
            onClick={() => handleToggleGlobalPolicy(!globalPolicy?.allow_global_contribution)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${globalPolicy?.allow_global_contribution ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300"}`}
          >
            Contribution Policy: {globalPolicy?.allow_global_contribution ? "ENABLED" : "OFF (Default)"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
