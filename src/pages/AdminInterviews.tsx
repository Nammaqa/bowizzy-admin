import { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { getPriorityInterviews, getAllInterviews } from "../services/admin";
import AdminLayout from "../components/AdminLayout";
import "./AdminInterviews.redesign.css";

type CandidateReview = {
  communication_skills?: string;
  technical_knowledge?: string;
  problem_solving_analytical_skills?: string;
  relevant_experience_skills?: string;
  adaptability_learning_ability?: string;
  cultural_team_fit?: string;
  overall_impression?: string;
  final_comments?: string;
  final_recommendation?: string;
  communication_skills_rating?: string;
  technical_knowledge_rating?: string;
  problem_solving_analytical_skills_rating?: string;
  relevant_experience_skills_rating?: string;
  adaptability_learning_ability_rating?: string;
  cultural_team_fit_rating?: string;
  overall_impression_rating?: string;
  created_at?: string;
};

type InterviewerReview = {
  professionalism_conduct?: string;
  clarity_of_questions?: string;
  knowledge_of_role?: string;
  engagement_during_interview?: string;
  timeliness_organization?: string;
  overall_experience?: string;
  final_comments?: string;
  professionalism_conduct_rating?: string;
  clarity_of_questions_rating?: string;
  knowledge_of_role_rating?: string;
  engagement_during_interview_rating?: string;
  timeliness_organization_rating?: string;
  overall_experience_rating?: string;
  created_at?: string;
};

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
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_signature?: string | null;
  created_at?: string;
  updated_at?: string;
  skills: string | null;
  job_role: string | null;
  candidate_feedback_given?: boolean;
  interviewer_feedback_given?: boolean;
  priority_status: string;
  cancelled_by: string | null;
  purchased_credits_used?: number;
  candidate_review?: CandidateReview | null;
  interviewer_review?: InterviewerReview | null;
};

const CANDIDATE_REVIEW_FIELDS: { key: keyof CandidateReview; label: string }[] = [
  { key: "communication_skills", label: "Communication Skills" },
  { key: "technical_knowledge", label: "Technical Knowledge" },
  { key: "problem_solving_analytical_skills", label: "Problem Solving & Analytical Skills" },
  { key: "relevant_experience_skills", label: "Relevant Experience/Skills" },
  { key: "adaptability_learning_ability", label: "Adaptability & Learning Ability" },
  { key: "cultural_team_fit", label: "Cultural & Team Fit" },
  { key: "overall_impression", label: "Overall Impression" },
];

const INTERVIEWER_REVIEW_FIELDS: { key: keyof InterviewerReview; label: string }[] = [
  { key: "professionalism_conduct", label: "Professionalism & Conduct" },
  { key: "clarity_of_questions", label: "Clarity of Questions" },
  { key: "knowledge_of_role", label: "Knowledge of Role" },
  { key: "engagement_during_interview", label: "Engagement During Interview" },
  { key: "timeliness_organization", label: "Timeliness & Organization" },
  { key: "overall_experience", label: "Overall Experience" },
];

// ── Pure formatting helpers (no component state) ────────────────────────────
const isExpired = (endTimeUtc?: string): boolean => {
  if (!endTimeUtc) return false;
  return new Date(endTimeUtc) < new Date();
};

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

const formatDateTimeFull = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatExperience = (months?: number | null) => {
  if (!months) return "Fresher";
  if (months < 12) return `${months} mo`;
  const years = months / 12;
  return `${years % 1 === 0 ? years : years.toFixed(1)} yr`;
};

