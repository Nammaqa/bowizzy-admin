import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminDeletedUsers from "./pages/AdminDeletedUsers";
import AdminPlanStats from "./pages/AdminPlanStats";
import AdminInterviews from "./pages/AdminInterviews";
import AdminPricing from "./pages/AdminPricing";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* default redirect */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* admin login */}
        <Route path="/login" element={<AdminLogin />} />

        {/* admin dashboard (after login) */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/deleted-users" element={<AdminDeletedUsers />} />
        <Route path="/admin/plans" element={<AdminPlanStats />} />
        <Route path="/admin/pricing" element={<AdminPricing />} />
        <Route path="/admin/interviews" element={<AdminInterviews />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
