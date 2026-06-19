"use client";
import { organizations, users, getGlobalStats } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { Globe, Plus, Trash2, Send, ShieldCheck, AlertCircle, Building2, ExternalLink } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function OrganizationsPage() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState(() => organizations.getAll());
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form States
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [plan, setPlan] = useState<"starter" | "professional" | "enterprise">("enterprise");
  const [broadcastTarget, setBroadcastTarget] = useState<string | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState("");

  if (!user || user.role !== "global_admin") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
        <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Access Denied</h3>
        <p className="text-sm text-surface-500 max-w-xs mt-1">Only global platform administrators can manage tenant organizations.</p>
      </div>
    );
  }

  // Pre-calculate user counts per organization
  const orgStats = useMemo(() => {
    const allUsers = users.getAll();
    return orgs.reduce((acc, org) => {
      const orgUsers = allUsers.filter(u => u.organization === org.id);
      acc[org.id] = {
        adminsCount: orgUsers.filter(u => u.role === "super_admin").length,
        supervisorsCount: orgUsers.filter(u => u.role === "office_admin").length,
        employeesCount: orgUsers.filter(u => u.role === "employee").length,
        total: orgUsers.length,
      };
      return acc;
    }, {} as Record<string, { adminsCount: number; supervisorsCount: number; employeesCount: number; total: number }>);
  }, [orgs]);

  const handleAddOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !domain) return;
    organizations.add(name, domain, plan);
    setOrgs(organizations.getAll());
    setName("");
    setDomain("");
    setPlan("enterprise");
    setShowAddModal(false);
  };

  const handleDeleteOrg = (id: string) => {
    if (confirm("Are you sure you want to remove this tenant organization? All tenant users and configuration will be disconnected.")) {
      organizations.delete(id);
      setOrgs(organizations.getAll());
    }
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (broadcastTarget) {
      organizations.sendBroadcast(broadcastTarget);
      setOrgs(organizations.getAll());
      setBroadcastTarget(null);
      setBroadcastMessage("");
      alert("Broadcast alert dispatched to the tenant administrators successfully.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Building2 className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Tenant Organizations
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Global multi-tenant control directory
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Tenant
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-xs text-surface-500">Active Tenants</div>
          <div className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{orgs.length}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-surface-500">Enterprise Plan Tenants</div>
          <div className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
            {orgs.filter(o => o.plan === "enterprise").length}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-surface-500">Active Warning Signals</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
            {orgs.reduce((sum, o) => sum + o.activeAlertsCount, 0)}
          </div>
        </div>
      </div>

      {/* Organizations Directory */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] bg-surface-50/50 dark:bg-white/[0.01]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Organization Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Domain</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Service Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Tenant Users</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Active Communications</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Onboarding Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => {
                const stats = orgStats[org.id] || { adminsCount: 0, supervisorsCount: 0, employeesCount: 0, total: 0 };
                return (
                  <tr key={org.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-surface-900 dark:text-white">{org.name}</div>
                      <div className="text-[10px] text-surface-400">ID: {org.id}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 text-surface-700 dark:text-surface-300">
                        {org.domain}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                        org.plan === "enterprise" 
                          ? "bg-purple-500/10 text-purple-650 dark:text-purple-400" 
                          : org.plan === "professional" 
                          ? "bg-brand-500/10 text-brand-650 dark:text-brand-400" 
                          : "bg-surface-100 text-surface-600 dark:bg-surface-850 dark:text-surface-400"
                      }`}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-surface-800 dark:text-surface-200 font-medium">
                        {stats.total} total
                      </div>
                      <div className="text-[10px] text-surface-500">
                        {stats.adminsCount} Admin · {stats.supervisorsCount} Supervisor · {stats.employeesCount} User
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {org.activeAlertsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-450 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" /> {org.activeAlertsCount} Alerts Dispatched
                        </span>
                      ) : (
                        <span className="text-xs text-surface-400">System clear</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-surface-500">
                      {org.createdAt}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setBroadcastTarget(org.id)}
                          className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-white/[0.04] text-surface-500 hover:text-brand-500 transition-colors"
                          title="Broadcast Alert to Admins"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteOrg(org.id)}
                          className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-white/[0.04] text-surface-400 hover:text-red-500 transition-colors"
                          title="Remove Tenant Organization"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Organization */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] w-full max-w-md rounded-xl shadow-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06]">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Register Tenant Organization</h3>
                <p className="text-xs text-surface-500 mt-1">Deploy AegisOne AI security nodes for a client tenant</p>
              </div>
              <form onSubmit={handleAddOrg} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Organization Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Bank of Punjab"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Corporate Domain</label>
                  <input
                    type="text"
                    required
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    placeholder="e.g. bop.com.pk"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Service Plan</label>
                  <select
                    value={plan}
                    onChange={e => setPlan(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50"
                  >
                    <option value="starter">Starter Plan</option>
                    <option value="professional">Professional Plan</option>
                    <option value="enterprise">Enterprise Plan</option>
                  </select>
                </div>
                <div className="flex gap-3 justify-end pt-2 border-t border-surface-200 dark:border-white/[0.06]">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-medium text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors">Deploy Node</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Broadcast Alert */}
      <AnimatePresence>
        {broadcastTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBroadcastTarget(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] w-full max-w-md rounded-xl shadow-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06]">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-brand-500" /> Alert Tenant Admin
                </h3>
                <p className="text-xs text-surface-500 mt-1">Send a priority platform warning or update notification directly to this tenant's administration panel.</p>
              </div>
              <form onSubmit={handleSendBroadcast} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Notification Message</label>
                  <textarea
                    required
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                    placeholder="e.g. Critical AI engine latency alert for your domain nodes. Recommended update to model version 2.4."
                    rows={4}
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500/50 resize-none"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2 border-t border-surface-200 dark:border-white/[0.06]">
                  <button type="button" onClick={() => setBroadcastTarget(null)} className="px-4 py-2 text-xs font-medium text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" /> Dispatch Alert
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
