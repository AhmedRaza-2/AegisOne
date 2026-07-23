export type Role = "global_admin" | "super_admin" | "office_admin" | "employee";

// Users
const _users: any = [
  { id: "1", fullName: "Platform Head", email: "head@aegisone.com", role: "global_admin", avatar: "", organization: "aegis" },
  { id: "2", fullName: "Super Admin", email: "admin@ubank.com.pk", role: "super_admin", avatar: "", organization: "org-1" },
  { id: "3", fullName: "Supervisor Ahmed", email: "ahmed.raza@ubank.com.pk", role: "office_admin", avatar: "", organization: "org-1", department: "IT" },
  { id: "4", fullName: "Employee Ali", email: "ali.mazhar@ubank.com.pk", role: "employee", avatar: "", organization: "org-1", department: "IT" },
];
_users.getAll = () => _users;
_users.add = (u: any) => _users.push({ ...u, id: Math.random().toString() });
_users.delete = (id: string) => {
  const i = _users.findIndex((u: any) => u.id === id);
  if (i > -1) _users.splice(i, 1);
};
export const users = _users;

export const getRoleBadge = (role: Role) => {
  switch (role) {
    case "global_admin": return "Global Admin";
    case "super_admin": return "Super Admin";
    case "office_admin": return "Office Admin";
    default: return "Employee";
  }
};

export const getUserById = (id: string) => users.find((u: any) => u.id === id);

// Organizations
const _orgs: any = [
  { id: "org-1", name: "U Bank Limited", domain: "ubank.com.pk", plan: "enterprise" },
  { id: "org-2", name: "INARA Technologies", domain: "inara.com", plan: "professional" }
];
_orgs.getAll = () => _orgs;
_orgs.add = (name: string, domain: string, plan: string) => _orgs.push({ id: Math.random().toString(), name, domain, plan });
_orgs.delete = (id: string) => {
  const i = _orgs.findIndex((o: any) => o.id === id);
  if (i > -1) _orgs.splice(i, 1);
};
_orgs.sendBroadcast = (target: string) => console.log("Broadcast to", target);
export const organizations = _orgs;

// Other arrays
const _incidents: any = [
  { id: "inc-1", scanId: "scan-1", status: "open", severity: "high", reporterId: "4", reportedAt: new Date().toISOString(), details: "Phishing email detected", notes: "" },
  { id: "inc-2", scanId: "scan-2", status: "investigating", severity: "medium", reporterId: "4", reportedAt: new Date(Date.now() - 86400000).toISOString(), details: "Suspicious login attempt", notes: "Checking IP logs" }
];
_incidents.updateStatus = (id: string, status: string, notes: string) => {
  const inc = _incidents.find((i: any) => i.id === id);
  if (inc) { inc.status = status; inc.notes = notes; }
};
export const incidents = _incidents;

export const scanHistory: any[] = [
  { 
    id: "scan-1", 
    timestamp: new Date().toISOString(), 
    type: "email", 
    scanType: "email",
    verdict: "malicious", 
    prediction: "malicious",
    riskLevel: "danger",
    riskScore: 85, 
    summary: "Urgent: Reset password", 
    inputPreview: "Urgent: Reset password", 
    userId: "4" 
  },
  { 
    id: "scan-2", 
    timestamp: new Date(Date.now() - 3600000).toISOString(), 
    type: "url", 
    scanType: "url",
    verdict: "safe", 
    prediction: "legitimate",
    riskLevel: "safe",
    riskScore: 10, 
    summary: "https://ubank.com.pk", 
    inputPreview: "https://ubank.com.pk", 
    userId: "4" 
  },
  { 
    id: "scan-3", 
    timestamp: new Date(Date.now() - 7200000).toISOString(), 
    type: "text", 
    scanType: "text",
    verdict: "safe", 
    prediction: "legitimate",
    riskLevel: "safe",
    riskScore: 5, 
    summary: "Please review the attachment.", 
    inputPreview: "Please review the attachment.", 
    userId: "4" 
  }
];

export const threatTrends: any[] = [
  { date: "Mon", phishing: 2, malware: 1, suspicious: 0, safe: 15 },
  { date: "Tue", phishing: 1, malware: 0, suspicious: 2, safe: 20 },
  { date: "Wed", phishing: 4, malware: 1, suspicious: 1, safe: 18 },
  { date: "Thu", phishing: 0, malware: 0, suspicious: 0, safe: 25 },
  { date: "Fri", phishing: 2, malware: 2, suspicious: 1, safe: 12 },
  { date: "Sat", phishing: 0, malware: 0, suspicious: 0, safe: 10 },
  { date: "Sun", phishing: 1, malware: 0, suspicious: 1, safe: 12 }
];

export const modelHealth: any[] = [
  { id: "m1", name: "NLP Phishing Engine v2", status: "Operational", latency: 45, accuracy: 99.2 },
  { id: "m2", name: "URL Analyzer v3", status: "Operational", latency: 120, accuracy: 98.5 }
];

export const departmentStats: any[] = [
  { name: "IT", employees: 1, scansToday: 45, threats: 2, riskIndex: "Low" },
  { name: "HR", employees: 3, scansToday: 12, threats: 1, riskIndex: "Medium" }
];

export const auditLogs: any[] = [
  { id: "a1", createdAt: new Date().toISOString(), userId: "1", action: "user.created", targetType: "User", targetId: "2", details: "Provisioned super admin" },
  { id: "a2", createdAt: new Date(Date.now() - 7200000).toISOString(), userId: "2", action: "policy.updated", targetType: "Settings", targetId: "org-1", details: "Updated password policy" }
];

export const getGlobalStats = () => ({ 
  totalScans: 1205, 
  threatsBlocked: 42, 
  activeUsers: 8,
  openIncidents: 3,
  modelsOnline: 4,
  totalModels: 4
});

export const getUserStats = (userId?: string) => {
  const userScans = scanHistory.filter(s => s.userId === userId);
  const total = userScans.length;
  const threats = userScans.filter(s => s.verdict === "malicious" || s.prediction === "malicious" || s.riskLevel === "danger").length;
  const safe = total - threats;
  const safeRate = total > 0 ? Math.round((safe / total) * 100) : 100;
  const sorted = [...userScans].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const lastScan = sorted.length > 0 ? sorted[0].timestamp : null;

  return {
    totalScans: total,
    threatsBlocked: threats,
    safeRate: safeRate,
    lastScan: lastScan,
    safe: safe,
    threats: threats
  };
};
