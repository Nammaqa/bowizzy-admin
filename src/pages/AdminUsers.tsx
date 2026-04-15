import { useEffect, useState } from "react";
import {
  getInterviewersWithBankDetails,
  markInterviewerVerified,
  getUsers,
} from "../services/admin";
import AdminLayout from "../components/AdminLayout";

// Reuse the Users page CSS — same design system
import "./AdminUsers.css";

type Interviewer = {
  bank_id?: number;
  user_id: number;
  bank_name?: string;
  account_holder_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_type?: string;
  branch_name?: string;
  document_url?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_verified?: boolean;
  is_interviewer_verified?: string | boolean;
  company_names?: string[];
  institution_names?: string[];
  user_type?: string;
  personal_details?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    mobile_number?: string;
    profile_photo_url?: string;
  };
  skills?: Array<{ skill_name: string; skill_level: string }>;
  education_details?: Array<{ institution_name: string; degree?: string; field_of_study?: string }>;
  work_experience?: Array<{ company_name: string; job_title?: string }>;
  job_roles?: Array<{ job_role: string }>;
};

const ITEMS_PER_PAGE = 8;

export default function AdminInterviews() {
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "all_users">("pending");
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [allUsers, setAllUsers] = useState<Interviewer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [selectedInterviewer, setSelectedInterviewer] = useState<Interviewer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const initials = (iv: Interviewer) => {
    const firstName = iv.first_name ?? iv.personal_details?.first_name ?? "";
    const lastName = iv.last_name ?? iv.personal_details?.last_name ?? "";
    return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  };

  const fullName = (iv: Interviewer) => {
    const firstName = iv.first_name ?? iv.personal_details?.first_name ?? "";
    const lastName = iv.last_name ?? iv.personal_details?.last_name ?? "";
    return [firstName, lastName].filter(Boolean).join(" ") || "—";
  };

  const getIsVerified = (iv: Interviewer): boolean => {
    if (iv.is_verified !== undefined) return iv.is_verified;
    if (iv.is_interviewer_verified !== undefined) {
      return iv.is_interviewer_verified === "true" || iv.is_interviewer_verified === true;
    }
    return false;
  };

  const getCompanies = (iv: Interviewer): string[] => {
    if (iv.company_names && iv.company_names.length > 0) {
      return iv.company_names;
    }
    if (iv.work_experience && iv.work_experience.length > 0) {
      return iv.work_experience.map((exp) => exp.company_name).filter(Boolean);
    }
    return [];
  };

  const getEducation = (iv: Interviewer): string[] => {
    if (iv.institution_names && iv.institution_names.length > 0) {
      return iv.institution_names;
    }
    if (iv.education_details && iv.education_details.length > 0) {
      return iv.education_details.map((edu) => edu.institution_name).filter(Boolean);
    }
    return [];
  };

  // ── Derived lists ─────────────────────────────────────────────────────────
  const pendingList = interviewers.filter((i) => !getIsVerified(i));
  const approvedList = interviewers.filter((i) => getIsVerified(i));
  const displayList = activeTab === "pending" ? pendingList : activeTab === "approved" ? approvedList : allUsers;

  const totalPages = Math.ceil(displayList.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = displayList.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchInterviewers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInterviewersWithBankDetails();
      const list: Interviewer[] = Array.isArray(data) ? data : data?.data || [];
      setInterviewers(list);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load interviewers");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      const list: Interviewer[] = Array.isArray(data) ? data : data?.data || [];
      setAllUsers(list);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // ── Mark Verified ─────────────────────────────────────────────────────────
  const handleMarkVerified = async (userId: number) => {
    setVerifyingId(userId);
    try {
      await markInterviewerVerified(userId);
      await fetchInterviewers();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to verify interviewer");
    } finally {
      setVerifyingId(null);
    }
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchInterviewers();
    fetchAllUsers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    if (activeTab === "all_users") {
      fetchAllUsers();
    } else {
      fetchInterviewers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // ── Additional Helpers ──────────────────────────────────────────────────────
  const maskAccount = (num?: string) => {
    if (!num) return "—";
    return num.length > 4 ? `${"•".repeat(num.length - 4)}${num.slice(-4)}` : num;
  };

  const pageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (currentPage > 3) pages.push("…");
    for (
      let p = Math.max(2, currentPage - 1);
      p <= Math.min(totalPages - 1, currentPage + 1);
      p++
    )
      pages.push(p);
    if (currentPage < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  };

  return (
    <AdminLayout headerTitle="Users and Interviewers" headerSubtitle="Manage and verify interviewers and users">
      <div className="users-root">

        {/* ── STATS ── */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">Total Interviewers</div>
            <div className="stat-value" style={{ color: "#1f2937" }}>{interviewers.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Pending Verification</div>
            <div className="stat-value" style={{ color: "#c2410c" }}>{pendingList.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Approved</div>
            <div className="stat-value" style={{ color: "#047857" }}>{approvedList.length}</div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="view-buttons-container">
          <div style={{ display: "flex", gap: 0 }}>
            <button
              className={`view-btn ${activeTab === "pending" ? "active" : ""}`}
              style={{ borderRadius: "8px 0 0 8px", borderRight: "none" }}
              onClick={() => setActiveTab("pending")}
            >
              Pending ({pendingList.length})
            </button>
            <button
              className={`view-btn ${activeTab === "approved" ? "active" : ""}`}
              style={{ borderRight: "none" }}
              onClick={() => setActiveTab("approved")}
            >
              Approved ({approvedList.length})
            </button>
            <button
              className={`view-btn ${activeTab === "all_users" ? "active" : ""}`}
              style={{ borderRadius: "0 8px 8px 0" }}
              onClick={() => setActiveTab("all_users")}
            >
              All Users ({allUsers.length})
            </button>
          </div>
        </div>

        {/* ── TABLE CARD ── */}
        <div className="card">
          <div className="card-header">
            <h3>
              {activeTab === "pending"
                ? "Pending Interviewers"
                : activeTab === "approved"
                ? "Approved Interviewers"
                : "All Users"}
            </h3>
            <div className="card-count">
              <span
                className="count-dot"
                style={{
                  background:
                    activeTab === "pending"
                      ? "#c2410c"
                      : activeTab === "approved"
                      ? "#10b981"
                      : "#3b82f6",
                }}
              />
              <span className="count-label">Showing</span>
              <span className="count-value">{displayList.length}</span>
            </div>
          </div>

          <div className="table-wrapper">
            {loading ? (
              <div className="table-state">Loading…</div>
            ) : error ? (
              <div className="table-error">{error}</div>
            ) : displayList.length === 0 ? (
              <div className="table-state">
                No{" "}
                {activeTab === "all_users"
                  ? "users"
                  : activeTab === "pending"
                  ? "pending interviewers"
                  : "approved interviewers"}{" "}
                found.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th className="serial-col">#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Companies</th>
                    <th>Education</th>
                    <th>User Type</th>
                    <th className="action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((iv, idx) => (
                    <tr
                      key={iv.user_id}
                      className="clickable-row"
                      onClick={() => setSelectedInterviewer(iv)}
                    >
                      <td className="serial-col">{startIdx + idx + 1}</td>

                      <td>
                        <div className="user-cell">
                          <div
                            className="avatar"
                            style={{ background: "#fff7ed", color: "#ff7a2b", fontSize: 13 }}
                          >
                            {initials(iv)}
                          </div>
                          <div>
                            <div className="user-name">{fullName(iv)}</div>
                          </div>
                        </div>
                      </td>

                      <td className="mono" style={{ fontSize: 13 }}>{iv.email ?? "—"}</td>
                      <td>
                        {activeTab === "all_users" && getIsVerified(iv)
                          ? "Interviewer"
                          : iv.user_type ?? "—"}
                      </td>

                      <td>
                        <NamePills
                          items={getCompanies(iv)}
                          max={2}
                          color="#f0fdf4"
                          textColor="#047857"
                        />
                      </td>

                      <td>
                        <NamePills
                          items={getEducation(iv)}
                          max={2}
                          color="#eff6ff"
                          textColor="#1d4ed8"
                        />
                      </td>

                      <td>
                        <span
                          className="badge"
                          style={{
                            background: getIsVerified(iv) ? "#d1fae5" : "#fef3c7",
                            color: getIsVerified(iv) ? "#047857" : "#b45309",
                            fontSize: 12,
                            fontWeight: 500,
                            padding: "4px 8px",
                            borderRadius: 4,
                          }}
                        >
                          {getIsVerified(iv) ? "Interviewer" : "Candidate"}
                        </span>
                      </td>

                      <td className="action-col" onClick={(e) => e.stopPropagation()}>
                        {activeTab === "all_users" ? (
                          <span style={{ color: "#9ca3af" }}>—</span>
                        ) : activeTab === "pending" ? (
                          <button
                            className="btn primary"
                            disabled={verifyingId === iv.user_id}
                            onClick={() => handleMarkVerified(iv.user_id)}
                          >
                            {verifyingId === iv.user_id ? "Saving…" : "Verify"}
                          </button>
                        ) : (
                          <span className="badge success">{getIsVerified(iv) ? "Verified" : "Pending"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── PAGINATION ── */}
          {totalPages > 1 && (
            <div className="pagination-container">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ‹
              </button>
              <div className="pagination-numbers">
                {pageNumbers().map((p, i) =>
                  p === "…" ? (
                    <span key={`dots-${i}`} className="pagination-dots">…</span>
                  ) : (
                    <button
                      key={p}
                      className={`page-number ${currentPage === p ? "active" : ""}`}
                      onClick={() => setCurrentPage(p as number)}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ DETAIL MODAL ══ */}
      {selectedInterviewer && (
        <div className="modal-overlay" onClick={() => setSelectedInterviewer(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{fullName(selectedInterviewer)}</h2>
              <button className="modal-close" onClick={() => setSelectedInterviewer(null)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Personal Info */}
              <div className="modal-section">
                <h3>Personal Info</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <label>Full Name</label>
                    <span>{fullName(selectedInterviewer)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Email</label>
                    <span className="mono">{selectedInterviewer.email ?? "—"}</span>
                  </div>
                  <div className="detail-item">
                    <label>Role</label>
                    <span>{selectedInterviewer.user_type ?? "—"}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status</label>
                    <span>
                      <span
                        className={`badge ${getIsVerified(selectedInterviewer) ? "success" : "pending"}`}
                      >
                        {getIsVerified(selectedInterviewer) ? "Verified" : "Pending"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="modal-section">
                <h3>Bank Details</h3>
                <div className="bank-list">
                  <div className="bank-item">
                    <div className="bank-header">
                      <h4>{selectedInterviewer.bank_name ?? "—"}</h4>
                      {selectedInterviewer.account_type && (
                        <span className="account-type">{selectedInterviewer.account_type}</span>
                      )}
                    </div>
                    <div className="bank-details">
                      <p>
                        <strong>Account Holder:</strong>{" "}
                        {selectedInterviewer.account_holder_name ?? "—"}
                      </p>
                      <p>
                        <strong>Account Number:</strong>{" "}
                        <span className="account-masked">
                          {maskAccount(selectedInterviewer.account_number)}
                        </span>
                      </p>
                      <p>
                        <strong>IFSC Code:</strong>{" "}
                        <span className="mono">{selectedInterviewer.ifsc_code ?? "—"}</span>
                      </p>
                      <p>
                        <strong>Branch:</strong> {selectedInterviewer.branch_name ?? "—"}
                      </p>
                    </div>
                    {selectedInterviewer.document_url && (
                      <button
                        className="btn primary"
                        style={{ marginTop: 12 }}
                        onClick={() =>
                          window.open(selectedInterviewer.document_url, "_blank")
                        }
                      >
                        View Document
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Work Experience */}
              {getCompanies(selectedInterviewer).length > 0 && (
                <div className="modal-section">
                  <h3>Work Experience</h3>
                  <div className="experience-list">
                    {selectedInterviewer.work_experience && selectedInterviewer.work_experience.length > 0 ? (
                      selectedInterviewer.work_experience.map((exp, i) => (
                        <div key={i} className="experience-item">
                          <div className="exp-header">
                            <h4>{exp.company_name}</h4>
                            {exp.job_title && <span style={{ fontSize: 12, color: "#666" }}>{exp.job_title}</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      getCompanies(selectedInterviewer).map((company, i) => (
                        <div key={i} className="experience-item">
                          <div className="exp-header">
                            <h4>{company}</h4>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Education */}
              {getEducation(selectedInterviewer).length > 0 && (
                <div className="modal-section">
                  <h3>Education</h3>
                  <div className="education-list">
                    {selectedInterviewer.education_details && selectedInterviewer.education_details.length > 0 ? (
                      selectedInterviewer.education_details.map((edu, i) => (
                        <div key={i} className="education-item">
                          <div className="edu-header">
                            <span className="edu-type">{edu.degree || "Education"}</span>
                          </div>
                          <div className="edu-details">
                            <p><strong>{edu.institution_name}</strong></p>
                            {edu.field_of_study && <p style={{ fontSize: 12, color: "#666" }}>{edu.field_of_study}</p>}
                          </div>
                        </div>
                      ))
                    ) : (
                      getEducation(selectedInterviewer).map((inst, i) => (
                        <div key={i} className="education-item">
                          <div className="edu-header">
                            <span className="edu-type">Institution</span>
                          </div>
                          <div className="edu-details">
                            <p>{inst}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {!getIsVerified(selectedInterviewer) && (
                <button
                  className="btn primary"
                  disabled={verifyingId === selectedInterviewer.user_id}
                  onClick={async () => {
                    await handleMarkVerified(selectedInterviewer.user_id);
                    setSelectedInterviewer(null);
                  }}
                >
                  {verifyingId === selectedInterviewer.user_id ? "Saving…" : "Mark as Verified"}
                </button>
              )}
              <button
                className="btn"
                style={{ background: "#f3f4f6", color: "#374151" }}
                onClick={() => setSelectedInterviewer(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

// ── Pill list helper ───────────────────────────────────────────────────────
function NamePills({
  items,
  max,
  color,
  textColor,
}: {
  items?: string[];
  max: number;
  color: string;
  textColor: string;
}) {
  if (!items || items.length === 0)
    return <span style={{ color: "#9ca3af" }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {items.slice(0, max).map((item, i) => (
        <span
          key={i}
          style={{
            background: color,
            color: textColor,
            fontSize: 12,
            fontWeight: 500,
            padding: "3px 8px",
            borderRadius: 999,
          }}
        >
          {item}
        </span>
      ))}
      {items.length > max && (
        <span style={{ fontSize: 12, color: "#9ca3af", alignSelf: "center" }}>
          +{items.length - max}
        </span>
      )}
    </div>
  );
}