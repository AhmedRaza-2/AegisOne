import { useState, useMemo, useDeferredValue } from "react";
import { users, scanHistory } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { Users, Search, Activity, ShieldAlert, Download, Key, TrendingUp, Sparkles, X, Plus, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function EmployeesPage() {
  const { user } = useAuth();
  const [userList, setUserList] = useState(() => users.getAll());
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  if (!user) return null;

  // Filter users inside the supervisor's department and organization
  const deptEmployees = useMemo(() => {
    return userList.filter(u => 
      u.organization === user.organization && 
      u.department === user.department && 
      u.id !== user.id
    );
  }, [userList, user.department, user.organization, user.id]);

  const employeesWithStats = useMemo(() => {
    return deptEmployees.map(emp => {
      const empScans = scanHistory.filter(s => s.userId === emp.id);
      const threats = empScans.filter(s => s.prediction !== "legitimate");
      const blocked = threats.filter(t => t.category === "phishing" || t.category === "malware");
      
      const score = Math.max(0, 100 - threats.length * 2 - blocked.length * 5);
      let status = "Excellent";
      if (score < 60) status = "Warning";
      else if (score < 80) status = "Needs Attention";

      return {
        ...emp,
        score,
        threatsCount: threats.length,
        blockedCount: blocked.length,
        status,
        downloadsScanned: empScans.filter(s => s.category === "malware").length * 5 + 12,
        credentialEvents: threats.length * 2,
        lastActivity: emp.isActive ? "Just now" : "2 hours ago"
      };
    });
  }, [deptEmployees]);

  const filtered = useMemo(() => {
    if (!deferredSearch) return employeesWithStats;
    const s = deferredSearch.toLowerCase();
    return employeesWithStats.filter(u => u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
  }, [employeesWithStats, deferredSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
            <Users className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Employee Security Analytics
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Department: {user.department} — Aggregated health metrics
          </p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input 
            type="text" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search employees..." 
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:border-brand-500/50 transition-all" 
          />
        </div>
      </div>

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-surface-200 dark:border-white/[0.06]">
              <th className="px-4 py-3 font-medium text-surface-500">Employee</th>
              <th className="px-4 py-3 font-medium text-surface-500 text-right">Score</th>
              <th className="px-4 py-3 font-medium text-surface-500 text-right">Threats</th>
              <th className="px-4 py-3 font-medium text-surface-500 text-right">Blocked</th>
              <th className="px-4 py-3 font-medium text-surface-500">Last Activity</th>
              <th className="px-4 py-3 font-medium text-surface-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-500">No employees found.</td>
              </tr>
            ) : (
              filtered.map(emp => (
                <tr 
                  key={emp.id} 
                  onClick={() => setSelectedEmployee(emp)}
                  className="border-b border-surface-100 dark:border-white/[0.03] hover:bg-surface-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-surface-900 dark:text-white">{emp.fullName}</div>
                    <div className="text-xs text-surface-500">{emp.email}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${emp.score >= 80 ? 'text-emerald-500' : emp.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{emp.score}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">{emp.threatsCount}</td>
                  <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">{emp.blockedCount}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{emp.lastActivity}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-[10px] font-medium rounded-full ${emp.status === 'Excellent' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : emp.status === 'Warning' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                      {emp.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedEmployee(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] w-full max-w-2xl rounded-2xl shadow-xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="p-6 border-b border-surface-200 dark:border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-surface-900 dark:text-white">{selectedEmployee.fullName}</h3>
                  <p className="text-sm text-surface-500">Security Health Profile (Aggregated)</p>
                </div>
                <button onClick={() => setSelectedEmployee(null)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.05] transition-colors"><X className="w-5 h-5 text-surface-500" /></button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.05]">
                    <div className="text-xs text-surface-500 mb-1">Security Score</div>
                    <div className={`text-2xl font-bold ${selectedEmployee.score >= 80 ? 'text-emerald-500' : selectedEmployee.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{selectedEmployee.score}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.05]">
                    <div className="text-xs text-surface-500 mb-1">Threat Count</div>
                    <div className="text-2xl font-bold text-surface-900 dark:text-white">{selectedEmployee.threatsCount}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.05]">
                    <div className="text-xs text-surface-500 mb-1">Blocked Attempts</div>
                    <div className="text-2xl font-bold text-surface-900 dark:text-white">{selectedEmployee.blockedCount}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.05]">
                    <div className="text-xs text-surface-500 mb-1">Risk Trend</div>
                    <div className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-brand-500" /> Stable
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl border border-surface-200 dark:border-white/[0.05]">
                    <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white"><Activity className="w-4 h-4 text-blue-500" /> Protection Statistics</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-2"><Download className="w-4 h-4" /> Downloads Scanned</span>
                        <span className="font-semibold text-surface-900 dark:text-white">{selectedEmployee.downloadsScanned}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-2"><Key className="w-4 h-4" /> Credential Events</span>
                        <span className="font-semibold text-surface-900 dark:text-white">{selectedEmployee.credentialEvents}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Policy Compliance</span>
                        <span className="font-semibold text-emerald-500">100%</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-surface-200 dark:border-white/[0.05] bg-brand-50/50 dark:bg-brand-900/10">
                    <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white"><Sparkles className="w-4 h-4 text-brand-500" /> AI Recommendations</h4>
                    <ul className="space-y-3 text-sm text-surface-600 dark:text-surface-400 list-disc list-inside">
                      {selectedEmployee.score >= 80 ? (
                        <>
                          <li>Employee is maintaining excellent security hygiene.</li>
                          <li>No immediate awareness training required.</li>
                        </>
                      ) : (
                        <>
                          <li>Recommend reviewing "Identifying Phishing Links" training.</li>
                          <li>Employee recently interacted with suspicious credential prompts.</li>
                          <li>Consider a brief check-in regarding recent blocked downloads.</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
