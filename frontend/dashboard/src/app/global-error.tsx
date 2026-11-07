"use client";

// Last-resort screen: if anything throws while the app starts, show this instead of a blank page or an endless spinner.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const resetSession = () => {
    try {
      ["aegis_access_token", "aegis_token", "aegis_refresh_token", "user", "aegis_setup_done"].forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
      document.cookie = "aegis_user=; Max-Age=0; path=/;";
    } catch { /* storage may be blocked */ }
    window.location.assign("/login");
  };
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#F6FAFD", color: "#0A1931", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#4A6D8C", fontSize: 14, lineHeight: 1.5, margin: "0 0 20px" }}>
            AegisOne could not start in this browser. Try again; if it keeps happening, reset the saved sign-in on this device and sign in again.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => reset()} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #C7DAE8", background: "#fff", color: "#0A1931", cursor: "pointer" }}>Try again</button>
            <button onClick={resetSession} style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: "#3D6C90", color: "#fff", cursor: "pointer" }}>Reset saved sign-in</button>
          </div>
        </main>
      </body>
    </html>
  );
}
