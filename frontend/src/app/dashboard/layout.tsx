"use client";
import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Shield, LayoutDashboard, Search, History, AlertTriangle, Users, Settings,
  Activity, FileBarChart, LogOut, ChevronLeft, ChevronRight, Bell, Menu, X,
  UserCog, BarChart3, ClipboardList, ShieldCheck, Scan, Flag, Sun, Moon, Globe,
  Download, Key, Image, Monitor, Server, Clock, TrendingUp, Lightbulb, User, BrainCircuit, ShieldAlert
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
    { label: "Overview", href: "/dashboard/employee", icon: LayoutDashboard },
    { label: "Threat Center", href: "/dashboard/employee/threats", icon: Shield },
    { label: "AI Insights", href: "/dashboard/employee/xai", icon: Lightbulb },
    { label: "Analytics", href: "/dashboard/employee/analytics", icon: BarChart3 },
    { label: "Settings", href: "/dashboard/employee/settings", icon: Settings },
  ],
  office_admin: [
    { label: "Dashboard", href: "/dashboard/supervisor", icon: LayoutDashboard },
    { label: "Scan", href: "/dashboard/supervisor/scan", icon: Scan },
    { label: "Employees", href: "/dashboard/supervisor/employees", icon: Users },
    { label: "Incidents", href: "/dashboard/supervisor/incidents", icon: AlertTriangle },
    { label: "Reports", href: "/dashboard/supervisor/reports", icon: FileBarChart },
  ],
  department_admin: [
    { label: "Dashboard", href: "/dashboard/supervisor", icon: LayoutDashboard },
    { label: "Scan", href: "/dashboard/supervisor/scan", icon: Scan },
    { label: "Approvals", href: "/dashboard/admin/approvals", icon: ShieldAlert },
    { label: "Employees", href: "/dashboard/supervisor/employees", icon: Users },
    { label: "Incidents", href: "/dashboard/supervisor/incidents", icon: AlertTriangle },
    { label: "Reports", href: "/dashboard/supervisor/reports", icon: FileBarChart },
  ],
  global_admin: [
    { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Organizations", href: "/dashboard/admin/organizations", icon: Globe },
    { label: "Approvals", href: "/dashboard/admin/approvals", icon: Users },
    { label: "AI Models", href: "/dashboard/admin/models", icon: Activity },
    { label: "Audit Logs", href: "/dashboard/admin/audit", icon: ClipboardList },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
  ],
  super_admin: [
    { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Scan", href: "/dashboard/admin/scan", icon: Scan },
    { label: "AI Models", href: "/dashboard/admin/models", icon: Activity },
    { label: "Approvals", href: "/dashboard/admin/approvals", icon: ShieldAlert },
    { label: "Users", href: "/dashboard/admin/users", icon: Users },
    { label: "Incidents", href: "/dashboard/admin/incidents", icon: AlertTriangle },
    { label: "Audit Logs", href: "/dashboard/admin/audit", icon: ClipboardList },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
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
}: any) {
  return (
    <>
      <div className="h-20 flex flex-col justify-center px-6 shrink-0 border-b border-surface-200 dark:border-white/[0.04]">
        {!collapsed ? (
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-brand-600 dark:text-[#4F84F8]">AegisOne</span>
            <span className="text-[10px] text-surface-500 dark:text-surface-400 uppercase tracking-widest mt-0.5">Enterprise Security</span>
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

      <div className="p-4 shrink-0 mt-auto border-t border-surface-200 dark:border-white/[0.04]">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-900 flex items-center justify-center overflow-hidden border border-surface-700">
               <span className="text-sm font-bold text-white">{initials}</span>
            </div>
            <div className="flex flex-col min-w-0">
               <span className="text-sm font-semibold text-surface-900 dark:text-white truncate">{user?.fullName || user?.full_name || "Admin User"}</span>
               <span className="text-[10px] text-surface-500 dark:text-surface-400 truncate">{roleBadge.label} Access</span>
            </div>
            <button onClick={handleLogout} className="ml-auto text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
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
      if (role === "department_admin" && pathname === "/dashboard/admin/approvals") {
        setIsAuthorizing(false);
      } else {
        router.replace(role === "department_admin" ? "/dashboard/supervisor" : "/dashboard/employee");
      }
    } else if (pathname.startsWith("/dashboard/supervisor") && role !== "department_admin" && role !== "office_admin") {
      router.replace(role === "super_admin" ? "/dashboard/admin" : "/dashboard/employee");
    } else if (pathname.startsWith("/dashboard/employee") && (role === "super_admin" || role === "global_admin")) {
      router.replace("/dashboard/admin");
    } else if (pathname.startsWith("/dashboard/employee") && (role === "department_admin" || role === "office_admin")) {
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
      <aside className={`hidden md:flex flex-col border-r border-surface-200 dark:border-white/[0.04] bg-white dark:bg-[#141A29] transition-all duration-300 ${collapsed ? "w-[80px]" : "w-[260px]"} shrink-0 h-screen sticky top-0`}>
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
            <button className="text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white dark:bg-[#0F1423] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-white"></span>
              </span>
            </button>
            <button className="text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors">
               <Activity className="w-4 h-4" />
            </button>
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
