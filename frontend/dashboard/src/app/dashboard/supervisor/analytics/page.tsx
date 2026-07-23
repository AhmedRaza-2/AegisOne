"use client";
import { useAuth } from "@/lib/auth-context";
import { BarChart3, ShieldCheck, Activity, Globe, Download, Key, Image as ImageIcon, QrCode, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

const securityTrendData = [
  { date: "Mon", threats: 12, blocked: 12 },
  { date: "Tue", threats: 19, blocked: 19 },
  { date: "Wed", threats: 8, blocked: 8 },
  { date: "Thu", threats: 24, blocked: 24 },
  { date: "Fri", threats: 15, blocked: 15 },
  { date: "Sat", threats: 5, blocked: 5 },
  { date: "Sun", threats: 2, blocked: 2 },
];

const threatDistData = [
  { name: "URLs", value: 45 },
  { name: "Downloads", value: 25 },
  { name: "Login Pages", value: 15 },
  { name: "Images", value: 10 },
  { name: "QR Codes", value: 5 },
];

const riskTrendData = [
  { week: "W1", risk: 24 },
  { week: "W2", risk: 22 },
  { week: "W3", risk: 28 },
  { week: "W4", risk: 18 },
  { week: "W5", risk: 15 },
  { week: "W6", risk: 11 },
];

export default function DepartmentAnalyticsPage() {
  const { user, theme } = useAuth();
  if (!user) return null;

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipColor = isDark ? "#ffffff" : "#0f172a";

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-600 dark:text-brand-400" /> Department Analytics
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Aggregated security metrics for {user.department}</p>
      </motion.div>

      {/* Coverage Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "URL Protection", value: "100%", icon: Globe, color: "text-blue-500" },
          { label: "Credential Protection", value: "100%", icon: Key, color: "text-emerald-500" },
          { label: "Download Protection", value: "98%", icon: Download, color: "text-amber-500" },
          { label: "Image AI", value: "95%", icon: ImageIcon, color: "text-purple-500" },
        ].map((c) => (
          <div key={c.label} className="stat-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg bg-surface-100 dark:bg-white/[0.04] ${c.color}`}>
                <c.icon className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-surface-600 dark:text-surface-400">{c.label}</div>
            </div>
            <div className="text-xl font-bold text-surface-900 dark:text-white ml-1">{c.value}</div>
          </div>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Security Trend */}
        <motion.div variants={fadeUp} className="lg:col-span-2 stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white"><Activity className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Security Trend (Weekly)</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={securityTrendData}>
              <defs>
                <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: \`1px solid \${tooltipBorder}\`, borderRadius: 8, fontSize: 12, color: tooltipColor }} />
              <Area type="monotone" dataKey="threats" stroke="#ef4444" fillOpacity={1} fill="url(#colorThreats)" />
              <Area type="monotone" dataKey="blocked" stroke="#10b981" fillOpacity={1} fill="url(#colorBlocked)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Threat Distribution */}
        <motion.div variants={fadeUp} className="stat-card flex flex-col items-center">
          <h3 className="text-sm font-semibold mb-4 self-start flex items-center gap-2 text-surface-900 dark:text-white"><BarChart3 className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Threat Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={threatDistData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={4}>
                {threatDistData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: tooltipBg, border: \`1px solid \${tooltipBorder}\`, borderRadius: 8, fontSize: 12, color: tooltipColor }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 justify-center w-full px-4">
            {threatDistData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1.5 text-[10px] text-surface-600 dark:text-surface-300">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />{d.name}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Risk Trend */}
        <motion.div variants={fadeUp} className="lg:col-span-3 stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-white"><TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Department Risk Trend (Score Over Time)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={riskTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: tooltipBg, border: \`1px solid \${tooltipBorder}\`, borderRadius: 8, fontSize: 12, color: tooltipColor }} />
              <Line type="monotone" dataKey="risk" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: "#3b82f6" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </motion.div>
  );
}
