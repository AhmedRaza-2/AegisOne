"use client";
import { useAuth } from "@/lib/auth-context";
import { MessageSquare, Megaphone, Send, Clock, Users, User, AlertCircle, Info, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// Mock data
const mockEmployees = ["Ahmed Raza", "Sara Ahmed", "Ali Khan", "Usman Tariq", "Fatima Noor"];

const mockHistory = [
  { id: 1, type: "Broadcast", title: "Phishing Campaign Alert", date: "2 hours ago", content: "We are seeing an influx of fake Microsoft login pages. Please verify URLs.", priority: "High" },
  { id: 2, type: "Direct", title: "Message to Ali Khan", date: "Yesterday", content: "Please review the security awareness module sent to your email.", priority: "Normal" },
  { id: 3, type: "Broadcast", title: "Weekly Security Update", date: "3 days ago", content: "All systems are operational. Remember to update your AegisOne extension.", priority: "Normal" },
];

export default function CommunicationCenterPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("broadcast");
  const [messageText, setMessageText] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(mockEmployees[0]);
  const [broadcastType, setBroadcastType] = useState("Security Update");
  
  if (!user) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText) return;
    alert(`Message sent successfully!\n\nType: ${activeTab}\nContent: ${messageText}`);
    setMessageText("");
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <MessageSquare className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Communication Center
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Secure communication channel for the {user.department} department.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="flex gap-2 p-1 bg-surface-100 dark:bg-surface-900 rounded-lg w-fit">
        <button onClick={() => setActiveTab("broadcast")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "broadcast" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"}`}>
          <div className="flex items-center gap-2"><Megaphone className="w-4 h-4" /> Broadcast</div>
        </button>
        <button onClick={() => setActiveTab("direct")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "direct" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"}`}>
          <div className="flex items-center gap-2"><User className="w-4 h-4" /> Direct Message</div>
        </button>
        <button onClick={() => setActiveTab("history")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "history" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"}`}>
          <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> History</div>
        </button>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div variants={fadeUp} className="lg:col-span-2 stat-card">
          {activeTab === "broadcast" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white">New Broadcast Announcement</h3>
              <p className="text-sm text-surface-500">Send an announcement to all {user.department} employees.</p>
              <form onSubmit={handleSend} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Announcement Type</label>
                  <select value={broadcastType} onChange={e => setBroadcastType(e.target.value)} className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500">
                    <option>Security Update</option>
                    <option>Department Notice</option>
                    <option>Awareness Reminder</option>
                    <option>Incident Notification</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Message Content</label>
                  <textarea required value={messageText} onChange={e => setMessageText(e.target.value)} rows={5} placeholder="Write your broadcast message here..." className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500 resize-none" />
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                    <Send className="w-4 h-4" /> Send Broadcast
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "direct" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Direct Employee Message</h3>
              <p className="text-sm text-surface-500">Privately message an employee regarding security posture or alerts.</p>
              <form onSubmit={handleSend} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Select Employee</label>
                  <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500">
                    {mockEmployees.map(emp => <option key={emp}>{emp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Message Content</label>
                  <textarea required value={messageText} onChange={e => setMessageText(e.target.value)} rows={5} placeholder="Write your direct message here..." className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500 resize-none" />
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                    <Send className="w-4 h-4" /> Send Message
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Announcement History</h3>
              <div className="space-y-3 mt-4">
                {mockHistory.map(item => (
                  <div key={item.id} className="p-4 rounded-xl border border-surface-200 dark:border-white/[0.05] bg-surface-50/50 dark:bg-surface-950">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {item.type === "Broadcast" ? <Megaphone className="w-4 h-4 text-brand-500" /> : <User className="w-4 h-4 text-emerald-500" />}
                        <span className="font-semibold text-surface-900 dark:text-white">{item.title}</span>
                      </div>
                      <span className="text-[10px] text-surface-500">{item.date}</span>
                    </div>
                    <p className="text-sm text-surface-600 dark:text-surface-400">{item.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div variants={fadeUp} className="stat-card flex flex-col">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-surface-900 dark:text-white mb-4">
            <Info className="w-4 h-4 text-brand-500" /> Communication Guidelines
          </h3>
          <ul className="space-y-3 text-sm text-surface-600 dark:text-surface-400 list-disc list-inside">
            <li>Broadcasts are visible to all employees on their primary dashboard.</li>
            <li>Use Direct Messages for personalized security follow-ups.</li>
            <li>Keep incident notifications clear and actionable.</li>
            <li>Messages are logged for compliance and auditing purposes.</li>
          </ul>

          <div className="mt-8 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-amber-900 dark:text-amber-400 mb-2">
              <ShieldAlert className="w-4 h-4" /> Emergency Broadcast
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-500 mb-3">Use this only for active security incidents requiring immediate action.</p>
            <button className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
              Trigger Emergency Alert
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
