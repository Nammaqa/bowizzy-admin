import { useEffect, useState } from "react";
import { Check, Filter, X } from "lucide-react";
import {
  getPendingInterviewers,
  markInterviewerVerified,
  banInterviewer,
  updateInterviewerReviewStatus,
  getUsers,
  getAllInterviews,
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
  is_banned?: string | boolean;
  is_interviewer_banned?: string | boolean;
  review_status?: string;
  admin_review?: boolean;
  company_names?: string[];
  institution_names?: string[];
  user_type?: string;
  bank_details?: any[];
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

type AdminInterview = {
  candidate_id: number;
  interviewer_id: number | null;
  interview_status: string;
};

const ITEMS_PER_PAGE = 8;

export default function AdminInterviews() {
  const [activeTab, setActiveTab] = useState<"pending interviewers" | "all_users" | "interviewers">("pending interviewers");
  const [pendingInterviewers, setPendingInterviewers] = useState<Interviewer[]>([]);
  const [allUsers, setAllUsers] = useState<Interviewer[]>([]);
  const [allInterviews, setAllInterviews] = useState<AdminInterview[]>([]);
  const [interviewsLoading, setInterviewsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [selectedInterviewer, setSelectedInterviewer] = useState<Interviewer | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Interviewer | null>(null);
  const [successTarget, setSuccessTarget] = useState<Interviewer | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ iv: Interviewer; deactivate: boolean } | null>(null);
  const [statusSuccessTarget, setStatusSuccessTarget] = useState<{ iv: Interviewer; deactivated: boolean } | null>(
    null
  );
  const [reviewStatusUpdatingId, setReviewStatusUpdatingId] = useState<number | null>(null);
  const [reviewStatusTarget, setReviewStatusTarget] = useState<{
    iv: Interviewer;
    next: "active" | "under_review";
  } | null>(null);
  const [reviewStatusSuccessTarget, setReviewStatusSuccessTarget] = useState<{
    iv: Interviewer;
    status: "active" | "under_review";
    adminReview: boolean;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<"name" | "email">("name");
  const [accountStatusFilterTags, setAccountStatusFilterTags] = useState<Array<"active" | "deactivated">>([]);
  const [reviewStatusFilterTags, setReviewStatusFilterTags] = useState<Array<"active" | "under_review">>([]);

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
    return false;
  };

  const isInterviewerRole = (iv: Interviewer): boolean => {
    if ((iv.bank_details?.length ?? 0) > 0) return true;
    if (iv.is_interviewer_verified === true || iv.is_interviewer_verified === "true") return true;
    if ((iv.user_type ?? "").toLowerCase() === "interviewer") return true;
    return false;
  };

  const getIsDeactivated = (iv: Interviewer): boolean => {
    const value = iv.is_banned ?? iv.is_interviewer_banned;
    return value === true || value === "true";
  };

  const getReviewStatus = (iv: Interviewer): "active" | "under_review" =>
    (iv.review_status ?? "").toLowerCase() === "active" ? "active" : "under_review";

  const getReviewStatusLabel = (iv: Interviewer, adminReview = iv.admin_review === true): string => {
    if (getReviewStatus(iv) === "active") return "Active";
    return adminReview ? "Under Review by Admin" : "Under Review by User";
  };

  const hasActiveInterview = (iv: Interviewer): boolean =>
    allInterviews.some(
      (interview) =>
        interview.interview_status === "confirmed" &&
        (interview.candidate_id === iv.user_id || interview.interviewer_id === iv.user_id)
    );

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
  const pendingList = pendingInterviewers;
  const interviewersList = allUsers.filter(isInterviewerRole);

  // Narrow the interviewers list by the selected Account status / Review status tags (no tags in a group = show all for that group)
  const filteredInterviewersList = interviewersList.filter((iv) => {
    if (
      accountStatusFilterTags.length > 0 &&
      !accountStatusFilterTags.includes(getIsDeactivated(iv) ? "deactivated" : "active")
    ) {
      return false;
    }
    if (reviewStatusFilterTags.length > 0 && !reviewStatusFilterTags.includes(getReviewStatus(iv))) {
      return false;
    }
    return true;
  });

  const baseList =
    activeTab === "pending interviewers"
      ? pendingList
      : activeTab === "interviewers"
      ? filteredInterviewersList
      : allUsers;

  // Whether a row should be displayed/badged as an interviewer in the current tab
  const showAsInterviewer = (iv: Interviewer): boolean =>
    activeTab === "pending interviewers" || isInterviewerRole(iv) || getIsVerified(iv);

  // Filter by search query
  const filteredList = baseList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    if (searchField === "name") {
      return fullName(item).toLowerCase().includes(query);
    } else {
      return (item.email ?? "").toLowerCase().includes(query);
    }
  });

  const displayList = filteredList;
  const totalPages = Math.ceil(displayList.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = displayList.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchInterviewers = async () => {
    setLoading(true);
    setError(null);
    try {
      const pendingData = await getPendingInterviewers();
      const pList: Interviewer[] = Array.isArray(pendingData) ? pendingData : pendingData?.data || [];
      setPendingInterviewers(pList);
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

  const fetchAllInterviews = async () => {
    setInterviewsLoading(true);
    try {
      const data = await getAllInterviews();
      const list: AdminInterview[] = Array.isArray(data) ? data : data?.data || data?.rows || [];
      setAllInterviews(list);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load interviews");
    } finally {
      setInterviewsLoading(false);
    }
  };

  // ── Mark Verified ─────────────────────────────────────────────────────────
  const requestVerify = (iv: Interviewer) => setConfirmTarget(iv);

  const confirmVerify = async () => {
    if (!confirmTarget) return;
    const userId = confirmTarget.user_id;
    setVerifyingId(userId);
    try {
      await markInterviewerVerified(userId);
      await fetchInterviewers();
      setSuccessTarget(confirmTarget);
      setSelectedInterviewer(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to verify interviewer");
    } finally {
      setVerifyingId(null);
      setConfirmTarget(null);
    }
  };

  // ── Deactivate / Activate ────────────────────────────────────────────────
  const requestStatusChange = (iv: Interviewer) => setStatusTarget({ iv, deactivate: !getIsDeactivated(iv) });

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    const { iv, deactivate } = statusTarget;
    setDeactivatingId(iv.user_id);
    try {
      await banInterviewer(iv.user_id, deactivate);
      await fetchAllUsers();
      setStatusSuccessTarget({ iv, deactivated: deactivate });
      setSelectedInterviewer(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update interviewer status");
    } finally {
      setDeactivatingId(null);
      setStatusTarget(null);
    }
  };

  // ── Review Status ─────────────────────────────────────────────────────────
  const requestReviewStatusChange = (iv: Interviewer) =>
    setReviewStatusTarget({ iv, next: getReviewStatus(iv) === "active" ? "under_review" : "active" });

  const confirmReviewStatusChange = async () => {
    if (!reviewStatusTarget) return;
    const { iv, next } = reviewStatusTarget;
    setReviewStatusUpdatingId(iv.user_id);
    try {
      const response = await updateInterviewerReviewStatus(iv.user_id, next);
      await fetchAllUsers();
      setReviewStatusSuccessTarget({
        iv,
        status: next,
        adminReview: response?.admin_review ?? next === "under_review",
      });
      setSelectedInterviewer(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update review status");
    } finally {
      setReviewStatusUpdatingId(null);
      setReviewStatusTarget(null);
    }
  };

  const toggleAccountStatusFilterTag = (tag: "active" | "deactivated") => {
    setCurrentPage(1);
    setAccountStatusFilterTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const toggleReviewStatusFilterTag = (tag: "active" | "under_review") => {
    setCurrentPage(1);
    setReviewStatusFilterTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchInterviewers();
    fetchAllUsers();
    fetchAllInterviews();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
    setAccountStatusFilterTags([]);
    setReviewStatusFilterTags([]);
    if (activeTab === "all_users" || activeTab === "interviewers") {
      fetchAllUsers();
    } else {
      fetchInterviewers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);


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
            <div className="stat-title">Total Users</div>
            <div className="stat-value" style={{ color: "#1f2937" }}>{allUsers.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Pending Verification</div>
            <div className="stat-value" style={{ color: "#c2410c" }}>{pendingList.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Total Interviewers</div>
            <div className="stat-value" style={{ color: "#3b82f6" }}>{interviewersList.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Deactivated Interviewers</div>
            <div className="stat-value" style={{ color: "#b91c1c" }}>
              {interviewersList.filter(getIsDeactivated).length}
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="view-buttons-container">
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`view-btn ${activeTab === "pending interviewers" ? "active" : ""}`}
              onClick={() => setActiveTab("pending interviewers")}
            >
              Pending Interviewers ({pendingList.length})
            </button>
            <button
              className={`view-btn ${activeTab === "interviewers" ? "active" : ""}`}
              onClick={() => setActiveTab("interviewers")}
            >
              All Interviewers ({interviewersList.length})
            </button>
            <button
              className={`view-btn ${activeTab === "all_users" ? "active" : ""}`}
              onClick={() => setActiveTab("all_users")}
            >
              All Users ({allUsers.length})
            </button>
          </div>
        </div>

        {/* ── STATUS TAG FILTERS (Interviewers tab only) ── */}
        {activeTab === "interviewers" && (
          <div className="tag-filter-bar">
            <div className="tag-filter-bar-header">
              <span className="tag-filter-heading">
                <Filter size={14} />
                Filters
              </span>
              {(accountStatusFilterTags.length > 0 || reviewStatusFilterTags.length > 0) && (
                <button
                  type="button"
                  className="tag-filter-clear"
                  onClick={() => {
                    setAccountStatusFilterTags([]);
                    setReviewStatusFilterTags([]);
                  }}
                >
                  <X size={13} />
                  Clear all
                </button>
              )}
            </div>

            <div className="tag-filter-row">
              <span className="tag-filter-label">Account status</span>
              <div className="tag-filter-chips">
                <button
                  type="button"
                  className={`tag-chip tag-chip--active ${
                    accountStatusFilterTags.includes("active") ? "selected" : ""
                  }`}
                  onClick={() => toggleAccountStatusFilterTag("active")}
                  aria-pressed={accountStatusFilterTags.includes("active")}
                >
                  <span className="tag-chip-check">
                    {accountStatusFilterTags.includes("active") && <Check size={11} strokeWidth={3} />}
                  </span>
                  Active
                  <span className="tag-chip-count">
                    {interviewersList.filter((iv) => !getIsDeactivated(iv)).length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`tag-chip tag-chip--deactivated ${
                    accountStatusFilterTags.includes("deactivated") ? "selected" : ""
                  }`}
                  onClick={() => toggleAccountStatusFilterTag("deactivated")}
                  aria-pressed={accountStatusFilterTags.includes("deactivated")}
                >
                  <span className="tag-chip-check">
                    {accountStatusFilterTags.includes("deactivated") && <Check size={11} strokeWidth={3} />}
                  </span>
                  Deactivated
                  <span className="tag-chip-count">{interviewersList.filter(getIsDeactivated).length}</span>
                </button>
              </div>
            </div>

            <div className="tag-filter-row">
              <span className="tag-filter-label">Review status</span>
              <div className="tag-filter-chips">
                <button
                  type="button"
                  className={`tag-chip tag-chip--active ${
                    reviewStatusFilterTags.includes("active") ? "selected" : ""
                  }`}
                  onClick={() => toggleReviewStatusFilterTag("active")}
                  aria-pressed={reviewStatusFilterTags.includes("active")}
                >
                  <span className="tag-chip-check">
                    {reviewStatusFilterTags.includes("active") && <Check size={11} strokeWidth={3} />}
                  </span>
                  Active
                  <span className="tag-chip-count">
                    {interviewersList.filter((iv) => getReviewStatus(iv) === "active").length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`tag-chip tag-chip--under-review ${
                    reviewStatusFilterTags.includes("under_review") ? "selected" : ""
                  }`}
                  onClick={() => toggleReviewStatusFilterTag("under_review")}
                  aria-pressed={reviewStatusFilterTags.includes("under_review")}
                >
                  <span className="tag-chip-check">
                    {reviewStatusFilterTags.includes("under_review") && <Check size={11} strokeWidth={3} />}
                  </span>
                  Under Review
                  <span className="tag-chip-count">
                    {interviewersList.filter((iv) => getReviewStatus(iv) === "under_review").length}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SEARCH FILTER ── */}
        <div className="search-container">
          <div className="search-field-group">
            <label>Search By</label>
            <select
              className="search-field-dropdown"
              value={searchField}
              onChange={(e) => {
                setSearchField(e.target.value as "name" | "email");
                setCurrentPage(1);
              }}
            >
              <option value="name">Name</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div className="search-input-group">
            <input
              type="text"
              className="search-input"
              placeholder={`Search by ${searchField}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── TABLE CARD ── */}
        <div className="card">
          <div className="card-header">
            <h3>
              {activeTab === "pending interviewers"
                ? "Pending Interviewers"
                : activeTab === "interviewers"
                ? "All Interviewers"
                : "All Users"}
            </h3>
            <div className="card-count">
              <span
                className="count-dot"
                style={{
                  background:
                    activeTab === "pending interviewers"
                      ? "#c2410c"
                      : "#3b82f6",
                }}
              />
              <span className="count-label">Showing</span>
              <span className="count-value">{paginated.length}</span>
            </div>
          </div>

          <div className="table-wrapper">
            {loading ? (
              <div className="table-state">Loading…</div>
            ) : error ? (
              <div className="table-error">{error}</div>
            ) : displayList.length === 0 ? (
              <div className="table-state">
                {searchQuery ? (
                  <>
                    No results found for "{searchQuery}" in {searchField}.
                  </>
                ) : accountStatusFilterTags.length > 0 || reviewStatusFilterTags.length > 0 ? (
                  <>No interviewers match the selected filters.</>
                ) : (
                  <>
                    No{" "}
                    {activeTab === "all_users"
                      ? "users"
                      : activeTab === "interviewers"
                      ? "interviewers"
                      : "pending interviewers"}{" "}
                    found.
                  </>
                )}
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
                    <th>Review Status</th>
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
                        {showAsInterviewer(iv) ? "Interviewer" : iv.user_type ?? "—"}
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
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span
                            className="badge"
                            style={{
                              background: showAsInterviewer(iv) ? "#d1fae5" : "#fef3c7",
                              color: showAsInterviewer(iv) ? "#047857" : "#b45309",
                              fontSize: 12,
                              fontWeight: 500,
                              padding: "4px 8px",
                              borderRadius: 4,
                            }}
                          >
                            {showAsInterviewer(iv) ? "Interviewer" : "Candidate"}
                          </span>
                          {getIsDeactivated(iv) && (
                            <span
                              className="badge"
                              style={{
                                background: "#fee2e2",
                                color: "#b91c1c",
                                fontSize: 12,
                                fontWeight: 500,
                                padding: "4px 8px",
                                borderRadius: 4,
                              }}
                            >
                              Deactivated
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        {showAsInterviewer(iv) ? (
                          <span
                            className="badge"
                            style={{
                              background: getReviewStatus(iv) === "active" ? "#d1fae5" : "#fef3c7",
                              color: getReviewStatus(iv) === "active" ? "#047857" : "#b45309",
                              fontSize: 12,
                              fontWeight: 500,
                              padding: "4px 8px",
                              borderRadius: 4,
                            }}
                          >
                            {getReviewStatusLabel(iv)}
                          </span>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>—</span>
                        )}
                      </td>

                      <td className="action-col" onClick={(e) => e.stopPropagation()}>
                        {activeTab === "pending interviewers" ? (
                          <button
                            className="btn primary"
                            disabled={verifyingId === iv.user_id}
                            onClick={() => requestVerify(iv)}
                          >
                            {verifyingId === iv.user_id ? "Saving…" : "Verify"}
                          </button>
                        ) : isInterviewerRole(iv) ? (
                          <button
                            className="btn"
                            style={
                              getIsDeactivated(iv)
                                ? { background: "#d1fae5", color: "#047857" }
                                : { background: "#fee2e2", color: "#b91c1c" }
                            }
                            disabled={deactivatingId === iv.user_id}
                            onClick={() => requestStatusChange(iv)}
                          >
                            {deactivatingId === iv.user_id ? "Saving…" : getIsDeactivated(iv) ? "Activate" : "Deactivate"}
                          </button>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>—</span>
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
                    <span>
                      {isInterviewerRole(selectedInterviewer)
                        ? "Interviewer"
                        : selectedInterviewer.user_type ?? "—"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Review Status</label>
                    <span>
                      <span
                        className={`badge ${getReviewStatus(selectedInterviewer) === "active" ? "success" : "pending"}`}
                      >
                        {getReviewStatusLabel(selectedInterviewer)}
                      </span>
                    </span>
                  </div>
                  {isInterviewerRole(selectedInterviewer) && (
                    <div className="detail-item">
                      <label>Account Status</label>
                      <span>
                        <span
                          className="badge"
                          style={
                            getIsDeactivated(selectedInterviewer)
                              ? { background: "#fee2e2", color: "#b91c1c" }
                              : { background: "#d1fae5", color: "#047857" }
                          }
                        >
                          {getIsDeactivated(selectedInterviewer) ? "Deactivated" : "Active"}
                        </span>
                      </span>
                    </div>
                  )}
                  {(selectedInterviewer as any).created_at && (
                    <div className="detail-item">
                      <label>Created At</label>
                      <span>{new Date((selectedInterviewer as any).created_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  {(selectedInterviewer as any).updated_at && (
                    <div className="detail-item">
                      <label>Updated At</label>
                      <span>{new Date((selectedInterviewer as any).updated_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bank Details */}
              {(selectedInterviewer.bank_details?.length ?? 0) > 0 && (
                <div className="modal-section">
                  <h3>Bank Details</h3>
                  <div className="bank-list">
                    {selectedInterviewer.bank_details?.map((bank, i) => (
                      <div key={i} className="bank-item">
                        <div className="bank-header">
                          <h4>{bank.bank_name ?? "—"}</h4>
                          {bank.account_type && (
                            <span className="account-type">{bank.account_type}</span>
                          )}
                        </div>
                        <div className="bank-details">
                          <p>
                            <strong>Account Holder:</strong>{" "}
                            {bank.account_holder_name ?? "—"}
                          </p>
                          <p>
                            <strong>Account Number:</strong>{" "}
                            <span className="account-masked">
                              {bank.account_number}
                            </span>
                          </p>
                          <p>
                            <strong>IFSC Code:</strong>{" "}
                            <span className="mono">{bank.ifsc_code ?? "—"}</span>
                          </p>
                          <p>
                            <strong>Branch:</strong> {bank.branch_name ?? "—"}
                          </p>
                        </div>
                        {bank.document_url && (
                          <button
                            className="btn primary"
                            style={{ marginTop: 12 }}
                            onClick={() =>
                              window.open(bank.document_url, "_blank")
                            }
                          >
                            View Document
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Skills */}
              {selectedInterviewer.skills && selectedInterviewer.skills.length > 0 && (
                <div className="modal-section">
                  <h3>Skills</h3>
                  <div className="skills-list" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {selectedInterviewer.skills.map((skill, i) => (
                      <span key={i} className="badge" style={{ background: "#f3f4f6", color: "#374151" }}>
                        {skill.skill_name} {skill.skill_level && `(${skill.skill_level})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Job Roles */}
              {selectedInterviewer.job_roles && selectedInterviewer.job_roles.length > 0 && (
                <div className="modal-section" style={{ marginTop: 16 }}>
                  <h3>Job Roles</h3>
                  <div className="roles-list" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {selectedInterviewer.job_roles.map((role, i) => (
                      <span key={i} className="badge" style={{ background: "#e0e7ff", color: "#4338ca" }}>
                        {role.job_role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {!getIsVerified(selectedInterviewer) && (
                <button
                  className="btn primary"
                  disabled={verifyingId === selectedInterviewer.user_id}
                  onClick={() => requestVerify(selectedInterviewer)}
                >
                  {verifyingId === selectedInterviewer.user_id ? "Saving…" : "Mark as Verified"}
                </button>
              )}
              {isInterviewerRole(selectedInterviewer) && (
                <button
                  className="btn"
                  style={
                    getIsDeactivated(selectedInterviewer)
                      ? { background: "#d1fae5", color: "#047857" }
                      : { background: "#fee2e2", color: "#b91c1c" }
                  }
                  disabled={deactivatingId === selectedInterviewer.user_id}
                  onClick={() => requestStatusChange(selectedInterviewer)}
                >
                  {deactivatingId === selectedInterviewer.user_id
                    ? "Saving…"
                    : getIsDeactivated(selectedInterviewer)
                    ? "Activate Interviewer"
                    : "Deactivate Interviewer"}
                </button>
              )}
              {isInterviewerRole(selectedInterviewer) && (
                <button
                  className="btn"
                  style={
                    getReviewStatus(selectedInterviewer) === "active"
                      ? { background: "#fef3c7", color: "#b45309" }
                      : { background: "#d1fae5", color: "#047857" }
                  }
                  disabled={
                    reviewStatusUpdatingId === selectedInterviewer.user_id ||
                    (getReviewStatus(selectedInterviewer) === "active" &&
                      (interviewsLoading || hasActiveInterview(selectedInterviewer)))
                  }
                  onClick={() => requestReviewStatusChange(selectedInterviewer)}
                >
                  {reviewStatusUpdatingId === selectedInterviewer.user_id
                    ? "Saving…"
                    : getReviewStatus(selectedInterviewer) === "active"
                    ? "Move to Under Review"
                    : "Mark Review Active"}
                </button>
              )}
              {isInterviewerRole(selectedInterviewer) &&
                getReviewStatus(selectedInterviewer) === "active" &&
                hasActiveInterview(selectedInterviewer) && (
                  <p style={{ width: "100%", margin: 0, color: "#b45309", fontSize: 13 }}>
                    Please complete the active interview first.
                  </p>
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

      {/* ══ CONFIRM VERIFY MODAL ══ */}
      {confirmTarget && (
        <div
          className="modal-overlay"
          onClick={() => verifyingId !== confirmTarget.user_id && setConfirmTarget(null)}
        >
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18 }}>Confirm Verification</h2>
              <button
                className="modal-close"
                disabled={verifyingId === confirmTarget.user_id}
                onClick={() => setConfirmTarget(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: "#374151", fontSize: 14 }}>
                Do you want to accept <strong>{fullName(confirmTarget)}</strong> as an interviewer?
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn"
                style={{ background: "#f3f4f6", color: "#374151" }}
                disabled={verifyingId === confirmTarget.user_id}
                onClick={() => setConfirmTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={verifyingId === confirmTarget.user_id}
                onClick={confirmVerify}
              >
                {verifyingId === confirmTarget.user_id ? "Verifying…" : "Yes, Verify"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ VERIFIED SUCCESS MODAL ══ */}
      {successTarget && (
        <div className="modal-overlay" onClick={() => setSuccessTarget(null)}>
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18 }}>Interviewer Verified</h2>
              <button className="modal-close" onClick={() => setSuccessTarget(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <p style={{ margin: 0, color: "#374151", fontSize: 14 }}>
                <strong>{fullName(successTarget)}</strong> has been successfully verified as an interviewer.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={() => setSuccessTarget(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CONFIRM DEACTIVATE/ACTIVATE MODAL ══ */}
      {statusTarget && (
        <div
          className="modal-overlay"
          onClick={() => deactivatingId !== statusTarget.iv.user_id && setStatusTarget(null)}
        >
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18 }}>{statusTarget.deactivate ? "Confirm Deactivation" : "Confirm Activation"}</h2>
              <button
                className="modal-close"
                disabled={deactivatingId === statusTarget.iv.user_id}
                onClick={() => setStatusTarget(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: "#374151", fontSize: 14 }}>
                {statusTarget.deactivate ? (
                  <>
                    Do you want to deactivate <strong>{fullName(statusTarget.iv)}</strong>? They will no longer be
                    able to accept or conduct interviews.
                  </>
                ) : (
                  <>
                    Do you want to activate <strong>{fullName(statusTarget.iv)}</strong> and restore their access?
                  </>
                )}
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn"
                style={{ background: "#f3f4f6", color: "#374151" }}
                disabled={deactivatingId === statusTarget.iv.user_id}
                onClick={() => setStatusTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={
                  statusTarget.deactivate
                    ? { background: "#dc2626", color: "#ffffff" }
                    : { background: "#ff7a2b", color: "#ffffff" }
                }
                disabled={deactivatingId === statusTarget.iv.user_id}
                onClick={confirmStatusChange}
              >
                {deactivatingId === statusTarget.iv.user_id
                  ? "Saving…"
                  : statusTarget.deactivate
                  ? "Yes, Deactivate"
                  : "Yes, Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DEACTIVATE/ACTIVATE SUCCESS MODAL ══ */}
      {statusSuccessTarget && (
        <div className="modal-overlay" onClick={() => setStatusSuccessTarget(null)}>
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18 }}>
                {statusSuccessTarget.deactivated ? "Interviewer Deactivated" : "Interviewer Activated"}
              </h2>
              <button className="modal-close" onClick={() => setStatusSuccessTarget(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{statusSuccessTarget.deactivated ? "🚫" : "✅"}</div>
              <p style={{ margin: 0, color: "#374151", fontSize: 14 }}>
                <strong>{fullName(statusSuccessTarget.iv)}</strong>{" "}
                {statusSuccessTarget.deactivated
                  ? "has been deactivated and can no longer access interviews."
                  : "has been activated and access has been restored."}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={() => setStatusSuccessTarget(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CONFIRM REVIEW STATUS MODAL ══ */}
      {reviewStatusTarget && (
        <div
          className="modal-overlay"
          onClick={() =>
            reviewStatusUpdatingId !== reviewStatusTarget.iv.user_id && setReviewStatusTarget(null)
          }
        >
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18 }}>
                {reviewStatusTarget.next === "active" ? "Mark Review Active" : "Move to Under Review"}
              </h2>
              <button
                className="modal-close"
                disabled={reviewStatusUpdatingId === reviewStatusTarget.iv.user_id}
                onClick={() => setReviewStatusTarget(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: "#374151", fontSize: 14 }}>
                {reviewStatusTarget.next === "active" ? (
                  <>
                    Do you want to mark <strong>{fullName(reviewStatusTarget.iv)}</strong>'s review status as
                    active?
                  </>
                ) : (
                  <>
                    Do you want to move <strong>{fullName(reviewStatusTarget.iv)}</strong> back to under review?
                  </>
                )}
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn"
                style={{ background: "#f3f4f6", color: "#374151" }}
                disabled={reviewStatusUpdatingId === reviewStatusTarget.iv.user_id}
                onClick={() => setReviewStatusTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={reviewStatusUpdatingId === reviewStatusTarget.iv.user_id}
                onClick={confirmReviewStatusChange}
              >
                {reviewStatusUpdatingId === reviewStatusTarget.iv.user_id
                  ? "Saving…"
                  : reviewStatusTarget.next === "active"
                  ? "Yes, Mark Active"
                  : "Yes, Move to Under Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ REVIEW STATUS SUCCESS MODAL ══ */}
      {reviewStatusSuccessTarget && (
        <div className="modal-overlay" onClick={() => setReviewStatusSuccessTarget(null)}>
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18 }}>Review Status Updated</h2>
              <button className="modal-close" onClick={() => setReviewStatusSuccessTarget(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>
                {reviewStatusSuccessTarget.status === "active" ? "✅" : "🕓"}
              </div>
              <p style={{ margin: 0, color: "#374151", fontSize: 14 }}>
                <strong>{fullName(reviewStatusSuccessTarget.iv)}</strong>'s review status is now{" "}
                <strong>
                  {getReviewStatusLabel(
                    { ...reviewStatusSuccessTarget.iv, review_status: reviewStatusSuccessTarget.status },
                    reviewStatusSuccessTarget.adminReview
                  )}
                </strong>.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={() => setReviewStatusSuccessTarget(null)}>
                Done
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
  //

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