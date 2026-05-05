import { useEffect, useState } from "react";
import { getInterviewSlotStats, getAcceptedInterviews } from "../services/admin";
import AdminLayout from "../components/AdminLayout";
import "./AdminInterviews.redesign.css";

type Slot = {
  interview_slot_id: number;
  interview_code: string;
  candidate_id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_number?: string;
  job_role: string;
  interview_mode: string;
  experience: string;
  skills: string[];
  resume_url?: string;
  interview_status: string;
  start_time_utc: string;
  end_time_utc: string;
  is_payment_done?: boolean;
};

type AcceptedInterview = {
  interview_schedule_id: number;
  meeting_link?: string;
  date_time?: string;
  end_time_utc?: string;
  candidate_first_name?: string;
  candidate_last_name?: string;
  interviewer_first_name?: string;
  interviewer_last_name?: string;
  interview_mode?: string;
  interview_status?: string;
};

// Returns true if the interview starts within 1 hour from now
function isUrgent(start_time_utc?: string): boolean {
  if (!start_time_utc) return false;
  const start = new Date(start_time_utc).getTime();
  const now = Date.now();
  const diffMs = start - now;
  return diffMs > 0 && diffMs <= 60 * 60 * 1000;
}

// Returns true if the interview start time has already passed
function isExpired(end_time_utc?: string): boolean {
  if (!end_time_utc) return false;
  return new Date(end_time_utc).getTime() < Date.now();
}

