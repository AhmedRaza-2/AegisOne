import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Loader2, Check, X, RotateCcw, ShieldCheck, AlertCircle, Layers, Ban } from 'lucide-react';

/**
 * Vendor-side Model Hub: organizations submit improved URL-model weights (trained on their own
 * servers); the hub benchmarks each one against the CURRENT global model and promotes it when it
 * is better and regresses nothing. This panel shows the queue, the measurements, and lets a vendor
 * admin override the automatic decision. It talks to the hub API (backend run with AEGIS_VENDOR_MODE=1).
 */
const DEFAULT_HUB = (import.meta as any).env?.VITE_VENDOR_HUB_URL || '';

const pct = (v: any) => (v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`);

const STATUS: Record<string, string> = {
  received: 'bg-slate-100 text-slate-600',
  evaluating: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  failed: 'bg-amber-50 text-amber-700',
};

export default function ModelHubPanel() {
  const [hub, setHub] = useState<string>(() => { try { return sessionStorage.getItem('hub_url') || DEFAULT_HUB; } catch { return DEFAULT_HUB; } });
  const [key, setKey] = useState<string>(() => { try { return sessionStorage.getItem('hub_key') || ''; } catch { return ''; } });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const api = useCallback(async (path: string, method = 'GET', body?: any) => {
    const res = await fetch(`${hub.replace(/\/$/, '')}${path}`, {
      method, headers: { 'X-Vendor-Admin-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Hub returned ${res.status}`);
    return data;
  }, [hub, key]);

  const load = useCallback(async () => {
    setError('');
    try {
      const [o, s, r] = await Promise.all([api('/vendor/admin/overview'), api('/vendor/admin/submissions'), api('/vendor/admin/releases')]);
      setOverview(o); setSubs(s); setReleases(r); setConnected(true);
      try { sessionStorage.setItem('hub_url', hub); sessionStorage.setItem('hub_key', key); } catch { /* storage may be blocked */ }
    } catch (e: any) {
      setConnected(false); setError(e.message || 'Could not reach the Model Hub.');
    }
  }, [api, hub, key]);

  useEffect(() => { if (hub && key) load(); /* auto-connect when remembered for this tab */ }, []); // eslint-disable-line

  useEffect(() => {
    if (!connected || !subs.some(s => s.status === 'received' || s.status === 'evaluating')) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [connected, subs, load]);

  const showDetail = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setDetail(null);
    try { setDetail(await api(`/vendor/admin/submissions/${id}`)); } catch (e: any) { setError(e.message); }
  };

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try { await api(`/vendor/admin/submissions/${id}/decision`, 'POST', { action }); await load(); if (open === id) setDetail(await api(`/vendor/admin/submissions/${id}`)); }
    catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const withdraw = async (id: string) => {
    setBusy(id);
    try { await api(`/vendor/admin/releases/${id}/withdraw`, 'POST'); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  if (!connected) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-xl">
        <h2 className="text-lg font-bold flex items-center gap-2"><Layers className="w-5 h-5 text-[#0A5ED6]" /> Model Hub</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Connect to the AegisOne Model Hub to review improved model weights submitted by customer organizations.</p>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Hub URL</label>
        <input value={hub} onChange={e => setHub(e.target.value)} placeholder="https://hub.example.com:8443"
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-[#0A5ED6]" />
        <label className="block text-xs font-semibold text-slate-600 mb-1">Vendor admin key</label>
        <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="VENDOR_ADMIN_KEY"
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-[#0A5ED6]" />
        {error && <p className="text-xs text-red-600 flex items-center gap-1.5 mb-3"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>}
        <button onClick={load} disabled={!hub || !key} className="bg-[#0A5ED6] text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50">Connect</button>
        <p className="text-[11px] text-slate-400 mt-3">The key is kept only for this browser tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Model Hub</h1>
          <p className="text-xs text-slate-500 mt-1">
            Current global baseline: <b>{overview?.current_baseline}</b> • {overview?.organizations_contributing} organization(s) contributing •
            auto-promotion {overview?.auto_promote ? 'ON' : 'OFF'}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Promotion rule (applied automatically)</p>
        A submission is promoted only if, on benchmark data no organization has seen, the reference AUC does not fall by more than {pct(overview?.gate?.max_auc_drop)},
        false alarms do not rise by more than {pct(overview?.gate?.max_fpr_rise)}, recall does not fall by more than {pct(overview?.gate?.max_recall_drop)},
        and at least one headline metric improves by {pct(overview?.gate?.min_gain)} or more.
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <tr><th className="px-5 py-3">Submission</th><th className="px-5 py-3">Organization</th><th className="px-5 py-3">Received</th><th className="px-5 py-3">Verdict</th><th className="px-5 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {subs.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">No submissions yet.</td></tr>}
            {subs.map(s => (
              <React.Fragment key={s.submission_id}>
                <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => showDetail(s.submission_id)}>
                  <td className="px-5 py-3 font-mono text-xs">{s.submission_id}</td>
                  <td className="px-5 py-3">{s.org_name || s.organization_id}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{s.created_at ? new Date(s.created_at).toLocaleString() : ''}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS[s.status] || STATUS.received}`}>{s.status}</span>
                    {s.decided_by && <span className="text-[10px] text-slate-400 ml-2">by {s.decided_by}</span>}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    {s.status === 'rejected' && <button onClick={() => act(s.submission_id, 'approve')} disabled={busy === s.submission_id + 'approve'} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline mr-3">{busy === s.submission_id + 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Override: approve</button>}
                    {s.status === 'approved' && !s.release_id && <button onClick={() => act(s.submission_id, 'approve')} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline mr-3"><Check className="w-3 h-3" /> Promote</button>}
                    {(s.status === 'approved' && s.release_id) ? null : s.status !== 'rejected' && <button onClick={() => act(s.submission_id, 'reject')} className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:underline mr-3"><X className="w-3 h-3" /> Reject</button>}
                    <button onClick={() => act(s.submission_id, 'reevaluate')} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:underline"><RotateCcw className="w-3 h-3" /> Re-evaluate</button>
                  </td>
                </tr>
                {open === s.submission_id && (
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <td colSpan={5} className="px-5 py-4 text-xs">
                      {!detail ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : (
                        <div className="space-y-3">
                          {detail.reason && <p className="text-slate-600"><b>Reason:</b> {detail.reason}</p>}
                          {detail.evaluation?.base && Object.keys(detail.evaluation.base).map(set => (
                            <div key={set}>
                              <p className="font-semibold text-slate-700 mb-1">{set.replace(/_/g, ' ')} ({detail.evaluation.base[set].n} URLs)</p>
                              <table className="text-left w-full max-w-lg">
                                <thead className="text-slate-400"><tr><th className="py-0.5 pr-4">Measure</th><th className="pr-4">Current</th><th>Submission</th></tr></thead>
                                <tbody>
                                  {[['AUC', 'auc'], ['F1', 'f1'], ['Recall', 'recall'], ['False alarms', 'fpr']].map(([l, k]) => (
                                    <tr key={k}><td className="py-0.5 pr-4 text-slate-600">{l}</td><td className="pr-4">{k === 'auc' ? Number(detail.evaluation.base[set][k]).toFixed(4) : pct(detail.evaluation.base[set][k])}</td>
                                      <td className="font-semibold">{k === 'auc' ? Number(detail.evaluation.candidate[set][k]).toFixed(4) : pct(detail.evaluation.candidate[set][k])}</td></tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                          <p className="text-slate-400">Compared against: {detail.baseline || 'shipped base'} • checksum {String(detail.checksum).slice(0, 16)}…</p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-bold mb-3">Global releases</h2>
        {releases.length === 0 ? <p className="text-xs text-slate-400">None yet. The shipped base model is the only version.</p> : (
          <div className="space-y-2">
            {releases.map(r => (
              <div key={r.release_id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-lg p-3 text-xs">
                <div><b>{r.version_tag}</b> <span className="text-slate-400 font-mono ml-1">{r.release_id}</span>
                  <p className="text-slate-500 mt-0.5">from {r.source_org_id || '—'} • {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</p></div>
                {r.status === 'active'
                  ? <button onClick={() => withdraw(r.release_id)} disabled={busy === r.release_id} className="inline-flex items-center gap-1 font-bold text-red-700 hover:underline"><Ban className="w-3 h-3" /> Withdraw</button>
                  : <span className="text-slate-400 font-semibold uppercase">{r.status}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
