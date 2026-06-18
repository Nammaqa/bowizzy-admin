import React, { useEffect, useState } from "react";
import { getPriorityInterviews, getAllInterviews } from "../services/admin";
import AdminLayout from "../components/AdminLayout";
import "./AdminInterviews.redesign.css";

type MockInterview = {
  mock_interview_id: number;
  candidate_id: number;
  interviewer_id: number | null;
  interview_status: string;
  start_time_utc: string;
  end_time_utc: string;
  meeting_link: string | null;
  interview_type: string;
  payment_status: string;
  resume_url: string | null;
  experience_months: number | null;
  amount: string;
  skills: string | null;
  job_role: string | null;
  priority_status: string;
  cancelled_by: string | null;
};

export default function AdminInterviews() {
  const [activeTab, setActiveTab] = useState<"priority" | "all">("priority");
  const [priorityInterviews, setPriorityInterviews] = useState<MockInterview[]>([]);
  const [allInterviews, setAllInterviews] = useState<MockInterview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInterviews = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "priority") {
        const data = await getPriorityInterviews();
        const rows = Array.isArray(data) ? data : data?.data || data?.rows || [];
        setPriorityInterviews(rows);
      } else {
        const data = await getAllInterviews();
        const rows = Array.isArray(data) ? data : data?.data || data?.rows || [];
        setAllInterviews(rows);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load interviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, [activeTab]);

  const activeData = activeTab === "priority" ? priorityInterviews : allInterviews;

  // ── Expiry check based on system time ──────────────────────────────────────
  const isExpired = (endTimeUtc?: string): boolean => {
    if (!endTimeUtc) return false;
    return new Date(endTimeUtc) < new Date();
  };

  // ── Formatters ─────────────────────────────────────────────────────────────
  const formatDateShort = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
      d.getFullYear()
    ).slice(-2)}`;
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const formatExperience = (months?: number | null) => {
    if (!months) return "Fresher";
    if (months < 12) return `${months} mo`;
    const years = months / 12;
    return `${years % 1 === 0 ? years : years.toFixed(1)} yr`;
  };

  // ── Stats derived from current tab data ────────────────────────────────────
  const stats = {
    total: activeData.length,
    active: activeData.filter((i) => !isExpired(i.end_time_utc) && !i.interview_status.toLowerCase().includes("cancel")).length,
    expired: activeData.filter((i) => isExpired(i.end_time_utc)).length,
    priority: activeData.filter((i) => i.priority_status === "priority").length,
  };

  // ── Status badge ───────────────────────────────────────────────────────────
  const renderStatusBadge = (item: MockInterview) => {
    const expired = isExpired(item.end_time_utc);
    const s = item.interview_status.toLowerCase();

    if (expired) {
      return <span className="status-badge status-expired">Expired</span>;
    }
    if (s.includes("cancel")) {
      return <span className="status-badge status-cancelled">{item.interview_status.replace(/_/g, " ")}</span>;
    }
    if (s.includes("scheduled") || s.includes("confirmed") || s.includes("active")) {
      return <span className="status-badge status-active">{item.interview_status.replace(/_/g, " ")}</span>;
    }
    if (s.includes("pending")) {
      return <span className="status-badge status-pending">{item.interview_status.replace(/_/g, " ")}</span>;
    }
    return <span className="status-badge status-default">{item.interview_status.replace(/_/g, " ")}</span>;
  };

  return (
    <AdminLayout headerTitle="Mock Interviews" headerSubtitle="Manage and track all mock interviews">
      <section className="interviews-page">

        {/* ── Tabs ── */}
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === "priority" ? "active" : ""}`}
            onClick={() => setActiveTab("priority")}
          >
            Priority interviews
            {priorityInterviews.length > 0 && (
              <span className="tab-count">{priorityInterviews.length}</span>
            )}
          </button>
          <button
            className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All interviews
            {allInterviews.length > 0 && (
              <span className="tab-count">{allInterviews.length}</span>
            )}
          </button>
        </div>

        {/* ── Stats bar ── */}
        {!loading && !error && activeData.length > 0 && (
          <div className="stats-bar">
            <div className="stat-chip">
              <span className="stat-label">Total</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-chip stat-chip--green">
              <span className="stat-label">Active</span>
              <span className="stat-value">{stats.active}</span>
            </div>
            <div className="stat-chip stat-chip--gray">
              <span className="stat-label">Expired</span>
              <span className="stat-value">{stats.expired}</span>
            </div>
            <div className="stat-chip stat-chip--red">
              <span className="stat-label">Priority</span>
              <span className="stat-value">{stats.priority}</span>
            </div>
          </div>
        )}

        {/* ── Table card ── */}
        <div className="list-card slots-card">
          <div className="card-header">
            <h4>{activeTab === "priority" ? "Priority interviews" : "All interviews"}</h4>
            {!loading && !error && (
              <span className="count-pill">{activeData.length} total</span>
            )}
          </div>

          {loading ? (
            <div className="state-message">
              <span className="spinner" />
              Loading interviews…
            </div>
          ) : error ? (
            <div className="error-text">{error}</div>
          ) : activeData.length === 0 ? (
            <div className="state-message">No interviews found.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Role</th>
                    <th>Skills</th>
                    <th>Experience</th>
                    <th>Date & time</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Links</th>
                  </tr>
                </thead>
                <tbody>
                  {activeData.map((item) => {
                    const expired = isExpired(item.end_time_utc);
                    const skills = item.skills ? item.skills.split(", ") : [];
                    const visibleSkills = skills.slice(0, 3);
                    const extraCount = skills.length - 3;

                    return (
                      <tr
                        key={item.mock_interview_id}
                        className={`slot-row ${expired ? "row-expired" : ""}`}
                      >
                        {/* ID */}
                        <td className="sn-cell">#{item.mock_interview_id}</td>

                        {/* Role */}
                        <td className="role-cell">
                          <span className="role-title" title={item.job_role || ""}>
                            {item.job_role || "N/A"}
                          </span>
                        </td>

                        {/* Skills */}
                        <td className="skills-cell">
                          <div className="skills-row">
                            {visibleSkills.map((sk) => (
                              <span key={sk} className="skill-badge">{sk}</span>
                            ))}
                            {extraCount > 0 && (
                              <span className="skill-badge skill-badge--more">+{extraCount}</span>
                            )}
                          </div>
                        </td>

                        {/* Experience */}
                        <td className="exp-cell">{formatExperience(item.experience_months)}</td>

                        {/* Date & Time */}
                        <td className="date-cell">
                          <div className="date-primary">{formatDateShort(item.start_time_utc)}</div>
                          <div className="date-secondary">
                            {formatTime(item.start_time_utc)} – {formatTime(item.end_time_utc)}
                          </div>
                        </td>

                        {/* Type */}
                        <td className="capitalize type-cell">{item.interview_type}</td>

                        {/* Status */}
                        <td>{renderStatusBadge(item)}</td>

                        {/* Priority */}
                        <td className="priority-cell">
                          <span
                            className={`priority-badge ${
                              item.priority_status === "priority" ? "priority-badge--urgent" : "priority-badge--normal"
                            }`}
                          >
                            <span className="priority-dot" />
                            {item.priority_status === "priority" ? "Priority" : "Normal"}
                          </span>
                        </td>

                        {/* Links */}
                        <td className="links-cell">
                          {item.resume_url ? (
                            <button
                              className="link-action link-action--resume"
                              onClick={() => window.open(item.resume_url as string, "_blank")}
                            >
                              Resume
                            </button>
                          ) : (
                            <span className="no-link">No resume</span>
                          )}
                          {item.meeting_link && (
                            <a
                              href={item.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-action link-action--join"
                            >
                              Join
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}