export default function AdminInterviews() {
  const [from, setFrom] = useState(() => {
  const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [acceptedInterviews, setAcceptedInterviews] = useState<AcceptedInterview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"open" | "accepted" | "cancelled">("open");
  const itemsPerPage = 6;

  const allSlots = slots;
  const confirmedInterviews = acceptedInterviews.filter((i) => i.interview_status?.toLowerCase() === "confirmed");
  const cancelledInterviews = acceptedInterviews.filter((i) => i.interview_status?.toLowerCase() === "cancelled");

  const filteredSlots =
    activeTab === "open"
      ? allSlots.filter((s) => s.interview_status?.toLowerCase() === "open")
      : activeTab === "accepted"
        ? confirmedInterviews
        : cancelledInterviews;

  const totalPages = Math.ceil(filteredSlots.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedSlots = activeTab === "open"
    ? (filteredSlots as Slot[]).slice(startIdx, startIdx + itemsPerPage)
    : (filteredSlots as AcceptedInterview[]).slice(startIdx, startIdx + itemsPerPage);

  // ── Fetch Accepted Interviews ────────────────────────────────────────────
  const fetchAcceptedInterviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAcceptedInterviews();
      const interviews = Array.isArray(data) ? data : data?.data || data || [];
      setAcceptedInterviews(interviews);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load accepted interviews");
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch Slots ───────────────────────────────────────────────────────────
  const fetchSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInterviewSlotStats({ from, to });
      const rows = Array.isArray(data) ? data : data?.rows || [];

      const normalized = (rows || []).map((r: any) => ({
        ...r,
        first_name:
          r.first_name ?? r.candidate_first_name ?? r.candidate?.first_name ?? r.candidate?.firstName ?? null,
        last_name:
          r.last_name ?? r.candidate_last_name ?? r.candidate?.last_name ?? r.candidate?.lastName ?? null,
        email: r.email ?? r.candidate_email ?? r.candidate?.email ?? null,
        mobile_number:
          r.mobile_number ??
          r.candidate_mobile_number ??
          r.candidate?.mobile_number ??
          r.candidate?.phone ??
          null,
        resume_url:
          r.resume_url ??
          r.candidate_resume_url ??
          r.candidate?.resume_url ??
          r.candidate?.resumeUrl ??
          r.cv_url ??
          null,
      }));

      const safeTime = (obj: any) => {
        const t = obj?.start_time_utc ?? obj?.created_at ?? obj?.ts_range ?? null;
        const parsed = Date.parse(t || "");
        return Number.isNaN(parsed) ? 0 : parsed;
      };
      normalized.sort((a: any, b: any) => safeTime(b) - safeTime(a));

      setSlots(normalized || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load interview slots");
    } finally {
      setLoading(false);
    }
  };

  // ── Formatters ────────────────────────────────────────────────────────────
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

  const formatExperience = (exp?: string) => {
    if (!exp) return "Fresher";
    const yMatch = exp.match(/(\d+)\s*years?/i);
    const mMatch = exp.match(/(\d+)\s*months?/i);
    const years = yMatch ? parseInt(yMatch[1], 10) : 0;
    const months = mMatch ? parseInt(mMatch[1], 10) : 0;
    const total = years + months / 12;
    if (Math.round(total * 10) === 0) return "Fresher";
    return `${total.toFixed(1)} years`;
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) root.classList.add("full-bleed");
    fetchSlots();
    return () => {
      if (root) root.classList.remove("full-bleed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "accepted") {
      fetchAcceptedInterviews();
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
  }, [filteredSlots.length, totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    fetchSlots();
  }, [from, to]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout headerTitle="Interviews" headerSubtitle="Manage interviews and interviewers">
      <section className="interviews-page">

        {/* ── TABS ── */}
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === "open" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("open");
              setCurrentPage(1);
            }}
          >
            Interview Slots ({allSlots.filter((s) => s.interview_status?.toLowerCase() === "open").length})
          </button>
          <button
            className={`tab-btn ${activeTab === "accepted" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("accepted");
              setCurrentPage(1);
            }}
          >
            Accepted Interview Slots ({confirmedInterviews.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "cancelled" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("cancelled");
              setCurrentPage(1);
            }}
          >
            Cancelled Interviews ({cancelledInterviews.length})
          </button>
        </div>

        {/* ── DATE FILTER (only for open slots) ── */}
        {activeTab === "open" && (
          <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: "10px", border: "1px solid #e0e0e0", display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>From Date</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", fontFamily: "inherit", cursor: "pointer" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>To Date</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", fontFamily: "inherit", cursor: "pointer" }}
              />
            </div>
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                setFrom(d.toISOString().slice(0, 10));
                setTo(new Date().toISOString().slice(0, 10));
              }}
              style={{ padding: "10px 16px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer", color: "#374151", transition: "all 0.2s ease" }}
              onMouseOver={(e) => { e.currentTarget.style.background = "#e5e7eb"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "#f3f4f6"; }}
            >
              Reset (Last 30 days)
            </button>
          </div>
        )}

        {/* ══════════════════ INTERVIEW SLOTS ══════════════════ */}
        <div className="list-card slots-card">
          <h4>{activeTab === "open" ? "Interview Slots" : activeTab === "accepted" ? "Accepted Interviews" : "Cancelled Interviews"}</h4>
          {loading ? (
            <div className="state-message">Loading...</div>
          ) : error ? (
            <div className="error-text">{error}</div>
          ) : filteredSlots.length === 0 ? (
            <div className="state-message">No {activeTab} interviews found.</div>
          ) : activeTab === "open" ? (
            /* OPEN SLOTS TABLE */
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Skills</th>
                    <th>Mode</th>
                    <th>Date</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Resume</th>
                  </tr>
                </thead>
                <tbody>
                  {(paginatedSlots as Slot[]).map((s, idx) => {
                    const urgent = isUrgent(s.start_time_utc);
                    const expired = isExpired(s.start_time_utc);
                    return (
                      <tr
                        key={s.interview_slot_id}
                        className={`slot-row ${expired ? "row-expired" : ""}`}
                        onClick={() => {
                          if (expired) return;
                          setSelectedSlot(s);
                          setShowModal(true);
                        }}
                      >
                        <td className="sn-cell">{startIdx + idx + 1}</td>
                        <td className="candidate-cell">
                          {s.first_name || ""} {s.last_name || ""}
                        </td>
                        <td className="role-cell">
                          <div className="role-title">{s.job_role}</div>
                        </td>
                        <td className="skills-cell">
                          <div className="skills-row">
                            {(s.skills || []).slice(0, 6).map((sk) => (
                              <span key={sk} className="skill-badge">
                                {sk}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="mode-cell capitalize">{s.interview_mode}</td>
                        <td className="date-cell mono">{formatDateShort(s.start_time_utc)}</td>
                        <td className="priority-cell">
                          {expired ? (
                            <span className="priority-badge urgent">🔴 Expired</span>
                          ) : (
                            <span className={`priority-badge ${urgent ? "urgent" : "normal"}`}>
                              {urgent ? "🔴 Urgent" : "🟢 Normal"}
                            </span>
                          )}
                        </td>
                        <td className="expired-cell">
                          <span className={`expired-badge ${expired ? "is-expired" : "is-active"}`}>
                            {expired ? "Expired" : "Active"}
                          </span>
                        </td>
                        <td className="payment-cell">{s.is_payment_done ? "Paid" : "Unpaid"}</td>
                        <td className="resume-cell">
                          <button
                            className="action-btn"
                            disabled={expired}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!expired && s.resume_url) window.open(s.resume_url, "_blank");
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ACCEPTED/CANCELLED INTERVIEWS TABLE */
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Candidate Name</th>
                    <th>Interviewer</th>
                    <th>Date & Time</th>
                    <th>Meeting Link</th>
                  </tr>
                </thead>
                <tbody>
                  {(paginatedSlots as AcceptedInterview[]).map((interview, idx) => {
                    const isExpiredInterview = isExpired(interview.end_time_utc);
                    return (
                      <tr key={interview.interview_schedule_id} className={`slot-row ${isExpiredInterview ? "row-expired" : ""}`}>
                        <td className="sn-cell">{startIdx + idx + 1}</td>
                        <td className="candidate-cell">
                          {interview.candidate_first_name || ""} {interview.candidate_last_name || ""}
                        </td>
                        <td className="candidate-cell">
                          {interview.interviewer_first_name || ""} {interview.interviewer_last_name || ""}
                        </td>
                        <td className="date-cell mono">
                          {interview.date_time ? (
                            <>
                              <div>{formatDateShort(interview.date_time)}</div>
                              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                                {formatTime(interview.date_time)}
                              </div>
                            </>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="candidate-cell">
                          {activeTab === "cancelled" ? (
                            <span className="cancelled-badge">❌ Cancelled</span>
                          ) : isExpiredInterview ? (
                            <span className="expired-badge is-expired">Expired</span>
                          ) : interview.meeting_link ? (
                            <a
                              href={interview.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-btn"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Join Meeting
                            </a>
                          ) : (
                            "-"
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

        {/* Slots Pagination */}
        {slots.length > 0 && totalPages > 1 && (
          <PaginationBar current={currentPage} total={totalPages} onChange={setCurrentPage} />
        )}

        {/* Slot Detail Modal */}
        {showModal && selectedSlot && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{selectedSlot.interview_code}</h3>
                <button className="tiny" onClick={() => setShowModal(false)}>
                  Close
                </button>
              </div>
              <div className="modal-body">
                <p>
                  <strong>Code:</strong> {selectedSlot.interview_code}
                </p>
                <p>
                  <strong>Name:</strong> {selectedSlot.first_name || ""} {selectedSlot.last_name || ""}
                </p>
                <p>
                  <strong>Email:</strong> {selectedSlot.email || "-"}
                </p>
                <p>
                  <strong>Mobile:</strong> {selectedSlot.mobile_number || "-"}
                </p>
                <p>
                  <strong>Role:</strong> {selectedSlot.job_role}
                </p>
                <p>
                  <strong>Mode:</strong> {selectedSlot.interview_mode}
                </p>
                <p>
                  <strong>Experience:</strong> {formatExperience(selectedSlot.experience)}
                </p>
                <p>
                  <strong>Start:</strong> {formatTime(selectedSlot.start_time_utc)}
                </p>
                <p>
                  <strong>End:</strong> {formatTime(selectedSlot.end_time_utc)}
                </p>
                <p>
                  <strong>Priority:</strong>{" "}
                  <span
                    className={`priority-badge ${isUrgent(selectedSlot.start_time_utc) ? "urgent" : "normal"}`}
                  >
                    {isUrgent(selectedSlot.start_time_utc) ? "🔴 Urgent" : "🟢 Normal"}
                  </span>
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className={`expired-badge ${isExpired(selectedSlot.start_time_utc) ? "is-expired" : "is-active"}`}>
                    {isExpired(selectedSlot.start_time_utc) ? "Expired" : "Active"}
                  </span>
                </p>
                <p>
                  <strong>Payment:</strong> {selectedSlot.is_payment_done ? "Paid" : "Unpaid"}
                </p>
                <p>
                  <strong>Skills:</strong>
                </p>
                <div className="skills-row">
                  {(selectedSlot.skills || []).map((sk) => (
                    <span key={sk} className="skill-badge">
                      {sk}
                    </span>
                  ))}
                </div>
                {selectedSlot.resume_url && (
                  <p style={{ marginTop: 12 }}>
                    <button
                      className="action-btn"
                      onClick={() => window.open(selectedSlot.resume_url, "_blank")}
                    >
                      Open Resume
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </AdminLayout >
  );
}

// ── Small Reusable Components ─────────────────────────────────────────────────

function PaginationBar({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pages = Array.from({ length: total }, (_, i) => i + 1).slice(
    Math.max(0, current - 2),
    Math.min(total, current + 1)
  );
  return (
    <div className="pagination-container">
      <button
        className="pagination-btn"
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current === 1}
      >
        &lt;
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={`pagination-btn ${current === p ? "active" : ""}`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        className="pagination-btn"
        onClick={() => onChange(Math.min(total, current + 1))}
        disabled={current === total}
      >
        &gt;
      </button>
    </div>
  );
}