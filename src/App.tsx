import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { Shipments } from "./pages/Shipments";
import { Suppliers } from "./pages/Suppliers";
import { Settings as SettingsPage } from "./pages/Settings";
import { ThemeProvider } from "./components/ThemeProvider";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Subscribe } from "./pages/Subscribe";
import { MasterPanel } from "./pages/MasterPanel";
import { AccessGuard } from "./components/AccessGuard";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="altec-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          
          <Route 
            path="/master" 
            element={
              <AccessGuard requireMaster>
                <AppLayout>
                  <MasterPanel />
                </AppLayout>
              </AccessGuard>
            } 
          />

          <Route 
            path="/app/*" 
            element={
              <AccessGuard>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="shipments" element={<Shipments />} />
                    <Route path="suppliers" element={<Suppliers />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Routes>
                </AppLayout>
              </AccessGuard>
            } 
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
