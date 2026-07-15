"use client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Activity, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } } };
const stagger = { show: { transition: { staggerChildren: 0.1 } } };

// Mock data to perfectly match the design
const trendData = [
  { name: 'DAY 01', score: 65 }, { name: 'DAY 07', score: 68 }, 
  { name: 'DAY 14', score: 75 }, { name: 'DAY 21', score: 88.4 }, 
  { name: 'TODAY', score: 82 }
];

const categoryData = [
  { name: 'Lateral Movement', value: 42, color: '#4F84F8' },
  { name: 'Exfiltration', value: 28, color: '#FFB8B8' },
  { name: 'Credentials', value: 15, color: '#F59E0B' },
  { name: 'Malware', value: 15, color: '#F87171' },
];

const intensityColors = ['bg-surface-100 dark:bg-[#1A2133]', 'bg-[#A5C0FF]', 'bg-[#4F84F8]', 'bg-[#3D6CE5]', 'bg-[#294BBD]'];
const heatmapDays = Array.from({ length: 48 }, () => Math.floor(Math.random() * 5));

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      const fetchData = () => {
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
      };
      
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 text-[#4F84F8] animate-spin" /></div>;

  const { dailyTrend: apiTrend, threatTypes: apiThreats, riskDistribution } = data || {
    dailyTrend: [], threatTypes: [], riskDistribution: []
  };

  const chartTrend = apiTrend?.length > 0 ? apiTrend.map((t: any) => ({ name: t.name, score: t.threats })) : trendData;
  const chartCategories = apiThreats?.length > 0 ? apiThreats.map((t: any, i: number) => ({ name: t.name, value: t.value, color: ['#4F84F8', '#FFB8B8', '#F59E0B', '#F87171', '#10b981', '#a855f7'][i % 6] })) : categoryData;
  const totalEvents = chartCategories.reduce((acc: number, curr: any) => acc + curr.value, 0);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto">
      
      {/* Top Banner */}
      <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <h3 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2">Global Security Risk Comparison</h3>
          <h1 className="text-3xl font-bold text-[#4F84F8] mb-3">20% Lower than industry average</h1>
          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
            Your current defensive posture is significantly stronger than comparable enterprises in the financial sector. We've detected 45% fewer lateral movement attempts this month.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-8 shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">MTTR</span>
            <span className="text-2xl font-bold text-surface-900 dark:text-white mt-1">14.2m</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">False Positives</span>
            <span className="text-2xl font-bold text-surface-900 dark:text-white mt-1">2.4%</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-surface-100 dark:bg-white/[0.05] border border-surface-200 dark:border-white/[0.1] flex items-center gap-2 mt-4 md:mt-0">
             <ShieldCheck className="w-4 h-4 text-[#4F84F8]" />
             <span className="text-xs font-bold text-surface-900 dark:text-white uppercase tracking-wider">Optimized</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <motion.div variants={fadeUp} className="lg:col-span-2 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-base font-bold text-surface-900 dark:text-white">Security Score Trend</h2>
              <p className="text-xs text-surface-500 mt-1">Rolling 30-day performance baseline</p>
            </div>
            <div className="flex items-center bg-surface-100 dark:bg-[#0B0F19] rounded-lg p-1 border border-surface-200 dark:border-white/[0.05]">
               <button className="px-3 py-1 rounded text-xs font-bold bg-white dark:bg-surface-800 text-surface-900 dark:text-white shadow-sm">30D</button>
               <button className="px-3 py-1 rounded text-xs font-bold text-surface-500 hover:text-surface-900 dark:hover:text-white">90D</button>
               <button className="px-3 py-1 rounded text-xs font-bold text-surface-500 hover:text-surface-900 dark:hover:text-white">1Y</button>
            </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F84F8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4F84F8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <RechartsTooltip 
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-surface-900 dark:bg-white text-white dark:text-surface-900 text-xs font-bold px-3 py-2 rounded-lg shadow-xl">
                          {payload[0].payload.name}: Score {payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#4F84F8" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  activeDot={{ r: 6, fill: '#4F84F8', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Threat Categories */}
        <motion.div variants={fadeUp} className="lg:col-span-1 rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6 flex flex-col">
          <h2 className="text-base font-bold text-surface-900 dark:text-white mb-6">Threat Categories</h2>
          
          <div className="relative h-48 w-full flex items-center justify-center mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartCategories.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-surface-900 dark:text-white">{totalEvents}</span>
              <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mt-1">Events</span>
            </div>
          </div>
          
          <div className="space-y-3 mt-auto">
            {chartCategories.map((cat: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                  <span className="text-surface-700 dark:text-surface-300 font-medium">{cat.name}</span>
                </div>
                <span className="font-bold text-surface-900 dark:text-white">{cat.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Heatmap Section */}
      <motion.div variants={fadeUp} className="rounded-xl bg-white dark:bg-[#141A29] border border-surface-200 dark:border-white/[0.04] p-6">
        <div className="flex justify-between items-end mb-6">
           <div>
             <h2 className="text-base font-bold text-surface-900 dark:text-white">Detection Activity Intensity</h2>
             <p className="text-xs text-surface-500 mt-1">Security events processed per hour over the last 12 weeks</p>
           </div>
           <div className="flex items-center gap-1.5 text-xs text-surface-500 font-medium">
             <span>Less</span>
             {intensityColors.map((color, i) => (
               <div key={i} className={`w-3.5 h-3.5 rounded-sm ${color}`} />
             ))}
             <span>More</span>
           </div>
        </div>
        
        <div className="w-full overflow-hidden">
          {/* A simple CSS grid to mimic the heatmap */}
          <div className="grid grid-rows-4 grid-flow-col gap-1.5">
             {heatmapDays.map((val, i) => (
               <div key={i} className={`w-full aspect-square min-w-[20px] max-w-[28px] rounded-sm ${intensityColors[val]} transition-colors hover:ring-1 hover:ring-surface-400 cursor-pointer`} title={`${val} events`} />
             ))}
             {/* Duplicate to fill space to simulate the large grid in the image */}
             {heatmapDays.map((val, i) => (
               <div key={`dup1-${i}`} className={`w-full aspect-square min-w-[20px] max-w-[28px] rounded-sm ${intensityColors[val === 0 ? 0 : val - 1 < 0 ? 0 : val - 1]} transition-colors hover:ring-1 hover:ring-surface-400 cursor-pointer`} />
             ))}
             {heatmapDays.map((val, i) => (
               <div key={`dup2-${i}`} className={`w-full aspect-square min-w-[20px] max-w-[28px] rounded-sm ${intensityColors[val === 3 ? 3 : val + 1 > 3 ? 3 : val + 1]} transition-colors hover:ring-1 hover:ring-surface-400 cursor-pointer`} />
             ))}
             {heatmapDays.map((val, i) => (
               <div key={`dup3-${i}`} className={`hidden sm:block w-full aspect-square min-w-[20px] max-w-[28px] rounded-sm ${intensityColors[val]} transition-colors hover:ring-1 hover:ring-surface-400 cursor-pointer`} />
             ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
