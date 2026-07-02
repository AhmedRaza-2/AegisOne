import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import PortalPage from './pages/PortalPage.tsx';
import './index.css';

console.log("main.tsx: Script started executing");

try {
  const rootEl = document.getElementById('root');
  console.log("main.tsx: Root element found:", rootEl);
  
  if (!rootEl) {
    throw new Error("Target container 'root' not found in DOM");
  }

  const root = createRoot(rootEl);
  console.log("main.tsx: createRoot initialized");

  root.render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/"         element={<App />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/portal"   element={<PortalPage />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>,
  );
  console.log("main.tsx: React render triggered");
} catch (error) {
  console.error("main.tsx: Critical error during startup/render:", error);
}

