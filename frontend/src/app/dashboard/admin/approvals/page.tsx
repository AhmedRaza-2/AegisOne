"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle2, XCircle, ShieldAlert, Shield, Users, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const token = localStorage.getItem("aegis_token");
        const res = await fetch("http://localhost:9000/admin/users/pending", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPendingUsers(data.pending);
        }
      } catch (err) {
        console.error("Failed to fetch pending users", err);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchPending();
  }, [user]);

  const handleAction = async (userId: string, status: "approved" | "rejected") => {
    setActionLoading(userId);
    try {
      const token = localStorage.getItem("aegis_token");
      const res = await fetch(`http://localhost:9000/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status, reason: status === "rejected" ? "Rejected by admin" : undefined })
      });
      if (res.ok) {
        setPendingUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        alert("Action failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = pendingUsers.filter(u => 
    u.full_name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <ShieldAlert className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Pending Approvals
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Review and approve registration requests for your organization.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input 
            type="text" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search pending requests..." 
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 transition-all" 
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-white/[0.06] bg-surface-50/50 dark:bg-white/[0.01]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500">Registration Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-surface-500">
                    Loading pending requests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-surface-100 dark:bg-white/[0.02] flex items-center justify-center mb-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <p className="text-surface-600 dark:text-surface-300 font-medium">All caught up!</p>
                      <p className="text-xs text-surface-400 mt-1">There are no pending accounts to review.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-100/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center text-xs font-bold text-brand-650 dark:text-brand-400 uppercase">
                          {u.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-surface-800 dark:text-surface-200">{u.full_name}</div>
                          <div className="text-[10px] text-surface-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-surface-700 dark:text-surface-300">
                      {u.department}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-surface-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleAction(u.id, "approved")}
                          disabled={actionLoading === u.id}
                          className="px-3 py-1.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button 
                          onClick={() => handleAction(u.id, "rejected")}
                          disabled={actionLoading === u.id}
                          className="px-3 py-1.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
