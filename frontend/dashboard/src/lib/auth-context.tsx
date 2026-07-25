"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { User, Role, users as mockUsers } from "@/lib/mock-data";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, requestedRole?: string) => Promise<{success: boolean, error?: string, role?: string}>;
  loginAs: (role: Role) => void;
  logout: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const router = useRouter();

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("aegis_user") : null;
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { /* skip */ }
    }
    setIsLoading(false);

    // Sync theme
    const savedTheme = localStorage.getItem("aegis_theme") as "dark" | "light" | null;
    const currentTheme = savedTheme || "dark";
    setTheme(currentTheme);
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const login = async (email: string, pass: string, requestedRole?: string) => {
    try {
      const response = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.detail || "Invalid credentials" };
      }

      const data = await response.json();
      
      if (requestedRole && data.role !== requestedRole) {
         return { success: false, role: data.role, error: `Unauthorized. You are assigned as ${data.role}, but tried to access ${requestedRole}.` };
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      
      const loggedUser = {
        id: data.id || "usr_db_" + Date.now(),
        name: data.full_name || email.split("@")[0],
        fullName: data.full_name || email.split("@")[0],
        email: email,
        role: data.role,
        department: data.department || "General",
        organization: data.organization_id || "AegisOne Platform"
      };
      
      setUser(loggedUser as User);
      localStorage.setItem("aegis_user", JSON.stringify(loggedUser));
      
      return { success: true, role: data.role };
    } catch (err: any) {
      // Fallback to mock data if backend is unreachable
      const found = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (found) {
        setUser(found as User);
        localStorage.setItem("aegis_user", JSON.stringify(found));
        return { success: true, role: found.role };
      }
      return { success: false, error: err.message || "Failed to connect to server and user not found in mock fallback." };
    }
  };

  const loginAs = (role: Role) => {
    const found = mockUsers.find(u => u.role === role);
    if (found) {
      setUser(found as User);
      localStorage.setItem("aegis_user", JSON.stringify(found));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("aegis_user");
    router.push("/login");
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("aegis_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginAs, logout, theme, toggleTheme }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
