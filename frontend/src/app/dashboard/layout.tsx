"use client";
import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Shield, LayoutDashboard, Search, History, AlertTriangle, Users, Settings,
  Activity, FileBarChart, LogOut, ChevronLeft, ChevronRight, Bell, Menu, X,
  UserCog, BarChart3, ClipboardList, ShieldCheck, Scan, Flag, Sun, Moon, Globe,
  Download, Key, Image, Monitor, Server, Clock, TrendingUp, Lightbulb, User, BrainCircuit
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
    { label: "Dashboard Overview", href: "/dashboard/employee", icon: LayoutDashboard },
    { label: "Threat Center", href: "/dashboard/employee/threats", icon: Shield },
    { label: "Protection Logs", href: "/dashboard/employee/history", icon: History },
    { label: "Explainable AI", href: "/dashboard/employee/xai", icon: BrainCircuit },
    { label: "Risk Analytics", href: "/dashboard/employee/analytics", icon: BarChart3 },
    { label: "Alerts & Timeline", href: "/dashboard/employee/timeline", icon: Clock },
    { label: "System & Settings", href: "/dashboard/employee/settings", icon: Settings },
  ],
  office_admin: [
    { label: "Dashboard", href: "/dashboard/supervisor", icon: LayoutDashboard },
    { label: "Scan", href: "/dashboard/supervisor/scan", icon: Scan },
    { label: "Employees", href: "/dashboard/supervisor/employees", icon: Users },
    { label: "Incidents", href: "/dashboard/supervisor/incidents", icon: AlertTriangle },
    { label: "Reports", href: "/dashboard/supervisor/reports", icon: FileBarChart },
  ],
  global_admin: [
    { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Organizations", href: "/dashboard/admin/organizations", icon: Globe },
    { label: "AI Models", href: "/dashboard/admin/models", icon: Activity },
    { label: "Audit Logs", href: "/dashboard/admin/audit", icon: ClipboardList },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
  ],
  super_admin: [
    { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Scan", href: "/dashboard/admin/scan", icon: Scan },
    { label: "AI Models", href: "/dashboard/admin/models", icon: Activity },
    { label: "Users", href: "/dashboard/admin/users", icon: Users },
    { label: "Incidents", href: "/dashboard/admin/incidents", icon: AlertTriangle },
    { label: "Audit Logs", href: "/dashboard/admin/audit", icon: ClipboardList },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
  ],
};

// Extracted static component outside DashboardLayout to prevent mounting leaks
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
}: {
  collapsed: boolean;
  navItems: NavItem[];
  pathname: string;
  router: any;
  initials: string;
  user: any;
  roleBadge: any;
  handleLogout: () => void;
  setMobileOpen: (open: boolean) => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-4 border-b border-surface-200 dark:border-white/[0.06] shrink-0">
        <ShieldCheck className="w-7 h-7 text-brand-600 dark:text-brand-500 shrink-0" />
        {!collapsed && <span className="text-lg font-bold tracking-tight text-surface-900 dark:text-white">AegisOne</span>}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto custom-scrollbar">
        {navItems.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                active
                  ? "bg-brand-600/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shadow-sm"
                  : "text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-white/[0.04] border border-transparent"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`shrink-0 ${active ? 'w-4 h-4' : 'w-[15px] h-[15px]'}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-surface-200 dark:border-white/[0.06] p-3 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400 uppercase">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-surface-900 dark:text-white truncate">{user?.fullName || user?.full_name || "User"}</div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${roleBadge.color}`}>{roleBadge.label}</span>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-surface-500 hover:text-red-600 hover:bg-red-600/5 dark:text-surface-400 dark:hover:text-red-400 dark:hover:bg-red-400/5 transition-all" title="Logout">
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, theme, toggleTheme } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(true);

  useEffect(() => {
    // Basic auth check
    if (!user) {
      router.replace("/login");
      return;
    }

    // Strict role-based route isolation
    const role = user.role;
    
    // Check if user is in unauthorized territory
    if (pathname.startsWith("/dashboard/admin") && role !== "super_admin" && role !== "global_admin") {
      router.replace(role === "department_admin" ? "/dashboard/supervisor" : "/dashboard/employee");
    } else if (pathname.startsWith("/dashboard/supervisor") && role !== "department_admin" && role !== "office_admin") {
      router.replace(role === "super_admin" ? "/dashboard/admin" : "/dashboard/employee");
    } else if (pathname.startsWith("/dashboard/employee") && (role === "super_admin" || role === "global_admin")) {
      router.replace("/dashboard/admin");
    } else if (pathname.startsWith("/dashboard/employee") && (role === "department_admin" || role === "office_admin")) {
      router.replace("/dashboard/supervisor");
    } else {
      setIsAuthorizing(false);
    }
  }, [user, router, pathname]);

  if (!user || isAuthorizing) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <Shield className="w-8 h-8 text-brand-500 animate-pulse" />
      </div>
    );
  }

  const navItems = navByRole[user.role] || navByRole.employee;
  const roleBadge = getRoleBadge(user.role);
  const userName = user?.fullName || user?.full_name || "User";
  const initials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2);

  const handleLogout = () => { logout(); router.replace("/login"); };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex transition-colors duration-300">
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col border-r border-surface-200 dark:border-white/[0.06] bg-white dark:bg-surface-950 transition-all duration-300 ${collapsed ? "w-[68px]" : "w-[240px]"} shrink-0 h-screen sticky top-0`}>
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
        <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-white/[0.1] flex items-center justify-center text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors z-10">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="fixed left-0 top-0 h-full w-[260px] bg-white dark:bg-surface-950 border-r border-surface-200 dark:border-white/[0.06] z-50 flex flex-col md:hidden">
              <SidebarContent
                collapsed={false}
                navItems={navItems}
                pathname={pathname}
                router={router}
                initials={initials}
                user={user}
                roleBadge={roleBadge}
                handleLogout={handleLogout}
                setMobileOpen={setMobileOpen}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 border-b border-surface-200 dark:border-white/[0.06] bg-white/85 dark:bg-surface-950/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.04]">
              <Menu className="w-5 h-5 text-surface-500 dark:text-surface-400" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-surface-900 dark:text-white">
                {user.role === "global_admin" 
                  ? "AegisOne Platform Head" 
                  : user.organization === "org-1" 
                  ? "U Bank Limited" 
                  : user.organization === "org-2" 
                  ? "INARA Technologies" 
                  : user.organization === "org-3" 
                  ? "Apex Financial Corp" 
                  : "Apex Financial Corp"}
              </h2>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {user.role === "global_admin" ? "Systems Operations" : user.department}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.04] transition-colors" title="Toggle Theme">
              {theme === "dark" ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-surface-600" />}
            </button>
            <button className="relative p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/[0.04] transition-colors">
              <Bell className="w-5 h-5 text-surface-500 dark:text-surface-400" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400 md:hidden">{initials}</div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 text-surface-900 dark:text-white">
          {children}
        </main>
      </div>
    </div>
  );
}
