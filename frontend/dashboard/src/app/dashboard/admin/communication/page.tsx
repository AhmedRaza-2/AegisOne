"use client";
import { useAuth } from "@/lib/auth-context";
import { MessageSquare, Megaphone, Users, CheckCircle2, XCircle, Plus, X, Globe, Send } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatView, ContactItem, ChatContact, ChatMessage, roleLabel, ts } from "@/components/chat/ChatComponents";

function Toast({ toast }: { toast: { message: string; type: "success" | "error" } | null }) {
  if (!toast) return null;
  return (
    <motion.div key="t" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white font-medium z-[999] text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
      {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      {toast.message}
    </motion.div>
  );
}

export default function AdminCommunicationPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [announcements, setAnnouncements] = useState<ChatMessage[]>([]);
  const [tab, setTab] = useState<"chat" | "announce">("chat");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [bTitle, setBTitle] = useState("Organization Notice");
  const [bContent, setBContent] = useState("");
  const [bSending, setBSending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getHeaders = useCallback(() => {
    const t = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    return { Authorization: `Bearer ${t || ""}`, "Content-Type": "application/json" };
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!user) return;
    fetch("http://localhost:8000/communication/contacts", { headers: getHeaders() })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) { setContacts(data); if (data.length > 0) setActiveContact(data[0]); }
      }).catch(console.error);
  }, [user, getHeaders]);

  useEffect(() => {
    if (!user) return;
    const load = () =>
      fetch("http://localhost:8000/communication/announcements", { headers: getHeaders() })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d); }).catch(() => { });
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [user, getHeaders]);

  useEffect(() => {
    if (!activeContact) return;
    if (pollRef.current) clearInterval(pollRef.current);
    const load = () =>
      fetch(`http://localhost:8000/communication/conversation/${activeContact.id}`, { headers: getHeaders() })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setThread(d); }).catch(() => { });
    load();
    pollRef.current = setInterval(load, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeContact, getHeaders]);

  const handleSend = async (text: string) => {
    if (!activeContact) return;
    const res = await fetch("http://localhost:8000/communication/send", {
      method: "POST", headers: getHeaders(),
      body: JSON.stringify({ msg_type: "direct", receiver_id: activeContact.id, content: text })
    });
    if (res.ok) {
      const data = await fetch(
        `http://localhost:8000/communication/conversation/${activeContact.id}`, { headers: getHeaders() }
      ).then(r => r.json());
      if (Array.isArray(data)) setThread(data);
    } else {
      const err = await res.json(); showToast(err.detail || "Failed to send", "error");
    }
  };

  const handleOrgBroadcast = async () => {
    if (!bContent.trim()) return;
    setBSending(true);
    const res = await fetch("http://localhost:8000/communication/send", {
      method: "POST", headers: getHeaders(),
      body: JSON.stringify({ msg_type: "org_broadcast", title: bTitle, content: bContent })
    });
    if (res.ok) {
      showToast("Organization-wide broadcast sent!", "success");
      setBContent(""); setShowBroadcast(false);
      fetch("http://localhost:8000/communication/announcements", { headers: getHeaders() })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d); });
    } else { const e = await res.json(); showToast(e.detail || "Failed", "error"); }
    setBSending(false);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-6xl mx-auto">
      <AnimatePresence><Toast toast={toast} /></AnimatePresence>

      {/* Org Broadcast Modal */}
      <AnimatePresence>
        {showBroadcast && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber-500" /> Organization-Wide Broadcast
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1.5">Message</label>
                  <textarea value={bContent} onChange={e => setBContent(e.target.value)} rows={4}
                    placeholder="Write your organization-wide message…"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500 resize-none" />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowBroadcast(false)} className="px-4 py-2 text-sm text-surface-500">Cancel</button>
                  <button onClick={handleOrgBroadcast} disabled={!bContent.trim() || bSending}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2">
                    <Globe className="w-4 h-4" />{bSending ? "Sending…" : "Send to Organization"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Admin Communication</h1>
          <p className="text-xs text-surface-500 dark:text-surface-400">Message managers and broadcast to the entire organization</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => setShowBroadcast(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Globe className="w-4 h-4" /> Org Broadcast
          </button>
          <div className="flex gap-1 p-1 bg-surface-100 dark:bg-surface-900 rounded-lg">
            <button onClick={() => setTab("chat")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === "chat" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500"}`}>Chat</button>
            <button onClick={() => setTab("announce")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${tab === "announce" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500"}`}>
              Announcements {announcements.length > 0 && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded-full">{announcements.length}</span>}
            </button>
          </div>
        </div>
      </div>

      {tab === "chat" ? (
        <div className="flex flex-1 rounded-2xl border border-surface-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-[#141A29] shadow-sm min-h-0">
          {/* Sidebar */}
          <div className="w-64 shrink-0 border-r border-surface-200 dark:border-white/[0.06] flex flex-col overflow-y-auto custom-scrollbar">
            <div className="px-4 py-2.5 border-b border-surface-200 dark:border-white/[0.06] sticky top-0 bg-white dark:bg-[#141A29] z-10">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Department Managers</span>
            </div>
            {contacts.length === 0
              ? <div className="text-center py-12 text-surface-400 text-sm px-4">No managers found</div>
              : contacts.map(c => (
                <ContactItem key={c.id} contact={c} isActive={activeContact?.id === c.id} onClick={() => setActiveContact(c)} accentColor="amber" />
              ))
            }
          </div>

          {activeContact ? (
            <ChatView currentUserId={user.id} activeContact={activeContact} thread={thread} accentColor="amber" onSend={handleSend} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-surface-400">
              <div className="text-center"><Users className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-sm">Select a manager to start chatting</p></div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 rounded-2xl border border-surface-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-[#141A29] shadow-sm">
          <div className="p-5 border-b border-surface-200 dark:border-white/[0.06] flex items-center justify-between bg-surface-50/50 dark:bg-white/[0.01]">
            <div>
              <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2"><Megaphone className="w-5 h-5 text-amber-500" />Organization Announcements</h2>
              <p className="text-xs text-surface-500 mt-0.5">Org-wide broadcasts and department announcements</p>
            </div>
            <button onClick={() => setShowBroadcast(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg">
              <Plus className="w-4 h-4" />New Org Broadcast
            </button>
          </div>
          <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ maxHeight: "calc(100% - 80px)" }}>
            {announcements.length === 0 ? (
              <div className="text-center py-16 text-surface-400"><Globe className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No announcements yet</p></div>
            ) : announcements.map(a => (
              <div key={a.id} className="p-4 rounded-xl border border-surface-200 dark:border-white/[0.05] bg-surface-50 dark:bg-surface-950">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.msg_type === "org_broadcast" ? <Globe className="w-4 h-4 text-amber-500" /> : <Megaphone className="w-4 h-4 text-brand-500" />}
                    <span className="text-sm font-semibold text-surface-900 dark:text-white">{a.title || "Broadcast"}</span>
                    {a.msg_type === "org_broadcast" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">ORG-WIDE</span>}
                    {Number(a.sender_id) === Number(user.id) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">SENT BY YOU</span>}
                  </div>
                  <span className="text-[10px] text-surface-400 ml-3 shrink-0">{ts(a.created_at)}</span>
                </div>
                <p className="text-sm text-surface-600 dark:text-surface-400">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

=======
import { MessageSquare, Megaphone, Send, Clock, Users, User, AlertCircle, Info, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "@/components/ui/toast";

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
    toast(`Message sent successfully!\n\nType: ${activeTab}\nContent: ${messageText}`, "success");
    setMessageText("");
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-surface-900 dark:text-white">
          <MessageSquare className="w-6 h-6 text-brand-650 dark:text-brand-400" /> Communication Center
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Secure communication channel for the {user.department || "Organization"} department.
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
              <p className="text-sm text-surface-500">Send an announcement to all {user.department || "Organization"} employees.</p>
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
>>>>>>> Stashed changes
