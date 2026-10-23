"use client";
import { useCallback, useEffect, useState } from "react";
import { GraduationCap, CheckCircle2, Clock, ArrowLeft, Loader2, XCircle, PlayCircle } from "lucide-react";
import { motion } from "framer-motion";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}
async function api(path: string, method = "GET", body?: any) {
  const res = await fetch(`${getApiBaseUrl()}${path}`, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
  return data;
}

export default function TrainingPage() {
  const [my, setMy] = useState<any>(null);
  const [mod, setMod] = useState<any>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setMy(await api("/awareness/my")); } catch (e: any) { toast(e.message, "error"); } }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (key: string) => {
    try { const m = await api(`/awareness/modules/${key}`); setMod(m); setAnswers(new Array(m.quiz.length).fill(-1)); setResult(null); window.scrollTo({ top: 0 }); }
    catch (e: any) { toast(e.message, "error"); }
  };

  const submit = async () => {
    setBusy(true);
    try { setResult(await api(`/awareness/modules/${mod.key}/submit`, "POST", { answers })); load(); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  if (mod) {
    return (
      <motion.div initial="hidden" animate="show" variants={fadeUp} className="max-w-3xl mx-auto space-y-5">
        <button onClick={() => setMod(null)} className="flex items-center gap-1.5 text-xs font-semibold text-surface-500 hover:text-surface-800 dark:hover:text-white"><ArrowLeft className="w-4 h-4" /> All lessons</button>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{mod.title}</h1>
          <p className="text-sm text-surface-500 mt-1 flex items-center gap-1.5"><Clock className="w-4 h-4" /> about {mod.minutes} minutes</p>
        </div>
        {mod.lessons.map((l: any, i: number) => (
          <div key={i} className="stat-card">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white mb-1">{i + 1}. {l.heading}</h2>
            <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">{l.body}</p>
          </div>
        ))}
        <div className="stat-card space-y-5">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white">Quick check</h2>
          {mod.quiz.map((q: any, qi: number) => (
            <div key={qi}>
              <p className="text-sm font-medium text-surface-900 dark:text-white mb-2">{qi + 1}. {q.q}</p>
              <div className="space-y-1.5">
                {q.options.map((o: string, oi: number) => {
                  const r = result?.results?.[qi];
                  const state = !result ? (answers[qi] === oi ? "sel" : "") : oi === r.answer ? "right" : answers[qi] === oi ? "wrong" : "";
                  return (
                    <button key={oi} disabled={!!result} onClick={() => setAnswers(a => a.map((v, i) => (i === qi ? oi : v)))}
                      className={`w-full text-left text-sm px-3 py-2 rounded-lg border ${state === "sel" ? "border-brand-500 bg-brand-600/5" : state === "right" ? "border-emerald-500 bg-emerald-500/10" : state === "wrong" ? "border-red-500 bg-red-500/10" : "border-surface-200 dark:border-white/[0.08]"} text-surface-800 dark:text-surface-100`}>
                      {o}
                    </button>
                  );
                })}
              </div>
              {result && <p className="text-xs text-surface-500 mt-2">{result.results[qi].correct ? "Correct. " : "Not quite. "}{result.results[qi].why}</p>}
            </div>
          ))}
          {!result ? (
            <button onClick={submit} disabled={busy || answers.some(a => a < 0)} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Check my answers
            </button>
          ) : (
            <div className={`rounded-xl p-4 text-sm ${result.passed ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
              <p className="font-semibold flex items-center gap-2">{result.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} You scored {result.score}%. {result.passed ? "Lesson complete, well done." : `You need ${my?.pass_mark ?? 70}% to complete it. Read the explanations and try again.`}</p>
              <div className="mt-3 flex gap-3">
                {!result.passed && <button onClick={() => { setResult(null); setAnswers(new Array(mod.quiz.length).fill(-1)); }} className="text-xs font-semibold underline">Try again</button>}
                <button onClick={() => setMod(null)} className="text-xs font-semibold underline">Back to lessons</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  const todo = (my?.modules || []).filter((m: any) => m.status === "assigned");
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="max-w-4xl mx-auto space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white"><GraduationCap className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Security training</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Short lessons (2 to 4 minutes) that help you spot phishing. No one is graded against anyone else.</p>
      </motion.div>

      {my?.exercises?.received > 0 && (
        <motion.div variants={fadeUp} className="stat-card text-sm text-surface-600 dark:text-surface-300">
          Your organisation has sent you <b>{my.exercises.received}</b> practice phishing message{my.exercises.received === 1 ? "" : "s"}.
          You reported <b className="text-emerald-600 dark:text-emerald-400">{my.exercises.reported}</b> and opened <b>{my.exercises.clicked}</b>. Reporting is always the right move.
        </motion.div>
      )}

      {todo.length > 0 && (
        <motion.div variants={fadeUp} className="stat-card border border-amber-400/40">
          <p className="text-sm font-semibold text-surface-900 dark:text-white mb-2">Waiting for you</p>
          <div className="space-y-2">
            {todo.map((m: any) => (
              <button key={m.key} onClick={() => open(m.key)} className="w-full flex items-center justify-between gap-3 text-left rounded-lg p-3 bg-surface-50 dark:bg-white/[0.03] hover:bg-surface-100 dark:hover:bg-white/[0.06]">
                <div><p className="text-sm font-semibold text-surface-900 dark:text-white">{m.title}</p><p className="text-xs text-surface-500">{m.reason} • {m.minutes} min</p></div>
                <PlayCircle className="w-5 h-5 text-brand-500 shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-3">
        {(my?.modules || []).map((m: any) => (
          <button key={m.key} onClick={() => open(m.key)} className="stat-card text-left hover:border-brand-500/40 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-surface-900 dark:text-white">{m.title}</p>
              {m.status === "completed" && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
            </div>
            <p className="text-xs text-surface-500 mt-1">{m.summary}</p>
            <p className="text-[11px] text-surface-400 mt-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {m.minutes} min{m.best_score != null ? ` • best score ${m.best_score}%` : ""}</p>
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}
