"use client";
import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Shield, LayoutDashboard, Search, History, AlertTriangle, Users, Settings,
  Activity, FileBarChart, LogOut, ChevronLeft, ChevronRight, Bell, Menu, X,
  UserCog, BarChart3, ClipboardList, ShieldCheck, Scan, Flag, Sun, Moon, Globe,
  Download, Key, Image, Monitor, Server, Clock, TrendingUp, Lightbulb, User, BrainCircuit, ShieldAlert, Building2, FileText, MessageSquare, Network, Puzzle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getRoleBadge } from "@/lib/mock-data";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

const navByRole: Record<string, NavItem[]> = {
  employee: [
    { label: "Security Overview", href: "/dashboard/employee", icon: ShieldCheck },
    { label: "Browser Protection", href: "/dashboard/employee/browser", icon: Puzzle },
    { label: "Threat Center", href: "/dashboard/employee/threats", icon: ShieldAlert },
    { label: "Manual Scan", href: "/dashboard/employee/scan", icon: Scan },
    { label: "History", href: "/dashboard/employee/history", icon: History },
    { label: "Account Settings", href: "/dashboard/employee/settings", icon: Settings },
  ],
  manager: [
    { label: "Dashboard", href: "/dashboard/supervisor", icon: LayoutDashboard },
    { label: "Employees", href: "/dashboard/supervisor/employees", icon: Users },
    { label: "Threat Center", href: "/dashboard/supervisor/threats", icon: ShieldAlert },
    { label: "Communication", href: "/dashboard/supervisor/communication", icon: MessageSquare },
    { label: "Inter-Department", href: "/dashboard/supervisor/inter-department", icon: Network },
    { label: "Reports", href: "/dashboard/supervisor/reports", icon: FileBarChart },
    { label: "Settings", href: "/dashboard/supervisor/settings", icon: Settings },
  ],
  admin: [
    { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Users", href: "/dashboard/admin/users", icon: Users },
    { label: "Departments", href: "/dashboard/admin/departments", icon: Building2 },
    { label: "Devices", href: "/dashboard/admin/devices", icon: Monitor },
    { label: "Incidents", href: "/dashboard/admin/incidents", icon: AlertTriangle },
    { label: "Audit Logs", href: "/dashboard/admin/audit", icon: ClipboardList },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
  ],
  super_admin: [
    { label: "Platform Overview", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Organizations", href: "/dashboard/admin/organizations", icon: Globe },
    { label: "AI Models", href: "/dashboard/admin/models", icon: Activity },
    { label: "Global Settings", href: "/dashboard/admin/settings", icon: Settings },
  ],
};

function SidebarContent({
  collapsed,
  navItems,
  pathname,
  router,
  initials,
  user,
  roleBadge,
  handleLogout,
  setMobileOpen,
  theme,
  toggleTheme,
}: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetting(true);
    setVerifyMsg("");
    setVerifyError("");
    try {
      await fetch("http://127.0.0.1:8000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email })
      });
      setShowOtpModal(true);
      setVerifyMsg("A 6-digit verification code has been sent to your email.");
      setMenuOpen(false);
    } catch(e) {
      alert("Failed to send reset code.");
    }
    setResetting(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetting(true);
    setVerifyError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email, otp })
      });
      if (!res.ok) {
        throw new Error("Invalid verification code.");
      }
      setVerifyMsg("Success! Your new temporary password has been emailed to you.");
      setOtp("");
      // Keep modal open so the user can log out
    } catch (e: any) {
      setVerifyError(e.message || "Failed to verify code.");
    }
    setResetting(false);
  };
  return (
    <>
      <div className="h-20 flex flex-col justify-center px-6 shrink-0 border-b border-surface-200 dark:border-white/[0.04]">
        {!collapsed ? (
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-brand-600 dark:text-[#4F84F8]">AegisOne</span>
            <span className="text-[10px] text-surface-500 dark:text-surface-400 uppercase tracking-widest mt-0.5">{roleBadge?.label || "Enterprise"} Portal</span>
          </div>
        ) : (
          <div className="mx-auto">
            <ShieldCheck className="w-8 h-8 text-brand-600 dark:text-[#4F84F8]" />
          </div>
        )}
      </div>

      <nav className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item: any) => {
          const active = pathname === item.href || (item.href !== "/dashboard/employee" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-[13px] font-medium transition-all ${
                active
                  ? "bg-surface-100 dark:bg-white/[0.02] text-surface-900 dark:text-white border-l-2 border-brand-500 dark:border-[#4F84F8]"
                  : "text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-white/[0.02] border-l-2 border-transparent"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`shrink-0 ${active ? 'w-4 h-4' : 'w-[15px] h-[15px]'}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 shrink-0 mt-auto border-t border-surface-200 dark:border-white/[0.04] relative">
        {/* OTP Modal */}
        {showOtpModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] shadow-2xl rounded-2xl w-full max-w-sm p-6 relative">
              <button 
                onClick={() => setShowOtpModal(false)}
                className="absolute top-4 right-4 text-surface-400 hover:text-surface-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
                  <Key className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Verify Identity</h3>
                <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Enter the 6-digit code sent to your email</p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {verifyMsg && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-600 dark:text-green-400 text-center">{verifyMsg}</div>}
                {verifyError && <p className="text-sm text-red-500 dark:text-red-400 text-center">{verifyError}</p>}
                
                {!verifyMsg.includes("Success") ? (
                  <>
                    <div>
                      <input
                        type="text"
                        value={otp}
                        onChange={e => setOtp(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        required
                        className="w-full px-4 py-3 bg-white dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-xl text-center tracking-[0.5em] text-xl font-bold text-surface-900 dark:text-white placeholder-surface-300 dark:placeholder-surface-700 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={resetting || otp.length < 6}
                      className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {resetting ? "Verifying..." : "Verify & Reset Password"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors"
                  >
                    Log Out & Use New Password
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        {menuOpen && !collapsed && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] shadow-lg rounded-xl overflow-hidden py-1 z-50">
            <div className="px-4 py-2 text-xs text-surface-500 dark:text-surface-400 font-medium truncate border-b border-surface-100 dark:border-white/[0.04] mb-1">
              {user?.email || "No email available"}
            </div>
            <button onClick={() => { toggleTheme(); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-300 dark:hover:text-white dark:hover:bg-white/[0.04] transition-colors text-left">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
            <button onClick={handlePasswordReset} disabled={resetting} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-300 dark:hover:text-white dark:hover:bg-white/[0.04] transition-colors text-left disabled:opacity-50">
              <Key className="w-4 h-4" />
              {resetting ? "Sending..." : "Reset Password"}
            </button>
            <div className="h-px bg-surface-200 dark:bg-white/[0.08] my-1"></div>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
        
        {!collapsed && (
          <div 
            className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center overflow-hidden shrink-0">
               <span className="text-sm font-bold text-white">{initials}</span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
               <span className="text-sm font-semibold text-surface-900 dark:text-white truncate">{user?.fullName || user?.full_name || user?.name || "User"}</span>
               <span className="text-[10px] text-surface-500 dark:text-surface-400 truncate uppercase tracking-wider font-medium">
                 {roleBadge?.label || user?.role || "Role"} {user?.department ? `• ${user.department}` : ""}
               </span>
            </div>
            <div className="shrink-0 text-surface-400">
              {menuOpen ? <ChevronRight className="w-4 h-4 rotate-90 transition-transform" /> : <ChevronRight className="w-4 h-4 transition-transform" />}
            </div>
          </div>
        )}
        {collapsed && (
          <button onClick={handleLogout} className="mx-auto flex justify-center text-surface-500 hover:text-red-500 transition-colors" title="Logout">
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, theme, toggleTheme, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    
    if (!user) {
      router.replace("/login");
      return;
    }
    const role = user.role;
    if (pathname.startsWith("/dashboard/admin") && role !== "super_admin" && role !== "global_admin") {
      // Allow department_admin to access approvals page
      if ((role === "department_admin" || role === "manager") && pathname === "/dashboard/admin/approvals") {
        setIsAuthorizing(false);
      } else {
        router.replace((role === "department_admin" || role === "manager" || role === "office_admin") ? "/dashboard/supervisor" : "/dashboard/employee");
      }
    } else if (pathname.startsWith("/dashboard/supervisor") && role !== "department_admin" && role !== "office_admin" && role !== "manager") {
      router.replace(role === "super_admin" ? "/dashboard/admin" : "/dashboard/employee");
    } else if (pathname.startsWith("/dashboard/employee") && (role === "super_admin" || role === "global_admin")) {
      router.replace("/dashboard/admin");
    } else if (pathname.startsWith("/dashboard/employee") && (role === "department_admin" || role === "office_admin" || role === "manager")) {
      router.replace("/dashboard/supervisor");
    } else {
      setIsAuthorizing(false);
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading || !user || isAuthorizing) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-[#0F1423] flex items-center justify-center">
        <Shield className="w-8 h-8 text-brand-500 animate-pulse" />
      </div>
    );
  }

  const navItems = navByRole[user.role] || navByRole.employee;
  const roleBadge = getRoleBadge(user.role);
  const userName = user?.fullName || user?.full_name || "Admin User";
  const initials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2);

  const handleLogout = () => { logout(); router.replace("/login"); };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-[#0F1423] flex transition-colors duration-300 font-sans">
      <aside className={`hidden md:flex flex-col border-r border-surface-200 dark:border-white/[0.04] bg-white dark:bg-[#141A29] transition-all duration-300 ${collapsed ? "w-[80px]" : "w-[260px]"} shrink-0 h-screen sticky top-0 z-50`}>
        <SidebarContent
          collapsed={collapsed}
          navItems={navItems}
          pathname={pathname}
          router={router}
          initials={initials}
          user={user}
          roleBadge={roleBadge}
          handleLogout={handleLogout}
          setMobileOpen={setMobileOpen}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-white dark:bg-[#1A2133] border border-surface-200 dark:border-white/[0.1] flex items-center justify-center text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors z-10">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-surface-200 dark:border-white/[0.04] bg-white dark:bg-[#0F1423] flex items-center justify-between px-6 sticky top-0 z-30 transition-colors duration-300">
          <div className="flex-1 flex items-center">
             <button onClick={() => setMobileOpen(true)} className="md:hidden mr-4 p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.04]">
               <Menu className="w-5 h-5 text-surface-500 dark:text-surface-400" />
             </button>
            <div className="relative w-full max-w-md hidden md:block">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
               <input 
                 type="text" 
                 placeholder="Search logs, threats, endpoints..." 
                 className="w-full bg-surface-100 dark:bg-[#141A29] border border-transparent dark:border-transparent rounded-full pl-9 pr-4 py-2 text-sm text-surface-900 dark:text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500 dark:focus:ring-1 dark:focus:ring-brand-500/50 transition-colors"
               />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={toggleTheme} className="text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors">
              {theme === "dark" ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-surface-600" />}
            </button>
            <div className="relative">
              <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors relative flex items-center justify-center">
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white dark:bg-[#0F1423] flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-[#4F84F8]"></span>
                </span>
              </button>
              
              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] shadow-lg rounded-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-surface-100 dark:border-white/[0.04] flex items-center justify-between">
                    <span className="text-sm font-semibold text-surface-900 dark:text-white">Notifications</span>
                    <span className="text-[10px] bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 px-2 py-0.5 rounded-full font-medium">1 New</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    <div className="p-4 border-b border-surface-100 dark:border-white/[0.04] hover:bg-surface-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                          <p className="text-xs text-surface-900 dark:text-white font-medium">IT Manager Replied</p>
                          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">"Thanks for letting us know, we are looking into it now."</p>
                          <p className="text-[10px] text-surface-400 mt-1">Just now</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 border-t border-surface-100 dark:border-white/[0.04]">
                    <button onClick={() => setNotificationsOpen(false)} className="w-full py-1.5 text-xs text-center font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 rounded-lg transition-colors">
                      Mark all as read
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setActivityOpen(!activityOpen)} className="text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors relative flex items-center justify-center">
                 <Activity className="w-4 h-4" />
              </button>
              
              {activityOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] shadow-lg rounded-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-surface-100 dark:border-white/[0.04]">
                    <span className="text-sm font-semibold text-surface-900 dark:text-white">System Performance</span>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-surface-600 dark:text-surface-400">AI Models</span>
                        <span className="text-emerald-500 font-medium">Optimal</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="w-full h-full bg-emerald-500 rounded-full"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-surface-600 dark:text-surface-400">Ingestion Pipelines</span>
                        <span className="text-emerald-500 font-medium">Operational</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="w-full h-full bg-emerald-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="h-5 w-px bg-surface-200 dark:bg-white/[0.1] hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-surface-700 dark:text-surface-400">
               System Status: <span className="flex items-center gap-1.5 text-surface-900 dark:text-white"><span className="w-1.5 h-1.5 rounded-full bg-[#4F84F8] animate-pulse shadow-[0_0_8px_#4F84F8]"></span> Operational</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 text-surface-900 dark:text-white overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
