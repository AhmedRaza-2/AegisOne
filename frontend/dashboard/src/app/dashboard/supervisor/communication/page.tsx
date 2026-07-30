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

export default function ManagerCommunicationPage() {
  const { user } = useAuth();
  const [contacts, setContacts]           = useState<ChatContact[]>([]);
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [thread, setThread]               = useState<ChatMessage[]>([]);
  const [announcements, setAnnouncements] = useState<ChatMessage[]>([]);
  const [tab, setTab]                     = useState<"chat" | "announce">("chat");
  const [toast, setToast]                 = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [bTitle, setBTitle]               = useState("Security Update");
  const [bContent, setBContent]           = useState("");
  const [bSending, setBSending]           = useState(false);
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
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d); }).catch(() => {});
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [user, getHeaders]);

  useEffect(() => {
    if (!activeContact) return;
    if (pollRef.current) clearInterval(pollRef.current);
    const load = () =>
      fetch(`http://localhost:8000/communication/conversation/${activeContact.id}`, { headers: getHeaders() })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setThread(d); }).catch(() => {});
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
      const err = await res.json();
      showToast(err.detail || "Failed to send", "error");
    }
  };

  const handleBroadcast = async () => {
    if (!bContent.trim() || !user?.department_id) return;
    setBSending(true);
    const res = await fetch("http://localhost:8000/communication/send", {
      method: "POST", headers: getHeaders(),
      body: JSON.stringify({ msg_type: "broadcast", department_id: user.department_id, title: bTitle, content: bContent })
    });
    if (res.ok) {
      showToast("Broadcast sent to your department!", "success");
      setBContent(""); setShowBroadcast(false);
      fetch("http://localhost:8000/communication/announcements", { headers: getHeaders() })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d); });
    } else { const e = await res.json(); showToast(e.detail || "Failed", "error"); }
    setBSending(false);
  };

  if (!user) return null;
  const employees = contacts.filter(c => c.role === "employee");
  const admins    = contacts.filter(c => c.role === "admin" || c.role === "super_admin" || c.role === "global_admin");

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-6xl mx-auto">
      <AnimatePresence><Toast toast={toast} /></AnimatePresence>

      {/* Broadcast Modal */}
      <AnimatePresence>
        {showBroadcast && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-brand-500" /> Department Broadcast
                </h3>
                <button onClick={() => setShowBroadcast(false)} className="text-surface-400 hover:text-surface-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1.5">Type</label>
                  <select value={bTitle} onChange={e => setBTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500">
                    <option>Security Update</option><option>Policy Notice</option>
                    <option>Department Notice</option><option>Awareness Reminder</option><option>Incident Notification</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1.5">Message</label>
                  <textarea value={bContent} onChange={e => setBContent(e.target.value)} rows={4}
                    placeholder="Write broadcast…"
                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/[0.08] rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500 resize-none" />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowBroadcast(false)} className="px-4 py-2 text-sm text-surface-500">Cancel</button>
                  <button onClick={handleBroadcast} disabled={!bContent.trim() || bSending}
                    className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2">
                    <Send className="w-4 h-4" />{bSending ? "Sending…" : "Send Broadcast"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="w-6 h-6 text-brand-600 dark:text-brand-400" />
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Communication Center</h1>
          <p className="text-xs text-surface-500 dark:text-surface-400">Chat with your team and organization admins</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => setShowBroadcast(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Megaphone className="w-4 h-4" /> Broadcast
          </button>
          <div className="flex gap-1 p-1 bg-surface-100 dark:bg-surface-900 rounded-lg">
            <button onClick={() => setTab("chat")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === "chat" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500"}`}>Chat</button>
            <button onClick={() => setTab("announce")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${tab === "announce" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500"}`}>
              Announcements {announcements.length > 0 && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-brand-500 text-white rounded-full">{announcements.length}</span>}
            </button>
          </div>
        </div>
      </div>

      {tab === "chat" ? (
        <div className="flex flex-1 rounded-2xl border border-surface-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-[#141A29] shadow-sm min-h-0">
          {/* Sidebar */}
          <div className="w-64 shrink-0 border-r border-surface-200 dark:border-white/[0.06] flex flex-col overflow-y-auto custom-scrollbar">
            {employees.length > 0 && (
              <>
                <div className="px-4 py-2.5 border-b border-surface-200 dark:border-white/[0.06] sticky top-0 bg-white dark:bg-[#141A29] z-10">
                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Team Members</span>
                </div>
                {employees.map(c => <ContactItem key={c.id} contact={c} isActive={activeContact?.id === c.id} onClick={() => setActiveContact(c)} />)}
              </>
            )}
            {admins.length > 0 && (
              <>
                <div className="px-4 py-2.5 border-b border-surface-200 dark:border-white/[0.06] border-t mt-1 sticky top-0 bg-white dark:bg-[#141A29] z-10">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Organization Admins</span>
                </div>
                {admins.map(c => <ContactItem key={c.id} contact={c} isActive={activeContact?.id === c.id} onClick={() => setActiveContact(c)} accentColor="amber" />)}
              </>
            )}
            {contacts.length === 0 && <div className="text-center py-12 text-surface-400 text-sm px-4">No contacts</div>}
          </div>

          {activeContact ? (
            <ChatView currentUserId={user.id} activeContact={activeContact} thread={thread} accentColor="brand" onSend={handleSend} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-surface-400">
              <div className="text-center"><Users className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-sm">Select a contact</p></div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 rounded-2xl border border-surface-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-[#141A29] shadow-sm">
          <div className="p-5 border-b border-surface-200 dark:border-white/[0.06] flex items-center justify-between bg-surface-50/50 dark:bg-white/[0.01]">
            <div>
              <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2"><Megaphone className="w-5 h-5 text-brand-500" />Announcements</h2>
              <p className="text-xs text-surface-500 mt-0.5">Department broadcasts sent and received</p>
            </div>
            <button onClick={() => setShowBroadcast(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg">
              <Plus className="w-4 h-4" />New Broadcast
            </button>
          </div>
          <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ maxHeight: "calc(100% - 80px)" }}>
            {announcements.length === 0 ? (
              <div className="text-center py-16 text-surface-400"><Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No announcements yet</p></div>
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
