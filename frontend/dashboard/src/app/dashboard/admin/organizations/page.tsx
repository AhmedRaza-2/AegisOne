"use client";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { getApiBaseUrl } from "@/lib/api";
import { Plus, Trash2, Send, AlertCircle, Building2, Loader2, Power, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Org = {
  id: string; name: string; domain: string | null; plan: string; status: "active" | "suspended"; created_at: string | null;
  users_total: number; users_by_role: { admins: number; managers: number; employees: number };
  scans_30d: number; high_alerts_7d: number;
  license?: { status: string; valid: boolean; allowed_users: number | null; expires_at: string | null };
};

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

export default function OrganizationsPage() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [plan, setPlan] = useState("standard");
  const [broadcastTarget, setBroadcastTarget] = useState<Org | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Org | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setOrgs(await api("/admin/organizations")); } catch (e: any) { toast(e.message, "error"); setOrgs([]); }
  }, []);
  useEffect(() => { if (user?.role === "global_admin") load(); }, [user, load]);

  if (!user || user.role !== "global_admin") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
        <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Access Denied</h3>
        <p className="text-sm text-surface-500 max-w-xs mt-1">Only global platform administrators can manage tenant organizations.</p>
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); await load(); } catch (e: any) { toast(e.message || "Something went wrong", "error"); } finally { setBusy(null); }
  };

  const list = orgs || [];
  const totalUsers = list.reduce((n, o) => n + o.users_total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Building2 className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Tenant Organizations
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Organizations hosted on this AegisOne platform, with live figures</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-2 bg-surface-100 hover:bg-surface-200 dark:bg-white/[0.05] text-surface-700 dark:text-surface-200 text-sm font-medium rounded-lg flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> Add Tenant
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ["Organizations", list.length, ""],
          ["Active", list.filter(o => o.status === "active").length, ""],
          ["Accounts", totalUsers, ""],
          ["High alerts (7 days)", list.reduce((n, o) => n + o.high_alerts_7d, 0), "text-yellow-600 dark:text-yellow-400"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="stat-card">
            <div className="text-xs text-surface-500">{l}</div>
            <div className={`text-2xl font-bold mt-1 ${c || "text-surface-900 dark:text-white"}`}>{orgs === null ? "…" : (v as number)}</div>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] bg-surface-50/50 dark:bg-white/[0.01]">
                {["Organization", "Domain", "Plan", "Accounts", "Last 30 days", "Status", "Created", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs === null && <tr><td colSpan={8} className="px-4 py-10 text-center text-surface-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>}
              {orgs !== null && list.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-surface-500">No organizations yet.</td></tr>}
              {list.map(org => (
                <tr key={org.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-surface-900 dark:text-white">{org.name}</div>
                    <div className="text-[10px] text-surface-400">ID: {org.id}</div>
                    {org.license && (
                      <div className={`text-[10px] mt-0.5 ${org.license.valid ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        License {org.license.status}{org.license.allowed_users ? ` • ${org.license.allowed_users} seats` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-surface-700 dark:text-surface-300">{org.domain || <span className="text-surface-400">—</span>}</td>
                  <td className="px-4 py-3.5"><span className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize bg-brand-500/10 text-brand-650 dark:text-brand-400">{org.plan}</span></td>
                  <td className="px-4 py-3.5">
                    <div className="text-surface-800 dark:text-surface-200 font-medium">{org.users_total} total</div>
                    <div className="text-[10px] text-surface-500">{org.users_by_role.admins} Admin · {org.users_by_role.managers} Manager · {org.users_by_role.employees} Employee</div>
                  </td>
                  <td className="px-4 py-3.5 text-xs">
                    <div className="text-surface-700 dark:text-surface-300">{org.scans_30d.toLocaleString()} scans</div>
                    {org.high_alerts_7d > 0
                      ? <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400 font-medium"><AlertCircle className="w-3.5 h-3.5" /> {org.high_alerts_7d} high alerts this week</span>
                      : <span className="text-surface-400">No high alerts</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${org.status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>{org.status}</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-surface-500">{org.created_at ? new Date(org.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setBroadcastTarget(org)} className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-white/[0.04] text-surface-500 hover:text-brand-500" title="Send a notice to this organization's administrators"><Send className="w-4 h-4" /></button>
                      <button disabled={busy === org.id} onClick={() => run(org.id, async () => { await api(`/admin/organizations/${org.id}/status?status=${org.status === "active" ? "suspended" : "active"}`, "PUT"); toast(org.status === "active" ? "Organization suspended." : "Organization reactivated."); })}
                        className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-white/[0.04] text-surface-500 hover:text-amber-500" title={org.status === "active" ? "Suspend" : "Reactivate"}><Power className="w-4 h-4" /></button>
                      <button onClick={() => { setDeleteTarget(org); setConfirmText(""); }} className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-white/[0.04] text-surface-400 hover:text-red-500" title="Delete organization"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] w-full max-w-md rounded-xl shadow-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06]">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Add Tenant Organization</h3>
                <p className="text-xs text-surface-500 mt-1">Creates the organization record. Its first administrator is then provisioned through Organization Setup.</p>
              </div>
              <form onSubmit={e => { e.preventDefault(); run("add", async () => { await api("/admin/organizations", "POST", { name, domain: domain || null, plan }); toast("Organization created."); setShowAdd(false); setName(""); setDomain(""); setPlan("standard"); }); }} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Organization Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bank of Punjab" className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Corporate Domain (optional)</label>
                  <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="e.g. bop.com.pk" className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Service Plan</label>
                  <select value={plan} onChange={e => setPlan(e.target.value)} className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50">
                    <option value="standard">Standard</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="flex gap-3 justify-end pt-2 border-t border-surface-200 dark:border-white/[0.06]">
                  <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs font-medium text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white">Cancel</button>
                  <button type="submit" disabled={busy === "add"} className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg disabled:opacity-60">Create</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {broadcastTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBroadcastTarget(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] w-full max-w-md rounded-xl shadow-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06]">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2"><Send className="w-5 h-5 text-brand-500" /> Notice to {broadcastTarget.name}</h3>
                <p className="text-xs text-surface-500 mt-1">Appears in the notification bell of every administrator of this organization.</p>
              </div>
              <form onSubmit={e => { e.preventDefault(); run("bc", async () => { const r = await api(`/admin/organizations/${broadcastTarget.id}/broadcast`, "POST", { message: broadcastMessage }); toast(`Sent to ${r.recipients} administrator${r.recipients === 1 ? "" : "s"}.`); setBroadcastTarget(null); setBroadcastMessage(""); }); }} className="p-6 space-y-4">
                <textarea required value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} rows={4} placeholder="Write the notice…" className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50 resize-none" />
                <div className="flex gap-3 justify-end pt-2 border-t border-surface-200 dark:border-white/[0.06]">
                  <button type="button" onClick={() => setBroadcastTarget(null)} className="px-4 py-2 text-xs font-medium text-surface-500">Cancel</button>
                  <button type="submit" disabled={busy === "bc"} className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg flex items-center gap-2 disabled:opacity-60"><Send className="w-3.5 h-3.5" /> Send</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteTarget(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-red-300/40 w-full max-w-md rounded-xl shadow-lg relative z-10 overflow-hidden">
              <div className="p-6 space-y-3">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Delete {deleteTarget.name}?</h3>
                <p className="text-sm text-surface-600 dark:text-surface-300">This permanently removes the organization and its {deleteTarget.users_total} account{deleteTarget.users_total === 1 ? "" : "s"} and data. It cannot be undone.</p>
                <label className="block text-xs text-surface-500">Type <b className="font-mono">{deleteTarget.id}</b> to confirm</label>
                <input value={confirmText} onChange={e => setConfirmText(e.target.value)} className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm font-mono text-surface-900 dark:text-white focus:outline-none focus:border-red-500/60" />
                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-xs font-medium text-surface-500">Cancel</button>
                  <button disabled={confirmText !== deleteTarget.id || busy === "del"} onClick={() => run("del", async () => { await api(`/admin/organizations/${deleteTarget.id}?confirm=${encodeURIComponent(confirmText)}`, "DELETE"); toast("Organization deleted."); setDeleteTarget(null); })}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg disabled:opacity-40">Delete permanently</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
