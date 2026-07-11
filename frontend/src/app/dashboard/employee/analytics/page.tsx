"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { BarChart3, PieChart, Activity, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart as RechartsPie, Pie, Cell } from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetch(`http://localhost:9000/user/analytics?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(res => {
          setData(res);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [user]);

  if (!user) return null;
  
  if (loading) {
    return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-brand-500 animate-spin" /></div>;
  }

  const { dailyTrend, threatTypes, riskDistribution } = data || {
    dailyTrend: [], threatTypes: [], riskDistribution: []
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <BarChart3 className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Risk Analytics
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Deep dive into your personal risk trends and threat exposure.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Risk Trend */}
        <motion.div variants={fadeUp} className="stat-card lg:col-span-2">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-6 text-surface-900 dark:text-white">
            <Activity className="w-4 h-4 text-brand-500" /> Daily Risk Trend (Past 7 Days)
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-surface-200 dark:text-white/[0.05]" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} className="text-surface-500" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} className="text-surface-500" />
                <Tooltip 
                  cursor={{ fill: 'currentColor', opacity: 0.05 }}
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="safe" name="Safe Scans" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="threats" name="Threats Detected" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Threat Types Pie Chart */}
        <motion.div variants={fadeUp} className="stat-card">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-2 text-surface-900 dark:text-white">
            <PieChart className="w-4 h-4 text-brand-500" /> Threat Types Distribution
          </h2>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={threatTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {threatTypes.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Risk Score Distribution */}
        <motion.div variants={fadeUp} className="stat-card">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-6 text-surface-900 dark:text-white">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Risk Score Spread
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDistribution} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="currentColor" className="text-surface-200 dark:text-white/[0.05]" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} className="text-surface-500" width={90} />
                <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05 }} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="count" name="Scans" radius={[0, 4, 4, 0]} barSize={30}>
                  {riskDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
