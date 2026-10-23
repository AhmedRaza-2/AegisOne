"use client";
import { useCallback, useEffect, useState } from "react";
import { Lightbulb, Send, Download, Plus, Loader2, Users, MousePointerClick, Flag, GraduationCap, ChevronDown, RefreshCw, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

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
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

const OUTCOME: Record<string, string> = {
  reported: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  clicked: "bg-red-500/10 text-red-600 dark:text-red-400",
  "no action": "bg-surface-200/70 dark:bg-white/[0.06] text-surface-500",
};

export default function AwarenessPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "super_admin" || user?.role === "global_admin";
  const [overview, setOverview] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", template_key: "", department_id: "" });
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, t, c] = await Promise.all([api("/admin/awareness/overview"), api("/admin/awareness/templates"), api("/admin/awareness/campaigns")]);
      setOverview(o); setTemplates(t); setCampaigns(c);
      if (!form.template_key && t.length) setForm(f => ({ ...f, template_key: t[0].key }));
    } catch (e: any) { toast(e.message, "error"); }
    try { const d = await api("/admin/departments"); setDepts(Array.isArray(d) ? d : d.departments || []); } catch { /* optional */ }
  }, []); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); await load(); } catch (e: any) { toast(e.message || "Something went wrong", "error"); } finally { setBusy(null); }
  };

  const showDetail = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setDetail(null);
    try { setDetail(await api(`/admin/awareness/campaigns/${id}`)); } catch (e: any) { toast(e.message, "error"); }
  };

  const downloadCsv = async (id: string) => {
    const res = await fetch(`${getApiBaseUrl()}/admin/awareness/campaigns/${id}/links.csv`, { headers: authHeaders() });
    if (!res.ok) { toast("Could not export the links.", "error"); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a"); a.href = url; a.download = `${id}-links.csv`; a.click(); URL.revokeObjectURL(url);
    toast("Mail-merge file downloaded. Every person has their own tracked link.");
  };

  const tpl = templates.find(t => t.key === form.template_key);

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={fadeUp} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white"><Lightbulb className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Security awareness</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 max-w-2xl">Run safe phishing exercises, see who clicks and who reports, and give a short lesson at exactly the right moment. Nothing employees type is ever collected.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-100 hover:bg-surface-200 dark:bg-white/[0.05] text-surface-700 dark:text-surface-200"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          {canManage && <button onClick={() => setShowNew(v => !v)} className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white"><Plus className="w-4 h-4" /> New exercise</button>}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Awareness score", overview?.awareness_score ?? "—", "Rewards reporting, penalises clicking", Lightbulb],
          ["Exercises run", overview?.campaigns ?? 0, "", Send],
          ["Click rate", overview?.targets ? pct(overview.click_rate) : "—", `${overview?.clicked ?? 0} of ${overview?.targets ?? 0} people`, MousePointerClick],
          ["Report rate", overview?.targets ? pct(overview.report_rate) : "—", "People who reported it", Flag],
          ["Training done", pct(overview?.training?.completion_rate), `${overview?.training?.completed ?? 0} of ${overview?.training?.assigned ?? 0} assigned`, GraduationCap],
        ].map(([l, v, sub, Icon]: any) => (
          <div key={l} className="stat-card">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-surface-500"><span>{l}</span><Icon className="w-4 h-4" /></div>
            <div className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{v}</div>
            <div className="text-[11px] text-surface-500">{sub}</div>
          </div>
        ))}
      </motion.div>

      {showNew && canManage && (
        <motion.div variants={fadeUp} className="stat-card space-y-4">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white">New phishing exercise</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-surface-500">Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. October password-expiry test"
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-surface-100 dark:bg-white/[0.05] outline-none border border-transparent focus:border-brand-500 text-surface-900 dark:text-white" />
            </div>
            <div>
              <label className="text-xs text-surface-500">Who receives it</label>
              <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-surface-100 dark:bg-white/[0.05] outline-none text-surface-900 dark:text-white">
                <option value="">Everyone</option>
                {depts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {templates.map(t => (
              <button key={t.key} onClick={() => setForm({ ...form, template_key: t.key })}
                className={`text-left p-3 rounded-xl border text-xs ${form.template_key === t.key ? "border-brand-500 bg-brand-600/5" : "border-surface-200 dark:border-white/[0.06]"}`}>
                <p className="font-semibold text-surface-900 dark:text-white">{t.name}</p>
                <p className="text-surface-500 mt-0.5">{t.category}</p>
                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${t.difficulty_level === 1 ? "bg-emerald-500/10 text-emerald-600" : t.difficulty_level === 2 ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"}`}>{t.difficulty}</span>
              </button>
            ))}
          </div>
          {tpl && (
            <div className="text-xs rounded-xl bg-surface-50 dark:bg-white/[0.03] border border-surface-100 dark:border-white/[0.05] p-3">
              <p className="text-surface-500">Subject employees will see</p>
              <p className="font-semibold text-surface-900 dark:text-white mb-2">{tpl.subject}</p>
              <p className="text-surface-500">Red flags it teaches</p>
              <ul className="list-disc ml-4 text-surface-600 dark:text-surface-300">{tpl.red_flags.map((f: string) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
          <button disabled={form.name.trim().length < 3 || !form.template_key || busy === "create"}
            onClick={() => run("create", async () => {
              await api("/admin/awareness/campaigns", "POST", { name: form.name.trim(), template_key: form.template_key, department_id: form.department_id ? Number(form.department_id) : null });
              toast("Exercise created. Launch it when you are ready."); setForm(f => ({ ...f, name: "" })); setShowNew(false);
            })}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50">
            {busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create exercise
          </button>
        </motion.div>
      )}

      {overview?.departments?.length > 0 && (
        <motion.div variants={fadeUp} className="stat-card">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-brand-500" /> Click rate by department</h2>
          <div className="space-y-2">
            {overview.departments.map((d: any) => (
              <div key={d.department} className="text-xs">
                <div className="flex justify-between text-surface-600 dark:text-surface-300"><span>{d.department}</span><span>{d.clicked} of {d.targets} clicked • {d.reported} reported</span></div>
                <div className="h-1.5 mt-1 rounded-full bg-surface-100 dark:bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full bg-red-500" style={{ width: `${Math.round(d.click_rate * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          {overview.repeat_clickers > 0 && <p className="text-[11px] text-surface-500 mt-3">{overview.repeat_clickers} people clicked in more than one exercise; consider assigning extra training.</p>}
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="stat-card">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-white mb-3">Exercises</h2>
        {campaigns.length === 0 ? <p className="text-sm text-surface-500 py-6 text-center">No exercises yet. {canManage ? "Press New exercise to run your first." : ""}</p> : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <div key={c.campaign_id} className="rounded-xl border border-surface-200 dark:border-white/[0.06] overflow-hidden">
                <button onClick={() => showDetail(c.campaign_id)} className="w-full text-left p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">{c.name}</p>
                    <p className="text-[11px] text-surface-500">{c.template} • {c.difficulty} • {c.targets} people • <span className="capitalize">{c.status}</span></p>
                  </div>
                  <div className="flex gap-5 text-xs text-surface-500">
                    <span>sent <b className="text-surface-800 dark:text-white">{c.sent}</b></span>
                    <span>clicked <b className="text-red-600 dark:text-red-400">{c.clicked}</b> ({pct(c.click_rate)})</span>
                    <span>reported <b className="text-emerald-600 dark:text-emerald-400">{c.reported}</b></span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${open === c.campaign_id ? "rotate-180" : ""}`} />
                </button>
                {open === c.campaign_id && (
                  <div className="border-t border-surface-100 dark:border-white/[0.05] p-4 space-y-4">
                    {canManage && c.status !== "closed" && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => run(c.campaign_id + "l", async () => { await api(`/admin/awareness/campaigns/${c.campaign_id}/launch?send_email=true`, "POST"); toast("Launched. AegisOne is emailing each person their own link."); })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white"><Send className="w-3.5 h-3.5" /> Launch &amp; email</button>
                        <button onClick={() => run(c.campaign_id + "x", async () => { await api(`/admin/awareness/campaigns/${c.campaign_id}/launch`, "POST"); await downloadCsv(c.campaign_id); })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-100 dark:bg-white/[0.06] text-surface-700 dark:text-surface-200"><Download className="w-3.5 h-3.5" /> Launch &amp; export links</button>
                        {c.status === "active" && <button onClick={() => run(c.campaign_id + "c", async () => { await api(`/admin/awareness/campaigns/${c.campaign_id}/close`, "POST"); })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-surface-300 dark:border-white/[0.1] text-surface-600"><Lock className="w-3.5 h-3.5" /> Close</button>}
                      </div>
                    )}
                    {!detail ? <Loader2 className="w-4 h-4 animate-spin text-surface-400" /> : (
                      <>
                        <div className="text-xs"><p className="font-semibold text-surface-700 dark:text-surface-200 mb-1">What the message looked like: “{detail.template?.subject}”</p>
                          <ul className="list-disc ml-4 text-surface-500">{(detail.template?.red_flags || []).map((f: string) => <li key={f}>{f}</li>)}</ul></div>
                        <div className="overflow-x-auto"><table className="w-full text-xs text-left">
                          <thead className="text-surface-400"><tr><th className="py-1 pr-4">Person</th><th className="pr-4">Department</th><th className="pr-4">Result</th><th className="pr-4">Clicked at</th><th>Training</th></tr></thead>
                          <tbody>{detail.people.map((p: any) => (
                            <tr key={p.user_id} className="border-t border-surface-100 dark:border-white/[0.04]">
                              <td className="py-1.5 pr-4 text-surface-800 dark:text-surface-100">{p.name}<div className="text-[10px] text-surface-400">{p.email}</div></td>
                              <td className="pr-4 text-surface-500">{p.department || "—"}</td>
                              <td className="pr-4"><span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${OUTCOME[p.outcome]}`}>{p.outcome}</span></td>
                              <td className="pr-4 text-surface-500">{p.clicked_at ? new Date(p.clicked_at).toLocaleString() : "—"}</td>
                              <td className="text-surface-500">{p.training_status || "—"}</td>
                            </tr>))}</tbody></table></div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
