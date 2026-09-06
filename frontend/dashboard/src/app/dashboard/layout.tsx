"use client";
import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  Shield, LayoutDashboard, Search, History, AlertTriangle, Users, Settings,
  Activity, FileBarChart, LogOut, ChevronLeft, ChevronRight, Bell, Menu, X,
  UserCog, BarChart3, ClipboardList, ShieldCheck, Scan, Flag, Sun, Moon, Globe,
  Download, Key, Image, Monitor, Server, Clock, TrendingUp, Lightbulb, User, BrainCircuit, ShieldAlert, Building2, FileText, MessageSquare, Network, Puzzle, Mail
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
    { label: "Email Security", href: "/dashboard/employee/email", icon: Mail },
    { label: "Browser Protection", href: "/dashboard/employee/browser", icon: Puzzle },
    { label: "Threat Center", href: "/dashboard/employee/threats", icon: ShieldAlert },
    { label: "Communication", href: "/dashboard/employee/communication", icon: MessageSquare },
    { label: "Manual Scan", href: "/dashboard/employee/scan", icon: Scan },
    { label: "History", href: "/dashboard/employee/history", icon: History },
  ],
  manager: [
    { label: "Dashboard", href: "/dashboard/supervisor", icon: LayoutDashboard },
    { label: "Employees", href: "/dashboard/supervisor/employees", icon: Users },
    { label: "Email Security", href: "/dashboard/supervisor/email", icon: Mail },
    { label: "Threat Center", href: "/dashboard/supervisor/threats", icon: ShieldAlert },
    { label: "Communication", href: "/dashboard/supervisor/communication", icon: MessageSquare },
    { label: "Reports", href: "/dashboard/supervisor/reports", icon: FileBarChart },
    { label: "My Analytics", href: "/dashboard/supervisor/self", icon: BarChart3 },
    { label: "Browser Extension", href: "/dashboard/supervisor/extension", icon: Puzzle },
  ],
  admin: [
    { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Organization Setup", href: "/dashboard/admin/setup", icon: ShieldCheck },
    { label: "Departments & Users", href: "/dashboard/admin/departments", icon: Building2 },
    { label: "Email Security", href: "/dashboard/admin/email", icon: Mail },
    { label: "Analytics", href: "/dashboard/admin/analytics", icon: BarChart3 },
    { label: "My Analytics", href: "/dashboard/supervisor/self", icon: BarChart3 },
    { label: "Browser Extension", href: "/dashboard/supervisor/extension", icon: Puzzle },
    { label: "Incidents", href: "/dashboard/admin/incidents", icon: AlertTriangle },
    { label: "Communication", href: "/dashboard/admin/communication", icon: MessageSquare },
    { label: "Audit Logs", href: "/dashboard/admin/audit", icon: ClipboardList },
  ],
  super_admin: [
    { label: "Platform Overview", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Organization Setup", href: "/dashboard/admin/setup", icon: ShieldCheck },
    { label: "Organizations", href: "/dashboard/admin/organizations", icon: Globe },
    { label: "Email Security", href: "/dashboard/admin/email", icon: Mail },
    { label: "Analytics", href: "/dashboard/admin/analytics", icon: BarChart3 },
    { label: "My Analytics", href: "/dashboard/supervisor/self", icon: BarChart3 },
    { label: "Browser Extension", href: "/dashboard/supervisor/extension", icon: Puzzle },
    { label: "Communication", href: "/dashboard/admin/communication", icon: MessageSquare },
    { label: "AI Models", href: "/dashboard/admin/models", icon: Activity },
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
  unreadCount,
}: any) {
  return (
    <>
      <div className="h-16 flex flex-col justify-center px-6 shrink-0 border-b border-surface-200 dark:border-white/[0.04]">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AegisOne Logo" className="w-9 h-9 object-contain shrink-0" />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-brand-600 dark:text-[#4F84F8]">AegisOne</span>
              <span className="text-[10px] text-surface-500 dark:text-surface-400 uppercase tracking-widest mt-0.5">{roleBadge?.label || "Enterprise"} Portal</span>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex justify-center">
            <img src="/logo.png" alt="AegisOne Logo" className="w-8 h-8 object-contain" />
          </div>
        )}
      </div>

      <nav className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item: any) => {
          const isRoot = item.href === "/dashboard/admin" || item.href === "/dashboard/supervisor" || item.href === "/dashboard/employee";
          const active = isRoot ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              prefetch={true}
              className={`w-full flex items-center gap-3 px-6 py-3 text-[13px] font-medium transition-all relative ${active
                ? "bg-surface-100 dark:bg-white/[0.02] text-surface-900 dark:text-white border-l-2 border-brand-500 dark:border-[#4F84F8]"
                : "text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-white/[0.02] border-l-2 border-transparent"
                }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`shrink-0 ${active ? 'w-4 h-4' : 'w-[15px] h-[15px]'}`} />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}

              {item.label === "Communication" && unreadCount > 0 && (
                collapsed ? (
                  <div className="absolute top-3 right-4 w-2 h-2 rounded-full bg-brand-500"></div>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 shrink-0 mt-auto border-t border-surface-200 dark:border-white/[0.04] relative">
        {!collapsed && (
          <div className="flex items-center gap-3 p-2 -m-2 rounded-lg transition-colors">
            <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center overflow-hidden shrink-0">
              <span className="text-sm font-bold text-white">{initials}</span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-surface-900 dark:text-white truncate">{user?.fullName || user?.full_name || user?.name || "User"}</span>
              <span className="text-[10px] text-surface-500 dark:text-surface-400 truncate uppercase tracking-wider font-medium">
                {roleBadge?.label || user?.role || "Role"}{(user?.role === "admin" || user?.role === "super_admin") ? "" : (user?.department ? ` • ${user.department.split(' ').map((w: string) => w[0]).join('').substring(0, 4).toUpperCase()}` : "")}
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex justify-center text-surface-500" title="User Profile">
            <User className="w-5 h-5" />
          </div>
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
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isDragging, setIsDragging] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<any[]>([]);
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [apiOffline, setApiOffline] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const notificationsRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (activityRef.current && !activityRef.current.contains(target)) {
        setActivityOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, 200), 500);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const checkHealth = () => {
      fetch("http://localhost:8000/health")
        .then(res => res.json())
        .then(data => {
          setSystemHealth(data);
          setApiOffline(false);
        })
        .catch(err => {
          console.error("Health fetch failed", err);
          setApiOffline(true);
        });
    };

    // Check immediately on mount
    checkHealth();

    // Then poll every 10 seconds
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }
    const role = user.role;
    // Allow any authenticated role to access email security pages
    if (pathname.includes("/email")) {
      return;
    }

    if (pathname.startsWith("/dashboard/admin") && role !== "super_admin" && role !== "global_admin" && role !== "admin") {
      // Allow department_admin to access approvals page
      if ((role === "department_admin" || role === "manager" || role === "office_admin") && (pathname === "/dashboard/admin/approvals" || pathname === "/dashboard/admin/email")) {
        // allowed
      } else {
        router.replace((role === "department_admin" || role === "manager" || role === "office_admin") ? "/dashboard/supervisor" : "/dashboard/employee");
      }
    } else if (pathname.startsWith("/dashboard/supervisor") && role !== "department_admin" && role !== "office_admin" && role !== "manager") {
      if ((role === "admin" || role === "super_admin" || role === "global_admin") && (pathname === "/dashboard/supervisor/extension" || pathname === "/dashboard/supervisor/self" || pathname === "/dashboard/supervisor/email")) {
        // allowed
      } else {
        router.replace(role === "super_admin" || role === "admin" || role === "global_admin" ? "/dashboard/admin" : "/dashboard/employee");
      }
    } else if (pathname.startsWith("/dashboard/employee") && (role === "super_admin" || role === "global_admin" || role === "admin")) {
      if (!pathname.includes("/email")) {
        router.replace("/dashboard/admin");
      }
    } else if (pathname.startsWith("/dashboard/employee") && (role === "department_admin" || role === "office_admin" || role === "manager")) {
      if (!pathname.includes("/email")) {
        router.replace("/dashboard/supervisor");
      }
    }
  }, [user, isLoading, router, pathname]);

  // Poll for new inbox messages every 30 seconds
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    const fetchInbox = () => {
      const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
      // Skip if no valid token
      if (!token || token.startsWith("token_setup_")) return;
      fetch("http://localhost:8000/communication/inbox", {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => {
          if (res.status === 401) {
            // Token expired — stop polling to prevent log spam
            stopped = true;
            clearInterval(interval);
            return null;
          }
          return res.ok ? res.json() : null;
        })
        .then(data => {
          if (Array.isArray(data)) setInboxMessages(data);
        })
        .catch(() => { });
    };
    fetchInbox();
    const interval = setInterval(() => {
      if (!stopped) fetchInbox();
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const [showExtensionReminder, setShowExtensionReminder] = useState(false);

  // First-time & repeating Extension Setup Popup logic
  useEffect(() => {
    if (!user) return;
    const userKey = `aegis_ext_setup_ack_${user.email || user.id}`;
    const acknowledged = localStorage.getItem(userKey);

    if (!acknowledged) {
      // Prompt modal after initial 2 seconds
      const initialTimer = setTimeout(() => {
        setShowExtensionReminder(true);
      }, 2000);

      return () => clearTimeout(initialTimer);
    }
  }, [user]);

  const handleAcknowledgeExtension = () => {
    if (!user) return;
    const userKey = `aegis_ext_setup_ack_${user.email || user.id}`;
    localStorage.setItem(userKey, "true");
    setShowExtensionReminder(false);
  };

  const handleRefuseExtension = () => {
    setShowExtensionReminder(false);
    // If refused or closed without acknowledging, remind again after 45 seconds
    setTimeout(() => {
      if (user) {
        const userKey = `aegis_ext_setup_ack_${user.email || user.id}`;
        if (!localStorage.getItem(userKey)) {
          setShowExtensionReminder(true);
        }
      }
    }, 45000);
  };

  const handleGoToExtensionPage = () => {
    handleAcknowledgeExtension();
    const extPath = (user?.role === "department_admin" || user?.role === "manager" || user?.role === "office_admin")
      ? "/dashboard/supervisor/extension"
      : "/dashboard/employee/browser";
    router.push(extPath);
  };

  const unreadCount = inboxMessages.filter(m => !m.is_read && !seenIds.has(m.id)).length;
  const commPath = user?.role === "department_admin" || user?.role === "manager" || user?.role === "office_admin"
    ? "/dashboard/supervisor/communication"
    : "/dashboard/employee/communication";

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetting(true);
    setVerifyMsg("");
    setVerifyError("");
    try {
      await fetch("http://localhost:8000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email })
      });
      setShowOtpModal(true);
      setVerifyMsg("A 6-digit verification code has been sent to your email.");
      setSettingsOpen(false);
    } catch (e) {
      alert("Failed to send reset code.");
    }
    setResetting(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetting(true);
    setVerifyError("");
    try {
      const res = await fetch("http://localhost:8000/auth/verify-reset-otp", {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-[#0F1423] flex items-center justify-center">
        <Shield className="w-8 h-8 text-brand-500 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return null; // router.replace will handle redirect
  }

  const navItems = navByRole[user.role] || navByRole.employee;
  const roleBadge = getRoleBadge(user.role);
  const userName = user?.fullName || user?.full_name || "Admin User";
  const initials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2);

  const handleLogout = () => { logout(); router.replace("/login"); };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-[#0F1423] flex transition-colors duration-300 font-sans">
      <aside
        className={`hidden md:flex flex-col border-r border-surface-200 dark:border-white/[0.04] bg-white dark:bg-[#141A29] shrink-0 h-screen sticky top-0 z-50 ${isDragging ? '' : 'transition-all duration-300'}`}
        style={{ width: collapsed ? 80 : sidebarWidth }}
      >
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
          unreadCount={unreadCount}
        />
        {!collapsed && (
          <div
            className="absolute top-0 right-[-3px] w-[6px] h-full cursor-col-resize hover:bg-brand-500/30 active:bg-brand-500/50 z-20 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
          />
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-white dark:bg-[#1A2133] border border-surface-200 dark:border-white/[0.1] flex items-center justify-center text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors z-30 shadow-sm">
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
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-surface-500 dark:text-surface-400 mr-2">
              System Status: <span className={`flex items-center gap-1.5 ${apiOffline ? 'text-red-500' : 'text-surface-900 dark:text-white'}`}><span className={`w-1.5 h-1.5 rounded-full ${apiOffline ? 'bg-red-500' : 'bg-[#4F84F8] animate-pulse shadow-[0_0_8px_#4F84F8]'}`}></span> {apiOffline ? 'Offline' : 'Operational'}</span>
            </div>
            <div className="hidden sm:block h-5 w-px bg-surface-200 dark:bg-white/[0.1] mx-1"></div>

            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors relative flex items-center justify-center"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] shadow-xl rounded-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-surface-100 dark:border-white/[0.04] flex items-center justify-between">
                    <span className="text-sm font-semibold text-surface-900 dark:text-white">Messages</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 px-2 py-0.5 rounded-full font-medium">
                        {unreadCount} New
                      </span>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                    {inboxMessages.length === 0 ? (
                      <div className="py-8 text-center text-surface-500 text-sm">
                        <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        No new messages
                      </div>
                    ) : (
                      inboxMessages.slice(0, 8).map(msg => (
                        <button
                          key={msg.id}
                          onClick={() => {
                            setSeenIds(prev => new Set([...prev, msg.id]));
                            setNotificationsOpen(false);
                            router.push(commPath);
                          }}
                          className="w-full p-4 border-b border-surface-100 dark:border-white/[0.04] hover:bg-surface-50 dark:hover:bg-white/[0.02] transition-colors text-left flex gap-3 items-start"
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${(!msg.is_read && !seenIds.has(msg.id)) ? 'bg-brand-100 dark:bg-brand-900/30' : 'bg-surface-100 dark:bg-surface-800'
                            }`}>
                            <MessageSquare className={`w-4 h-4 ${(!msg.is_read && !seenIds.has(msg.id)) ? 'text-brand-600 dark:text-brand-400' : 'text-surface-400'
                              }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${(!msg.is_read && !seenIds.has(msg.id)) ? 'text-surface-900 dark:text-white' : 'text-surface-500'
                              }`}>
                              {msg.title || (msg.msg_type === 'broadcast' ? 'Department Broadcast' : (msg.sender_name ? `Message from ${msg.sender_name}` : 'Direct Message'))}
                            </p>
                            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">{msg.content}</p>
                            <p className="text-[10px] text-surface-400 mt-1">
                              {new Date(msg.created_at).toLocaleString()}
                            </p>
                          </div>
                          {(!msg.is_read && !seenIds.has(msg.id)) && (
                            <span className="w-2 h-2 rounded-full bg-brand-500 mt-1 shrink-0"></span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-surface-100 dark:border-white/[0.04] flex gap-2">
                    <button
                      onClick={() => {
                        setSeenIds(new Set(inboxMessages.map((m: any) => m.id)));
                      }}
                      className="flex-1 py-1.5 text-xs text-center font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors"
                    >
                      Mark all read
                    </button>
                    <button
                      onClick={() => { setNotificationsOpen(false); router.push(commPath); }}
                      className="flex-1 py-1.5 text-xs text-center font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 rounded-lg transition-colors"
                    >
                      Open Inbox
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={activityRef}>
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
                        <span className={apiOffline ? "text-red-500 font-medium" : (systemHealth?.models?.email?.status === "online" ? "text-emerald-500 font-medium" : "text-amber-500 font-medium")}>
                          {apiOffline ? "Offline" : (systemHealth ? (systemHealth.models?.email?.status === "online" ? "Optimal" : "Degraded") : "Checking...")}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${apiOffline ? "w-1/3 bg-red-500" : (systemHealth?.models?.email?.status === "online" ? "w-full bg-emerald-500" : (systemHealth ? "w-2/3 bg-amber-500" : "w-0 bg-emerald-500"))}`}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-surface-600 dark:text-surface-400">Ingestion Pipelines</span>
                        <span className={apiOffline ? "text-red-500 font-medium" : (systemHealth?.status === "ok" ? "text-emerald-500 font-medium" : "text-amber-500 font-medium")}>
                          {apiOffline ? "Offline" : (systemHealth ? (systemHealth.status === "ok" ? "Operational" : "Degraded") : "Checking...")}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${apiOffline ? "w-1/3 bg-red-500" : (systemHealth?.status === "ok" ? "w-full bg-emerald-500" : (systemHealth ? "w-2/3 bg-amber-500" : "w-0 bg-emerald-500"))}`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="h-5 w-px bg-surface-200 dark:bg-white/[0.1] mx-1"></div>

            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.04] text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] shadow-lg rounded-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-surface-100 dark:border-white/[0.04] bg-surface-50 dark:bg-white/[0.02]">
                    <div className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                      {userName}
                    </div>
                    <div className="text-[10px] text-surface-500 dark:text-surface-400 truncate uppercase tracking-wider font-medium mt-0.5">
                      {roleBadge?.label || user?.role || "Role"}{(user?.role === "admin" || user?.role === "super_admin") ? "" : (user?.department ? ` • ${user.department}` : "")}
                    </div>
                    <div className="text-[10px] text-brand-600 dark:text-[#4F84F8] font-medium truncate mt-1">
                      {user?.email || "No email available"}
                    </div>
                  </div>
                  <div className="py-1">
                    <button onClick={() => { toggleTheme(); setSettingsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-600 hover:text-brand-600 hover:bg-surface-50 dark:text-surface-300 dark:hover:text-[#4F84F8] dark:hover:bg-white/[0.04] transition-colors text-left">
                      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      {theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </button>
                    <button onClick={handlePasswordReset} disabled={resetting} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-600 hover:text-brand-600 hover:bg-surface-50 dark:text-surface-300 dark:hover:text-[#4F84F8] dark:hover:bg-white/[0.04] transition-colors text-left disabled:opacity-50">
                      <Key className="w-4 h-4" />
                      {resetting ? "Sending..." : "Reset Password"}
                    </button>
                    <button onClick={() => { setSettingsOpen(false); router.push(user?.role === 'super_admin' || user?.role === 'admin' ? '/dashboard/admin/settings' : (user?.role === 'manager' || user?.role === 'department_admin' || user?.role === 'office_admin' ? '/dashboard/supervisor/settings' : '/dashboard/employee/settings')); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-600 hover:text-brand-600 hover:bg-surface-50 dark:text-surface-300 dark:hover:text-[#4F84F8] dark:hover:bg-white/[0.04] transition-colors text-left">
                      <UserCog className="w-4 h-4" />
                      Account Settings
                    </button>
                  </div>
                  <div className="h-px bg-surface-200 dark:bg-white/[0.08] my-1"></div>
                  <div className="py-1">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-500/10 transition-colors text-left">
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 text-surface-900 dark:text-white overflow-hidden relative">
          {/* OTP Modal rendered at main layout level */}
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

          {children}
        </main>

        {/* Dashboard Centered Luxury Footer */}
        <footer className="px-6 py-2.5 shrink-0 bg-white dark:bg-[#0A1931] border-t border-surface-200 dark:border-white/[0.04] flex items-center justify-center text-xs text-surface-500 dark:text-[#B3CFE5] font-medium tracking-wide transition-colors duration-300">
          <span>Powered by AegisOne</span>
        </footer>

        {/* First Time Extension Setup Reminder Modal */}
        <AnimatePresence>
          {showExtensionReminder && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.1] shadow-2xl rounded-2xl w-full max-w-md p-6 space-y-4 text-left relative overflow-hidden">
                <button
                  onClick={handleRefuseExtension}
                  className="absolute top-4 right-4 text-surface-400 hover:text-surface-700 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Puzzle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-surface-900 dark:text-white">Security Extension Setup</h3>
                    <p className="text-xs text-surface-500">Protect your web traffic & credential security</p>
                  </div>
                </div>

                <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">
                  Welcome! To enable real-time URL scanning, credential exfiltration blocking, and threat telemetry, please install the official <strong>AegisOne Browser Extension</strong>.
                </p>

                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1">
                  <p className="font-semibold">Why install the extension?</p>
                  <ul className="list-disc list-inside space-y-0.5 opacity-90">
                    <li>Instant phishing & malicious link blocking</li>
                    <li>Zero-delay credential leak detection</li>
                    <li>Automatic threat reporting to your admin dashboard</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    onClick={handleGoToExtensionPage}
                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Puzzle className="w-4 h-4" /> Install Extension Now
                  </button>
                  <button
                    onClick={handleAcknowledgeExtension}
                    className="py-2.5 px-3 bg-surface-100 dark:bg-white/[0.04] text-surface-700 dark:text-surface-300 text-xs font-semibold rounded-xl hover:bg-surface-200 dark:hover:bg-white/[0.08] transition-colors whitespace-nowrap"
                  >
                    Already Installed / Don't Show Again
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

