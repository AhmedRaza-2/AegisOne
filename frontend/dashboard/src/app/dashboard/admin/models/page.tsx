"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity, Cpu, Globe, Mail, FileText, Image as ImageIcon, RefreshCw, Play, CheckCircle2, AlertTriangle,
  ShieldCheck, Clock, Loader2, XCircle, ChevronDown, ListChecks, History, FlaskConical, Layers,
} from "lucide-react";
import { motion } from "framer-motion";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { EvidencePanel } from "@/components/ui/EvidencePanel";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const MODELS: { id: string; label: string; icon: any; learns: string }[] = [
  { id: "url", label: "URL model", icon: Globe, learns: "links and web addresses" },
  { id: "email", label: "Email model", icon: Mail, learns: "email wording and senders" },
  { id: "text", label: "Text model", icon: FileText, learns: "message and page text" },
  { id: "image", label: "Image model", icon: ImageIcon, learns: "screenshots, logos and QR-style images" },
];

const JOB_STEPS = ["queued", "running", "result"] as const;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function duration(job: any) {
  if (!job.started_at) return "waiting to start";
  const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  const sec = Math.max(0, Math.round((end - new Date(job.started_at).getTime()) / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

const JOB_STATUS: Record<string, { label: string; cls: string; help: string }> = {
  queued: { label: "Queued", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", help: "Waiting for the learning worker to pick it up." },
  running: { label: "Learning", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400", help: "Fitting a small correction layer, then testing it on examples it has never seen." },
  completed: { label: "Activated", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", help: "Proved better than the base model on unseen examples. Active as a layer on top of the base model; you can revoke it any time." },
  rejected: { label: "Not activated", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", help: "Did not clearly beat the base model (or there was not enough evidence), so nothing changed." },
  failed: { label: "Failed", cls: "bg-red-500/10 text-red-600 dark:text-red-400", help: "Training could not finish. See the error below." },
};

function stepIndex(status: string) {
  if (status === "queued") return 0;
  if (status === "running") return 1;
  return 2;
}

export default function ModelsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [releases, setReleases] = useState<any[]>([]);
  const [retraining, setRetraining] = useState<string | null>(null);
  const [openCandidate, setOpenCandidate] = useState<string | null>(null);
  const [sampleFilter, setSampleFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const base = getApiBaseUrl();
    const headers = authHeaders();
    const get = (p: string) => fetch(`${base}${p}`, { headers }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [s, j, m, c, p, r] = await Promise.all([
      get("/admin/training-candidates/summary"), get("/admin/training-jobs"), get("/admin/models"),
      get("/admin/training-candidates"), get("/admin/global-learning/policy"), get("/admin/global-learning/releases"),
    ]);
    if (s) setSummary(s);
    if (Array.isArray(j)) setJobs(j);
    if (Array.isArray(m)) setVersions(m);
    if (Array.isArray(c)) setCandidates(c);
    if (p) setPolicy(p);
    if (Array.isArray(r)) setReleases(r);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasActiveJob = jobs.some(j => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!hasActiveJob) return;
    const t = setInterval(fetchData, 3000);
    return () => clearInterval(t);
  }, [hasActiveJob, fetchData]);

  const refresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const handleRetrain = async (modelType: string) => {
    setRetraining(modelType);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/models/retrain`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ model_type: modelType, force_cpu: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(`Learning started (${data.job_id}). Follow its progress under "Learning jobs" below.`);
        fetchData();
        document.getElementById("jobs-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        toast(typeof data.detail === "string" ? data.detail : "Could not start retraining.", "error");
      }
    } catch {
      toast("Network error while starting retraining.", "error");
    } finally {
      setRetraining(null);
    }
  };

  const handleRevoke = async (modelType: string) => {
    const res = await fetch(`${getApiBaseUrl()}/admin/models/${modelType}/revert-to-base`, { method: "POST", headers: authHeaders() });
    if (res.ok) { toast(`The ${modelType} model is back to its original base behaviour.`); fetchData(); }
    else toast("Could not revoke the learning layer.", "error");
  };

  const handleActivate = async (versionId: string) => {
    const res = await fetch(`${getApiBaseUrl()}/admin/models/${versionId}/activate`, { method: "POST", headers: authHeaders() });
    if (res.ok) { toast("Model version is now active."); fetchData(); }
    else toast("Could not activate that version.", "error");
  };

  const handleTogglePolicy = async (enabled: boolean) => {
    const res = await fetch(`${getApiBaseUrl()}/admin/global-learning/policy`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ allow_global_contribution: enabled, auto_anonymize: true, allowed_model_types: ["url", "email", "text", "image"] }),
    });
    if (res.ok) { setPolicy(await res.json()); toast(`Global contribution ${enabled ? "enabled" : "disabled"}.`); }
    else toast("Could not update the contribution policy.", "error");
  };

  const activeByType = useMemo(() => {
    const m: Record<string, any> = {};
    versions.forEach(v => { if (v.is_production || v.is_active) m[v.model_type] = v; });
    return m;
  }, [versions]);

  const visibleCandidates = candidates.filter(c => sampleFilter === "all" || c.status === sampleFilter || c.model_type === sampleFilter);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Activity className="w-6 h-6 text-brand-650 dark:text-brand-400" /> AI Models &amp; Learning
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            How AegisOne learns from your team&apos;s confirmed reports — and exactly what it learned from.
          </p>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-100 hover:bg-surface-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-surface-700 dark:text-surface-200 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </motion.div>

      {/* How it works */}
      <motion.div variants={fadeUp} className="stat-card">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2 mb-4"><Layers className="w-4 h-4 text-brand-500" /> How learning works here</h2>
        <div className="grid sm:grid-cols-4 gap-3 text-xs">
          {[
            ["1. Employees report", "Someone flags a detection as wrong, or reports something suspicious, with the evidence attached."],
            ["2. You verify", "In Incidents you confirm it (phishing, false positive…). Only verified decisions become training samples."],
            ["3. Learn", "Once there are enough examples of both kinds, press Learn. It fits a tiny correction layer; the base model is never modified. Nothing leaves your network."],
            ["4. Safety check", "The layer is tested on examples it has never seen and compared with the base model. It only goes live if it is clearly better and causes no extra false alarms or misses. You can revoke it at any time."],
          ].map(([t, d]) => (
            <div key={t} className="p-3 rounded-xl bg-surface-50 dark:bg-white/[0.03] border border-surface-100 dark:border-white/[0.05]">
              <p className="font-semibold text-surface-900 dark:text-white mb-1">{t}</p>
              <p className="text-surface-500 dark:text-surface-400 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Summary */}
      <motion.div variants={fadeUp} className="stat-card">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2 mb-4"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Verified training samples</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["Total verified", summary?.total_verified_samples ?? 0, "text-surface-900 dark:text-white"],
            ["Waiting to be learned", summary?.pending_candidates ?? 0, "text-amber-500"],
            ["Already learned", summary?.used_candidates ?? 0, "text-emerald-500"],
            ["Rejected", summary?.rejected_candidates ?? 0, "text-surface-400"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="p-4 rounded-xl bg-surface-50 dark:bg-white/[0.02] border border-surface-100 dark:border-white/[0.04]">
              <div className="text-[11px] uppercase tracking-wider text-surface-500 mb-1">{l}</div>
              <div className={`text-2xl font-bold ${c}`}>{v as number}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Model cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {MODELS.map(m => {
          const rd = summary?.readiness?.[m.id] || { usable: 0, phishing: 0, benign: 0, needed_total: 20, needed_each: 5, ready: false, pending: 0 };
          const pending = rd.pending || 0;
          const adapter = summary?.active_adapters?.[m.id];
          const running = jobs.find(j => j.model_type === m.id && (j.status === "queued" || j.status === "running"));
          const pct = Math.min(100, Math.round((rd.usable / rd.needed_total) * 100));
          const reason = !rd.ready
            ? `Needs ${Math.max(0, rd.needed_total - rd.usable)} more verified example${rd.needed_total - rd.usable === 1 ? "" : "s"}${rd.phishing < rd.needed_each ? ` (at least ${rd.needed_each - rd.phishing} more phishing)` : ""}${rd.benign < rd.needed_each ? ` (at least ${rd.needed_each - rd.benign} more safe)` : ""}`
            : pending === 0 ? "No new examples since it last learned" : `Learn from ${rd.usable} verified examples`;
          return (
            <motion.div key={m.id} variants={fadeUp} className="stat-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0"><m.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" /></div>
                  <div>
                    <h3 className="text-base font-semibold text-surface-900 dark:text-white">{m.label}</h3>
                    <p className="text-xs text-surface-500">Learns from {m.learns}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${adapter ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-surface-200/70 dark:bg-white/[0.06] text-surface-500"}`}>
                  {adapter ? "Learning layer ON" : "Base model only"}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-surface-500 mb-1">
                  <span>{rd.usable} / {rd.needed_total} verified examples</span>
                  <span>phishing {rd.phishing}/{rd.needed_each} • safe {rd.benign}/{rd.needed_each}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-100 dark:bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full ${rd.ready ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleRetrain(m.id)}
                  disabled={retraining === m.id || !rd.ready || pending === 0 || !!running}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {retraining === m.id || running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {running ? `Job ${running.status}…` : reason}
                </button>
                {adapter && (
                  <button onClick={() => handleRevoke(m.id)} title="Switch the learning layer off and return to the original base model"
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-red-300 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    Revoke
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Jobs */}
      <motion.div variants={fadeUp} id="jobs-section" className="stat-card scroll-mt-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2"><FlaskConical className="w-4 h-4 text-purple-500" /> Retraining jobs</h2>
          {hasActiveJob && <span className="text-[11px] text-blue-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> updating live</span>}
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-surface-500 py-6 text-center">No learning has been run yet. Verify incidents until a model has enough examples, then press Learn.</p>
        ) : (
          <div className="space-y-3">
            {jobs.slice(0, 8).map(j => {
              const st = JOB_STATUS[j.status] || JOB_STATUS.queued;
              const idx = stepIndex(j.status);
              const bad = j.status === "failed" || j.status === "rejected";
              const metrics = j.metrics_json || {};
              return (
                <div key={j.job_id} className="rounded-xl border border-surface-200 dark:border-white/[0.06] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-surface-700 dark:text-surface-200">{j.job_id}</span>
                      <span className="text-xs uppercase font-semibold text-surface-500">{j.model_type} model</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {JOB_STEPS.map((s, i) => (
                      <div key={s} className="flex-1">
                        <div className={`h-1.5 rounded-full ${i < idx || (i === idx && j.status !== "queued" && j.status !== "running") ? (bad && i === 2 ? "bg-red-500" : "bg-emerald-500") : i === idx ? "bg-blue-500 animate-pulse" : "bg-surface-200 dark:bg-white/[0.08]"}`} />
                        <p className="text-[10px] text-surface-500 mt-1 capitalize">{s === "result" ? (bad ? j.status : "result") : s === "running" ? "training" : s}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-surface-500">{st.help}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-surface-500">
                    <span>{j.candidate_count} verified example{j.candidate_count === 1 ? "" : "s"}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {duration(j)}</span>
                    <span>started {new Date(j.created_at).toLocaleString()}</span>
                    <span>layer: {j.target_adapter_version}</span>
                  </div>
                  {metrics.base && metrics.candidate ? (
                    <div className="rounded-lg border border-surface-200 dark:border-white/[0.06] overflow-hidden text-[11px]">
                      <div className="px-3 py-1.5 bg-surface-50 dark:bg-white/[0.03] text-surface-500">
                        Tested on {metrics.samples} verified examples the layer had not seen ({metrics.positives} phishing, {metrics.negatives} safe)
                      </div>
                      <table className="w-full text-left">
                        <thead><tr className="text-surface-400"><th className="px-3 py-1 font-medium">Measure</th><th className="px-3 py-1 font-medium">Base model</th><th className="px-3 py-1 font-medium">With learning layer</th></tr></thead>
                        <tbody>
                          {[["Correct verdicts", "accuracy", false], ["F1 score", "f1", false], ["False alarms (safe flagged)", "fpr", true], ["Missed threats", "fnr", true]].map(([label, k, lowerBetter]: any) => {
                            const b = Number(metrics.base[k]), c = Number(metrics.candidate[k]);
                            const better = lowerBetter ? c < b : c > b, worse = lowerBetter ? c > b : c < b;
                            return (
                              <tr key={k} className="border-t border-surface-100 dark:border-white/[0.04]">
                                <td className="px-3 py-1 text-surface-600 dark:text-surface-300">{label}</td>
                                <td className="px-3 py-1 text-surface-700 dark:text-surface-200">{(b * 100).toFixed(1)}%</td>
                                <td className={`px-3 py-1 font-semibold ${better ? "text-emerald-600 dark:text-emerald-400" : worse ? "text-red-600 dark:text-red-400" : "text-surface-700 dark:text-surface-200"}`}>{(c * 100).toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : Object.keys(metrics).length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {["accuracy", "precision", "recall", "f1", "fpr", "fnr"].filter(k => metrics[k] != null).map(k => (
                        <span key={k} className="px-2 py-1 rounded-md bg-surface-100 dark:bg-white/[0.06] text-surface-700 dark:text-surface-200"><b className="uppercase">{k}</b> {(Number(metrics[k]) * 100).toFixed(1)}%</span>
                      ))}
                    </div>
                  )}
                  {j.error_message && <p className={`text-xs flex gap-1.5 ${j.status === "failed" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {j.error_message}</p>}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Training samples with evidence */}
      <motion.div variants={fadeUp} className="stat-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2"><ListChecks className="w-4 h-4 text-brand-500" /> What the models learned from</h2>
          <div className="flex gap-1.5 text-xs">
            {["all", "pending", "used", "rejected"].map(f => (
              <button key={f} onClick={() => setSampleFilter(f)} className={`px-2.5 py-1 rounded-lg capitalize ${sampleFilter === f ? "bg-brand-600/10 text-brand-600 dark:text-brand-400 border border-brand-500/20" : "text-surface-500 hover:bg-surface-100 dark:hover:bg-white/[0.04] border border-transparent"}`}>{f}</button>
            ))}
          </div>
        </div>
        {visibleCandidates.length === 0 ? (
          <p className="text-sm text-surface-500 py-6 text-center">No samples here yet. They appear when you verify an incident as phishing, false positive, false negative or benign.</p>
        ) : (
          <div className="space-y-2">
            {visibleCandidates.slice(0, 30).map(c => {
              const sd = c.sample_data || {};
              const open = openCandidate === c.candidate_id;
              return (
                <div key={c.candidate_id} className="rounded-xl border border-surface-200 dark:border-white/[0.06] overflow-hidden">
                  <button onClick={() => setOpenCandidate(open ? null : c.candidate_id)} className="w-full text-left p-3.5 flex items-center gap-3">
                    <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-md ${c.label === "phishing" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>{c.label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-surface-900 dark:text-white truncate" title={sd.target_ref}>{sd.target_ref || c.candidate_id}</p>
                      <p className="text-[11px] text-surface-500">{c.model_type} model • {String(sd.decision || "verified").replace(/_/g, " ").toLowerCase()} • {c.status}{sd.evidence?.findings?.[0] ? ` • ${sd.evidence.findings[0].slice(0, 70)}` : ""}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="px-3.5 pb-4 space-y-3 border-t border-surface-100 dark:border-white/[0.05] pt-3">
                      <EvidencePanel evidence={sd.evidence} />
                      {sd.admin_notes && <p className="text-xs text-surface-600 dark:text-surface-300"><b>Reviewer note:</b> {sd.admin_notes}</p>}
                      <p className="text-[11px] text-surface-400">Incident #{c.incident_id ?? "—"} • added {new Date(c.created_at).toLocaleString()}{c.used_at ? ` • learned ${new Date(c.used_at).toLocaleString()}` : ""}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Versions */}
      <motion.div variants={fadeUp} className="stat-card">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2 mb-4"><History className="w-4 h-4 text-brand-500" /> Model versions</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-surface-500 py-4 text-center">Only the original base models are in use. A learning layer appears here after one proves itself.</p>
        ) : (
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.version_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-200 dark:border-white/[0.06] p-3.5 text-xs">
                <div>
                  <p className="font-semibold text-surface-900 dark:text-white">{v.model_type.toUpperCase()} • {v.version_tag}{v.is_global_base ? " (global base)" : ""}</p>
                  <p className="text-surface-500">created {new Date(v.created_at).toLocaleString()}{v.metrics_json?.f1 != null ? ` • F1 ${(v.metrics_json.f1 * 100).toFixed(1)}%` : ""}</p>
                </div>
                {v.is_production || v.is_active ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"><CheckCircle2 className="w-4 h-4" /> Active layer</span>
                ) : !v.is_global_base ? (
                  <button onClick={() => handleActivate(v.version_id)} className="px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-white/[0.06] hover:bg-surface-200 dark:hover:bg-white/[0.1] font-semibold text-surface-700 dark:text-surface-200">Switch to this layer</button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Global learning */}
      <motion.div variants={fadeUp} className="stat-card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Global AegisOne learning</h2>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 max-w-xl">
              Optionally share anonymised patterns (never raw emails or page content) with AegisOne Central so every customer&apos;s base model improves. Off by default.
              {releases.length > 0 ? ` ${releases.length} global release${releases.length === 1 ? "" : "s"} available.` : ""}
            </p>
          </div>
          <button
            onClick={() => handleTogglePolicy(!policy?.allow_global_contribution)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${policy?.allow_global_contribution ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300"}`}
          >
            Sharing: {policy?.allow_global_contribution ? "ON" : "OFF"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
