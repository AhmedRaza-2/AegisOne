"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Role, users as mockUsers } from "@/lib/mock-data";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{success: boolean, error?: string, role?: string}>;
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

  const login = async (email: string, password: string): Promise<{success: boolean, error?: string, role?: string}> => {
    try {
      const res = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) {
        const err = await res.json();
        return { success: false, error: err.detail || "Invalid credentials." };
      }
      
      const data = await res.json();
      
      // Map API response to frontend User model
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
      localStorage.setItem("aegis_token", data.access_token);
      
      return { success: true, role: data.role };
    } catch (e: any) {
      // Fallback to mock data if backend is unreachable or for default mocked admin accounts
      const found = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (found) {
        setUser(found);
        localStorage.setItem("aegis_user", JSON.stringify(found));
        return { success: true, role: found.role };
      }
      return { success: false, error: "Network error and user not found in mock fallback." };
    }
  };


  const loginAs = (role: Role) => {
    const found = mockUsers.find(u => u.role === role);
    if (found) {
      setUser(found);
      localStorage.setItem("aegis_user", JSON.stringify(found));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("aegis_user");
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
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
