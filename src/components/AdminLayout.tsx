import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../services/admin";
import bowizzyLogo from "../assets/bowizzy.png";
import "../pages/AdminDashboard.css";

interface AdminLayoutProps {
  children: React.ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  headerTitle = "Welcome to BoWizzy Admin",
  headerSubtitle = "superadmin"
}) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-root">
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-card">
          <img src={bowizzyLogo} alt="Bowizzy Logo" className="logo-img" />

          <nav className="nav">
            <div className="nav-section">
              <div className="nav-section-label">Dashboard</div>
              <NavLink
                to="/admin/dashboard"
                end
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <span className="nav-icon">📊</span>
                <span>Dashboard</span>
              </NavLink>
            </div>

            <div className="nav-section">
              <div className="nav-section-label">Management</div>
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <span className="nav-icon">👥</span>
                <span>Users</span>
              </NavLink>
              <NavLink
                to="/admin/interviews"
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <span className="nav-icon">📹</span>
                <span>Mock Interview</span>
              </NavLink>
              {/* <NavLink
                to="/admin/resumes"
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <span className="nav-icon">📄</span>
                <span>Resumes</span>
              </NavLink>
              <NavLink
                to="/admin/plans"
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <span className="nav-icon">💳</span>
                <span>Plans</span>
              </NavLink>
              <NavLink
                to="/admin/pricing"
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <span className="nav-icon">💲</span>
                <span>Pricing</span>
              </NavLink> */}
            </div>
          </nav>
        </div>

        <div className="sidebar-footer">
          <button
            className="logout-btn"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="main-header">
          <div>
            <h2>{headerTitle}</h2>
            <div className="sub">{headerSubtitle}</div>
          </div>
          <button
            className="hamburger-menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>

          <div className="header-actions"></div>
        </header>

        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