const formatWords = (value?: string | null) => {
  if (!value) return "-";
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const isCancelledInterview = (item: MockInterview): boolean => {
  const status = (item.interview_status ?? "").toLowerCase();
  const cancelledBy = (item.cancelled_by ?? "").toLowerCase();
  return status.includes("cancel") || cancelledBy.includes("candidate") || cancelledBy.includes("interviewer");
};

const getCancelledDisplayText = (item: MockInterview): string => {
  const cancelledBy = (item.cancelled_by ?? "").toLowerCase();
  if (cancelledBy.includes("candidate")) return "Cancelled by Candidate";
  if (cancelledBy.includes("interviewer")) return "Cancelled by Interviewer";

  const rawStatus = (item.interview_status ?? "").replace(/_/g, " ");
  if (!rawStatus) return "Cancelled";
  return rawStatus
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const renderStatusBadge = (item: MockInterview) => {
  if (isCancelledInterview(item)) {
    return <span className="status-badge status-cancelled">{getCancelledDisplayText(item)}</span>;
  }

  if (item.interviewer_id === null) {
    return <span className="status-badge status-pending">Pending</span>;
  }

  const expired = isExpired(item.end_time_utc);
  const s = item.interview_status.toLowerCase();

  if (expired) {
    return <span className="status-badge status-expired">Completed</span>;
  }
  if (s.includes("scheduled") || s.includes("confirmed") || s.includes("active")) {
    return <span className="status-badge status-active">{item.interview_status.replace(/_/g, " ")}</span>;
  }
  if (s.includes("pending")) {
    return <span className="status-badge status-pending">{item.interview_status.replace(/_/g, " ")}</span>;
  }
  return <span className="status-badge status-default">{item.interview_status.replace(/_/g, " ")}</span>;
};

const columnHelper = createColumnHelper<MockInterview>();

export default function AdminInterviews() {
  const [activeTab, setActiveTab] = useState<"priority" | "all">("priority");
  const [priorityInterviews, setPriorityInterviews] = useState<MockInterview[]>([]);
  const [allInterviews, setAllInterviews] = useState<MockInterview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsItem, setDetailsItem] = useState<MockInterview | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "mock_interview_id", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statFilter, setStatFilter] = useState<"total" | "active" | "completed" | "priority">("total");

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

  useEffect(() => {
    setStatFilter("total");
  }, [activeTab]);

  const activeData = activeTab === "priority" ? priorityInterviews : allInterviews;

  // ── Stats derived from current tab data ────────────────────────────────────
  const stats = {
    total: activeData.length,
    active: activeData.filter((i) => !isExpired(i.end_time_utc) && !isCancelledInterview(i)).length,
    completed: activeData.filter((i) => isExpired(i.end_time_utc)).length,
    priority: activeData.filter((i) => i.priority_status === "priority").length,
  };

  // ── Data narrowed by the selected stat chip ─────────────────────────────────
  const statFilteredData = useMemo(() => {
    switch (statFilter) {
      case "active":
        return activeData.filter((i) => !isExpired(i.end_time_utc) && !isCancelledInterview(i));
      case "completed":
        return activeData.filter((i) => isExpired(i.end_time_utc));
      case "priority":
        return activeData.filter((i) => i.priority_status === "priority");
      default:
        return activeData;
    }
  }, [activeData, statFilter]);

  const toggleStatFilter = (key: "active" | "completed" | "priority") => {
    setStatFilter((prev) => (prev === key ? "total" : key));
  };

  // ── Table columns ────────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      columnHelper.accessor("mock_interview_id", {
        header: "ID",
        cell: (info) => `#${info.getValue()}`,
        meta: { className: "sn-cell" },
      }),
      columnHelper.accessor("job_role", {
        header: "Role",
        cell: (info) => (
          <span className="role-title" title={info.getValue() || ""}>
            {info.getValue() || "N/A"}
          </span>
        ),
        meta: { className: "role-cell" },
      }),
      columnHelper.accessor("skills", {
        header: "Skills",
        enableSorting: false,
        cell: (info) => {
          const skills = info.getValue() ? (info.getValue() as string).split(", ") : [];
          const visible = skills.slice(0, 3);
          const extra = skills.length - 3;
          return (
            <div className="skills-row">
              {visible.map((sk) => (
                <span key={sk} className="skill-badge">
                  {sk}
                </span>
              ))}
              {extra > 0 && <span className="skill-badge skill-badge--more">+{extra}</span>}
            </div>
          );
        },
        meta: { className: "skills-cell" },
      }),
      columnHelper.accessor("experience_months", {
        header: "Experience",
        cell: (info) => formatExperience(info.getValue()),
        meta: { className: "exp-cell" },
      }),
      columnHelper.accessor("start_time_utc", {
        header: "Date & time",
        cell: (info) => {
          const item = info.row.original;
          return (
            <>
              <div className="date-primary">{formatDateShort(item.start_time_utc)}</div>
              <div className="date-secondary">
                {formatTime(item.start_time_utc)} – {formatTime(item.end_time_utc)}
              </div>
            </>
          );
        },
        meta: { className: "date-cell" },
      }),
      columnHelper.accessor("interview_type", {
        header: "Type",
        cell: (info) => info.getValue(),
        meta: { className: "capitalize type-cell" },
      }),
      columnHelper.accessor("interview_status", {
        header: "Status",
        cell: (info) => renderStatusBadge(info.row.original),
      }),
      columnHelper.accessor("priority_status", {
        header: "Priority",
        cell: (info) => (
          <span
            className={`priority-badge ${
              info.getValue() === "priority" ? "priority-badge--urgent" : "priority-badge--normal"
            }`}
          >
            <span className="priority-dot" />
            {info.getValue() === "priority" ? "Priority" : "Normal"}
          </span>
        ),
        meta: { className: "priority-cell" },
      }),
      columnHelper.accessor((row) => parseFloat(row.amount || "0"), {
        id: "amount",
        header: "Amount",
        cell: (info) => <span className="payment-amount">₹{info.row.original.amount}</span>,
        meta: { className: "amount-cell" },
      }),
      columnHelper.accessor("payment_status", {
        header: "Payment Status",
        cell: (info) => (
          <span
            className={`payment-badge ${
              (info.getValue() || "").toLowerCase() === "confirmed" ? "payment-badge--paid" : "payment-badge--other"
            }`}
          >
            {formatWords(info.getValue())}
          </span>
        ),
        meta: { className: "payment-cell" },
      }),
      columnHelper.display({
        id: "feedbacks",
        header: "Feedbacks",
        cell: (info) => {
          const item = info.row.original;
          return (
            <div className="feedback-status-cell">
              <span
                className={`feedback-status-pill ${
                  item.candidate_feedback_given ? "feedback-status-pill--given" : "feedback-status-pill--pending"
                }`}
              >
                Candidate: {item.candidate_feedback_given ? "Given" : "Pending"}
              </span>
              <span
                className={`feedback-status-pill ${
                  item.interviewer_feedback_given ? "feedback-status-pill--given" : "feedback-status-pill--pending"
                }`}
              >
                Interviewer: {item.interviewer_feedback_given ? "Given" : "Pending"}
              </span>
            </div>
          );
        },
        meta: { className: "feedback-status-col" },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const item = info.row.original;
          return (
            <div className="actions-cell">
              {item.resume_url && (
                <button
                  className="icon-btn"
                  title="View resume"
                  onClick={() => window.open(item.resume_url as string, "_blank")}
                >
                  <FileText size={15} />
                </button>
              )}
              <button className="icon-btn icon-btn--primary" title="View details" onClick={() => setDetailsItem(item)}>
                <Eye size={15} />
                <span>Details</span>
              </button>
            </div>
          );
        },
        meta: { className: "actions-col" },
      }),
    ],
    []
  );

  // ── Global search across id, role, skills, candidate/interviewer id ────────
  const globalFilterFn = (row: { original: MockInterview }, _columnId: string, filterValue: string) => {
    const item = row.original;
    const q = filterValue.toLowerCase().trim();
    if (!q) return true;
    return (
      String(item.mock_interview_id).includes(q) ||
      String(item.candidate_id).includes(q) ||
      String(item.interviewer_id ?? "").includes(q) ||
      (item.job_role || "").toLowerCase().includes(q) ||
      (item.skills || "").toLowerCase().includes(q) ||
      (item.interview_status || "").toLowerCase().includes(q)
    );
  };

  const table = useReactTable({
    data: statFilteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, globalFilter, statFilter]);

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
            {priorityInterviews.length > 0 && <span className="tab-count">{priorityInterviews.length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>
            All interviews
            {allInterviews.length > 0 && <span className="tab-count">{allInterviews.length}</span>}
          </button>
        </div>

        {/* ── Stats bar ── */}
        {!loading && !error && activeData.length > 0 && (
          <div className="stats-bar">
            <button
              className={`stat-chip ${statFilter === "total" ? "stat-chip--selected" : ""}`}
              onClick={() => setStatFilter("total")}
            >
              <span className="stat-label">Total</span>
              <span className="stat-value">{stats.total}</span>
            </button>
            <button
              className={`stat-chip stat-chip--green ${statFilter === "active" ? "stat-chip--selected" : ""}`}
              onClick={() => toggleStatFilter("active")}
            >
              <span className="stat-label">Active</span>
              <span className="stat-value">{stats.active}</span>
            </button>
            <button
              className={`stat-chip stat-chip--gray ${statFilter === "completed" ? "stat-chip--selected" : ""}`}
              onClick={() => toggleStatFilter("completed")}
            >
              <span className="stat-label">Completed</span>
              <span className="stat-value">{stats.completed}</span>
            </button>
            <button
              className={`stat-chip stat-chip--red ${statFilter === "priority" ? "stat-chip--selected" : ""}`}
              onClick={() => toggleStatFilter("priority")}
            >
              <span className="stat-label">Priority</span>
              <span className="stat-value">{stats.priority}</span>
            </button>
          </div>
        )}

        {/* ── Table card ── */}
        <div className="list-card slots-card">
          <div className="card-header">
            <h4>{activeTab === "priority" ? "Priority interviews" : "All interviews"}</h4>
            {!loading && !error && <span className="count-pill">{table.getFilteredRowModel().rows.length} total</span>}
          </div>

          {!loading && !error && activeData.length > 0 && (
            <div className="table-toolbar">
              <div className="search-box">
                <Search size={15} className="search-box-icon" />
                <input
                  type="text"
                  placeholder="Search by ID, role, skills, status…"
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                />
                {globalFilter && (
                  <button className="search-box-clear" onClick={() => setGlobalFilter("")}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="state-message">
              <span className="spinner" />
              Loading interviews…
            </div>
          ) : error ? (
            <div className="error-text">{error}</div>
          ) : activeData.length === 0 ? (
            <div className="state-message">No interviews found.</div>
          ) : table.getRowModel().rows.length === 0 ? (
            <div className="state-message">
              {globalFilter
                ? `No interviews match "${globalFilter}".`
                : `No ${statFilter} interviews found.`}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          const sortable = header.column.getCanSort();
                          const sorted = header.column.getIsSorted();
                          return (
                            <th
                              key={header.id}
                              className={sortable ? "sortable-th" : ""}
                              onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                            >
                              <span className="th-content">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {sortable &&
                                  (sorted === "asc" ? (
                                    <ArrowUp size={12} />
                                  ) : sorted === "desc" ? (
                                    <ArrowDown size={12} />
                                  ) : (
                                    <ArrowUpDown size={12} className="sort-icon--idle" />
                                  ))}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => {
                      const item = row.original;
                      const expired = isExpired(item.end_time_utc);
                      return (
                        <tr key={row.id} className={`slot-row ${expired ? "row-expired" : ""}`}>
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className={(cell.column.columnDef.meta as { className?: string } | undefined)?.className}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              <div className="table-pagination">
                <div className="page-size-select">
                  <label>Rows per page</label>
                  <select
                    value={table.getState().pagination.pageSize}
                    onChange={(e) => table.setPageSize(Number(e.target.value))}
                  >
                    {[10, 25, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pagination-nav">
                  <span className="page-indicator">
                    Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button className="pagination-btn" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ══ INTERVIEW DETAILS MODAL ══ */}
      {detailsItem && (
        <div className="modal-overlay" onClick={() => setDetailsItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {detailsItem.job_role || "Interview"}
                <span className="modal-header-sub"> · #{detailsItem.mock_interview_id}</span>
              </h2>
              <button className="modal-close" onClick={() => setDetailsItem(null)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="badge-row">
                {renderStatusBadge(detailsItem)}
                <span
                  className={`priority-badge ${
                    detailsItem.priority_status === "priority" ? "priority-badge--urgent" : "priority-badge--normal"
                  }`}
                >
                  <span className="priority-dot" />
                  {detailsItem.priority_status === "priority" ? "Priority" : "Normal"}
                </span>
              </div>

              {/* Interview Info */}
              <div className="iv-section">
                <h3>Interview Info</h3>
                <div className="iv-detail-grid">
                  <div className="iv-detail-item">
                    <label>Candidate ID</label>
                    <span>{detailsItem.candidate_id}</span>
                  </div>
                  <div className="iv-detail-item">
                    <label>Interviewer ID</label>
                    <span>{detailsItem.interviewer_id ?? "Not assigned"}</span>
                  </div>
                  <div className="iv-detail-item">
                    <label>Interview Type</label>
                    <span className="capitalize">{detailsItem.interview_type}</span>
                  </div>
                  <div className="iv-detail-item">
                    <label>Experience</label>
                    <span>{formatExperience(detailsItem.experience_months)}</span>
                  </div>
                  {detailsItem.cancelled_by && (
                    <div className="iv-detail-item">
                      <label>Cancelled By</label>
                      <span>{formatWords(detailsItem.cancelled_by)}</span>
                    </div>
                  )}
                </div>
                {detailsItem.skills && (
                  <div className="iv-skills-full">
                    {detailsItem.skills.split(", ").map((sk) => (
                      <span key={sk} className="skill-badge">
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div className="iv-section">
                <h3>Schedule</h3>
                <div className="iv-detail-grid">
                  <div className="iv-detail-item">
                    <label>Start Time</label>
                    <span>{formatDateTimeFull(detailsItem.start_time_utc)}</span>
                  </div>
                  <div className="iv-detail-item">
                    <label>End Time</label>
                    <span>{formatDateTimeFull(detailsItem.end_time_utc)}</span>
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="iv-section">
                <h3>Payment</h3>
                <div className="iv-detail-grid">
                  <div className="iv-detail-item">
                    <label>Payment Status</label>
                    <span>{formatWords(detailsItem.payment_status)}</span>
                  </div>
                  <div className="iv-detail-item">
                    <label>Amount</label>
                    <span>₹{detailsItem.amount}</span>
                  </div>
                  <div className="iv-detail-item">
                    <label>Purchased Credits Used</label>
                    <span>{detailsItem.purchased_credits_used ?? 0}</span>
                  </div>
                  {detailsItem.razorpay_order_id && (
                    <div className="iv-detail-item">
                      <label>Razorpay Order ID</label>
                      <span className="mono">{detailsItem.razorpay_order_id}</span>
                    </div>
                  )}
                  {detailsItem.razorpay_payment_id && (
                    <div className="iv-detail-item">
                      <label>Razorpay Payment ID</label>
                      <span className="mono">{detailsItem.razorpay_payment_id}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Links */}
              <div className="iv-section">
                <h3>Links</h3>
                <div className="iv-links-row">
                  {detailsItem.resume_url ? (
                    <button
                      className="link-action link-action--resume"
                      onClick={() => window.open(detailsItem.resume_url as string, "_blank")}
                    >
                      View Resume
                    </button>
                  ) : (
                    <span className="no-link">No resume</span>
                  )}
                  {detailsItem.meeting_link ? (
                    <a
                      href={detailsItem.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-action link-action--join"
                    >
                      Join Meeting
                    </a>
                  ) : (
                    <span className="no-link">No meeting link</span>
                  )}
                </div>
              </div>

              {/* Feedback */}
              <div className="iv-section">
                <h3>Candidate Feedback</h3>
                <CandidateReviewBody review={detailsItem.candidate_review} />
              </div>

              <div className="iv-section">
                <h3>Interviewer Feedback</h3>
                <InterviewerReviewBody review={detailsItem.interviewer_review} />
              </div>

              <div className="iv-timestamps">
                <span>Created: {formatDateTimeFull(detailsItem.created_at)}</span>
                <span>Updated: {formatDateTimeFull(detailsItem.updated_at)}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDetailsItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function RatingPill({ rating }: { rating?: string }) {
  if (!rating) return null;
  const n = Number(rating);
  return (
    <span className="rating-pill">
      {"★".repeat(Math.max(0, Math.min(5, n)))}
      {"☆".repeat(Math.max(0, 5 - n))}
      <span className="rating-pill-num">{rating}/5</span>
    </span>
  );
}

function CandidateReviewBody({ review }: { review?: CandidateReview | null }) {
  if (!review) return <div className="feedback-empty">No candidate feedback submitted yet.</div>;
  return (
    <>
      <div className="review-grid">
        {CANDIDATE_REVIEW_FIELDS.map(({ key, label }) => {
          const value = review[key];
          const rating = review[`${key}_rating` as keyof CandidateReview];
          if (!value) return null;
          return (
            <div className="review-item" key={key}>
              <div className="review-item-header">
                <label>{label}</label>
                <RatingPill rating={rating} />
              </div>
              <p>{value}</p>
            </div>
          );
        })}
      </div>

      {review.final_recommendation && (
        <div className="review-recommendation">
          <label>Final Recommendation</label>
          <span className="recommendation-badge">{formatWords(review.final_recommendation)}</span>
        </div>
      )}

      {review.final_comments && (
        <div className="review-comments">
          <label>Final Comments</label>
          <p>{review.final_comments}</p>
        </div>
      )}
    </>
  );
}

function InterviewerReviewBody({ review }: { review?: InterviewerReview | null }) {
  if (!review) return <div className="feedback-empty">No interviewer feedback submitted yet.</div>;
  return (
    <>
      <div className="review-grid">
        {INTERVIEWER_REVIEW_FIELDS.map(({ key, label }) => {
          const value = review[key];
          const rating = review[`${key}_rating` as keyof InterviewerReview];
          if (!value) return null;
          return (
            <div className="review-item" key={key}>
              <div className="review-item-header">
                <label>{label}</label>
                <RatingPill rating={rating} />
              </div>
              <p>{value}</p>
            </div>
          );
        })}
      </div>

      {review.final_comments && (
        <div className="review-comments">
          <label>Final Comments</label>
          <p>{review.final_comments}</p>
        </div>
      )}
    </>
  );
}
