import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Check, X, Loader2, LogOut, Lock, Trash2, Search, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { getOrganizations, updateOrganizationStatus, deleteOrganization, logoutOrganization } from '../lib/org-service';
import type { Organization } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'active' | 'suspended'>('all');
  const navigate = useNavigate();

  // Always require manual login when accessing /admin
  useEffect(() => {
    (async () => {
      // Force sign out any existing session to start fresh and require login
      await supabase.auth.signOut().catch(() => { });
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrgs();
    }
  }, [isAuthenticated]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setAuthError('');
    try {
      // 1. Sign out any current tenant session first to prevent conflicts
      await supabase.auth.signOut();

      // 2. Sign in as Super Admin
      const adminEmailConfig = import.meta.env.VITE_ADMIN_EMAIL || 'araza2125012.pgc@gmail.com';
      if (adminEmail.toLowerCase() !== adminEmailConfig.toLowerCase()) {
        throw new Error("Access Denied: Email is not registered as a Super Administrator.");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

      if (error) throw error;

      setIsAuthenticated(true);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid email or password.');
    } finally {
      setLoggingIn(false);
    }
  };

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const data = await getOrganizations();
      setOrgs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm("Approve this organization and grant portal access?")) return;
    try {
      await updateOrganizationStatus(id, 'active');
      setOrgs(orgs.map(o => o.id === id ? { ...o, status: 'active' } : o));
    } catch (e) {
      console.error(e);
      alert("Failed to approve organization");
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Enter reason for rejection (this will be shown to the user):");
    if (reason === null) return;

    try {
      await updateOrganizationStatus(id, 'suspended', reason || 'Registration rejected by administrator');
      setOrgs(orgs.map(o => o.id === id ? { ...o, status: 'suspended', product_version: reason } : o));
    } catch (e) {
      console.error(e);
      alert("Failed to reject organization");
    }
  };

  const handleSuspend = async (id: string) => {
    const reason = window.prompt("Enter reason for suspension:");
    if (reason === null) return;

    try {
      await updateOrganizationStatus(id, 'suspended', reason || 'Account suspended by administrator');
      setOrgs(orgs.map(o => o.id === id ? { ...o, status: 'suspended', product_version: reason } : o));
    } catch (e) {
      console.error(e);
      alert("Failed to suspend organization");
    }
  };

  const handleActivate = async (id: string) => {
    if (!window.confirm("Re-activate this organization account?")) return;
    try {
      await updateOrganizationStatus(id, 'active');
      setOrgs(orgs.map(o => o.id === id ? { ...o, status: 'active' } : o));
    } catch (e) {
      console.error(e);
      alert("Failed to activate organization");
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (confirmName.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()) {
      alert("Confirmation name does not match the organization's name.");
      return;
    }
    setIsDeleting(true);
    try {
      await deleteOrganization(deleteTarget.id);
      setOrgs(orgs.filter(o => o.id !== deleteTarget.id));
      setDeleteTarget(null);
      setConfirmName('');
    } catch (e: any) {
      console.error(e);
      alert("Failed to delete organization. Please verify your Supabase permissions and ensure the 'delete_organization_and_user' RPC is created.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    await logoutOrganization();
    navigate('/login');
  };

  const filteredOrgs = useMemo(() => {
    return orgs.filter(org => {
      if (statusTab !== 'all' && org.status !== statusTab) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          org.name?.toLowerCase().includes(q) ||
          org.admin_name?.toLowerCase().includes(q) ||
          org.admin_email?.toLowerCase().includes(q) ||
          org.industry?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orgs, statusTab, search]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xl">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Lock className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <div className="text-center mb-8 space-y-2">
              <h1 className="text-2xl font-bold text-[#0F172A]">Super Admin</h1>
              <p className="text-sm text-[#45464D]">Enter your administrator credentials to continue.</p>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Admin Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="admin@aegisone.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0F172A] focus:border-[#0A5ED6] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="Enter Password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm text-[#0F172A] focus:border-[#0A5ED6] outline-none"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {authError && <p className="text-xs text-red-500 text-center">{authError}</p>}
              <button
                type="submit"
                disabled={loggingIn}
                className="w-full bg-[#0A5ED6] hover:bg-[#0B63E0] text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
                  </>
                ) : (
                  'Access Dashboard'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans selection:bg-blue-100 selection:text-blue-900">
      <nav className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0A5ED6]/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#0A5ED6]" />
          </div>
          <span className="font-bold text-[#0F172A] text-sm tracking-tight">AegisOne Platform Control</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Organization Control Center</h1>
            <p className="text-xs text-slate-500 mt-1">Manage registered tenant organizations across Supabase cloud database.</p>
          </div>
          <button
            onClick={fetchOrgs}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Database
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
            {(['all', 'pending', 'active', 'suspended'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${statusTab === tab
                    ? 'bg-white text-[#0A5ED6] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {tab} ({orgs.filter(o => tab === 'all' || o.status === tab).length})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search org name, email, industry..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#0A5ED6]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Contact Person</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions & Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 text-[#0A5ED6] animate-spin mx-auto mb-2" />
                    Loading database records...
                  </td>
                </tr>
              ) : filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                    No organizations found matching your criteria.
                  </td>
                </tr>
              ) : filteredOrgs.map(org => (
                <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-[#0F172A]">{org.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{org.industry || 'General'} · {org.employee_count || 0} employees</p>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium">{org.admin_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{org.admin_email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${org.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        org.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                      }`}>
                      {org.status}
                    </span>
                    {org.status === 'suspended' && org.product_version !== '1.0.0' && (
                      <p className="text-[10px] text-red-500 mt-1 max-w-[160px] truncate" title={org.product_version}>Reason: {org.product_version}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {org.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(org.id)}
                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleReject(org.id)}
                            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {org.status === 'suspended' && (
                        <button
                          onClick={() => handleActivate(org.id)}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Activate
                        </button>
                      )}
                      {org.status === 'active' && (
                        <button
                          onClick={() => handleSuspend(org.id)}
                          className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Suspend
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget({ id: org.id, name: org.name })}
                        title="Permanently Delete"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 shadow-xl transform transition-all scale-100">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2 bg-red-50 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Organization?</h3>
                <p className="text-xs text-slate-500">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              All users, devices, threat telemetry, and configuration logs associated with <strong className="text-slate-900">"{deleteTarget.name}"</strong> will be permanently wiped.
            </p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Type the organization name to confirm:
              </label>
              <input
                type="text"
                placeholder={deleteTarget.name}
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-red-500 font-semibold"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setConfirmName('');
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting || confirmName.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...
                  </>
                ) : (
                  "Confirm Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
