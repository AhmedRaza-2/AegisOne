"use client";
import { useAuth } from "@/lib/auth-context";
import { Users, Send, CheckCircle2, MessageSquare, Megaphone, XCircle, Search, Globe, Plus, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { getApiBaseUrl } from "@/lib/api";

const Toast = ({ toast }: { toast: any }) => toast ? (
  <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
    className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white font-medium z-[100] text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
    {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
    {toast.message}
  </motion.div>
) : null;

const ts = (d: string) => {
  const d2 = new Date(d);
  return d2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d2.toLocaleDateString();
};

const ContactItem = ({ contact, isActive, onClick, accentColor = "brand" }: any) => {
  const colorMap = {
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 border-l-[3px] border-brand-500",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-l-[3px] border-emerald-500",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-l-[3px] border-amber-500"
  };
  const bgClass = isActive
    ? colorMap[accentColor as keyof typeof colorMap]
    : "hover:bg-surface-50 dark:hover:bg-white/[0.02] border-l-[3px] border-transparent text-surface-900 dark:text-white";

  return (
    <button onClick={onClick} className={`w-full flex items-start gap-3 p-3 transition-all text-left ${bgClass}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-white dark:bg-black/20' : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'}`}>
        <span className="text-xs font-bold uppercase">
          {(contact.full_name || contact.email).split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
        </span>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden pt-0.5">
        <div className="flex justify-between items-start mb-0.5">
          <span className="text-sm font-semibold truncate">{contact.full_name}</span>
          {contact.last_message_at && <span className="text-[10px] opacity-60 ml-1 shrink-0">{new Date(contact.last_message_at).toLocaleDateString()}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] opacity-70 truncate">{contact.department || contact.role}</span>
          {contact.unread_count > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${isActive ? 'bg-white text-black' : 'bg-brand-500 text-white'}`}>
              {contact.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const ChatView = ({ currentUserId, activeContact, thread, accentColor = "brand", onSend }: any) => {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const sendBtnColors = {
    brand: "bg-brand-600 hover:bg-brand-500",
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    amber: "bg-amber-600 hover:bg-amber-500"
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full relative bg-surface-50/30 dark:bg-transparent">
      <div className="p-4 border-b border-surface-200 dark:border-white/[0.06] flex justify-between items-center bg-white dark:bg-[#141A29]">
        <div>
          <h2 className="text-base font-semibold text-surface-900 dark:text-white">{activeContact.full_name}</h2>
          <p className="text-xs text-surface-500">{activeContact.email}</p>
        </div>
        <span className="px-2 py-0.5 bg-surface-100 dark:bg-surface-800 text-[10px] font-bold text-surface-600 dark:text-surface-300 rounded uppercase tracking-wider">{activeContact.role}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {thread.length === 0 ? (
          <div className="h-full flex items-center justify-center text-surface-400 text-sm">No messages yet. Say hi!</div>
        ) : (
          thread.map((m: any) => {
            const isMine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMine ? sendBtnColors[accentColor as keyof typeof sendBtnColors] + " text-white rounded-br-sm" : "bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] text-surface-900 dark:text-white rounded-bl-sm"}`}>
                  {m.content}
                </div>
                <span className="text-[9px] text-surface-400 mt-1 px-1">{ts(m.created_at)}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="p-4 bg-white dark:bg-[#141A29] border-t border-surface-200 dark:border-white/[0.06]">
        <div className="relative">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) { onSend(text.trim()); setText(""); } } }}
            placeholder="Type a message..." className="w-full bg-surface-100 dark:bg-surface-900 border-none rounded-xl pl-4 pr-12 py-3 text-sm text-surface-900 dark:text-white focus:ring-1 focus:ring-surface-300 dark:focus:ring-surface-700 outline-none" />
          <button onClick={() => { if (text.trim()) { onSend(text.trim()); setText(""); } }} disabled={!text.trim()}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white transition-colors disabled:opacity-50 ${sendBtnColors[accentColor as keyof typeof sendBtnColors]}`}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AdminCommunicationPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"chat" | "announce">("chat");
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<any>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [showBroadcast, setShowBroadcast] = useState(false);
  const [bTitle, setBTitle] = useState("");
  const [bContent, setBContent] = useState("");
  const [bSending, setBSending] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getHeaders = () => {
    const token = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/communication/contacts`, { headers: getHeaders() })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setContacts(d); });
    fetch(`${getApiBaseUrl()}/communication/announcements`, { headers: getHeaders() })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d); });
  }, []);

  useEffect(() => {
    if (!activeContact) { setThread([]); return; }
    fetch(`${getApiBaseUrl()}/communication/conversation/${activeContact.id}`, { headers: getHeaders() })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setThread(d); });
  }, [activeContact]);

  const handleSend = async (text: string) => {
    if (!activeContact) return;
    const res = await fetch(`${getApiBaseUrl()}/communication/send`, {
      method: "POST", headers: getHeaders(),
      body: JSON.stringify({ msg_type: "direct", receiver_id: activeContact.id, content: text })
    });
    if (res.ok) {
      const data = await fetch(
        `${getApiBaseUrl()}/communication/conversation/${activeContact.id}`, { headers: getHeaders() }
      ).then(r => r.json());
      if (Array.isArray(data)) setThread(data);
    } else {
      const err = await res.json(); showToast(err.detail || "Failed to send", "error");
    }
  };

  const handleOrgBroadcast = async () => {
    if (!bContent.trim()) return;
    setBSending(true);
    const res = await fetch(`${getApiBaseUrl()}/communication/send`, {
      method: "POST", headers: getHeaders(),
      body: JSON.stringify({ msg_type: "org_broadcast", title: bTitle, content: bContent })
    });
    if (res.ok) {
      showToast("Organization-wide broadcast sent!", "success");
      setBContent(""); setShowBroadcast(false);
      fetch(`${getApiBaseUrl()}/communication/announcements`, { headers: getHeaders() })
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
                </h3>
              </div>
              <div className="space-y-4">
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
          <p className="text-xs text-surface-500 dark:text-surface-400">Message employees, managers, and broadcast to the entire organization</p>
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
            {contacts.length > 0 ? (
              <>
                <div className="px-4 py-2.5 border-b border-surface-200 dark:border-white/[0.06] sticky top-0 bg-white dark:bg-[#141A29] z-10 shadow-sm">
                  <span className="text-[10px] font-bold text-[#F59E0B] uppercase tracking-widest">All Contacts</span>
                </div>
                {contacts.map(c => (
                  <ContactItem 
                    key={c.id} 
                    contact={{...c, unread_count: activeContact?.id === c.id ? 0 : c.unread_count}} 
                    isActive={activeContact?.id === c.id} 
                    onClick={() => setActiveContact(c)} 
                    accentColor="amber"
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-12 text-surface-400 text-sm px-4">No contacts found</div>
            )}
          </div>

          {activeContact ? (
            <ChatView currentUserId={user.id} activeContact={activeContact} thread={thread} accentColor="amber" onSend={handleSend} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-surface-400">
              <div className="text-center"><Users className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-sm">Select a contact to start chatting</p></div>
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
