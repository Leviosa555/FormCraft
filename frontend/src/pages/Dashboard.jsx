import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  LogOut,
  ShieldCheck,
  PieChart as PieIcon,
  BarChart2,
  TrendingUp,
  Activity,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import CreateFormDialog from "@/components/forms/CreateFormDialog";
import UserSettingsDialog from "@/components/settings/UserSettingsDialog";
import ShareFormDialog from "@/components/forms/ShareFormDialog";
import { duplicateForm, deleteForm, exportResponses, getFormAnalytics, getForms, setRetentionPolicy } from "@/api/forms";
import { getProfile, logout } from "@/api/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useTranslation } from "@/lib/i18n";





const statusStyles = {
  draft: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-100 text-slate-600",
};

const CHART_COLORS = [
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f97316", // orange
  "#3b82f6", // blue
  "#84cc16", // lime
];

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [forms, setForms] = useState([]);
  const [active, setActive] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [days, setDays] = useState("");

  // Source selection: "status" | "duration" | "timeline" | field_id
  const [selectedSource, setSelectedSource] = useState("status");
  // Visualization mode: "pie" | "bar" | "area" | "radar"
  const [visType, setVisType] = useState("pie");

  const loadProfile = async () => {
    try {
      const res = await getProfile();
      setCurrentUser(res.data);
    } catch {
      // Fallback
    }
  };

  const loadForms = async () => {
    const response = await getForms();
    setForms(response.data);
    setActive((current) => response.data.find((form) => form.id === current?.id) || response.data[0] || null);
  };

  useEffect(() => {
    loadProfile();
    loadForms().catch(() => toast.error("Unable to load your forms."));
  }, []);

  useEffect(() => {
    if (!active) return;
    setDays(active.retention_days ?? "");
    getFormAnalytics(active.id)
      .then((data) => {
        setAnalytics(data);
        // Default to status if available, else duration
        if (data.status_distribution?.some((d) => d.value > 0)) {
          setSelectedSource("status");
          setVisType("pie");
        } else {
          setSelectedSource("duration");
          setVisType("bar");
        }
      })
      .catch(() => setAnalytics(null));
  }, [active]);

  const duplicate = async (event, form) => {
    event.stopPropagation();
    try {
      const copy = await duplicateForm(form.id);
      toast.success("Draft duplicate created.");
      navigate(`/builder/${copy.id}`);
    } catch {
      toast.error("Unable to duplicate form.");
    }
  };

  const saveRetention = async () => {
    try {
      const res = await setRetentionPolicy(active.id, { retention_days: days ? Number(days) : null });
      if (res?.archived_now > 0) {
        toast.success(`Retention policy saved. ${res.archived_now} expired response(s) archived.`);
      } else {
        toast.success("Retention policy saved.");
      }
      await loadForms();
      if (active?.id) {
        getFormAnalytics(active.id).then((data) => setAnalytics(data)).catch(() => {});
      }
    } catch {
      toast.error("Enter a retention period from 1 to 3650 days.");
    }
  };

  const [exporting, setExporting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteActiveForm = async () => {
    if (!active?.id) return;
    try {
      setDeleting(true);
      await deleteForm(active.id);
      toast.success("Form deleted successfully.");
      setDeleteConfirmOpen(false);
      const remainingForms = forms.filter((f) => f.id !== active.id);
      setForms(remainingForms);
      setActive(remainingForms[0] || null);
    } catch (err) {
      console.error("Failed to delete form:", err);
      toast.error("Failed to delete form.");
    } finally {
      setDeleting(false);
    }
  };

  const downloadCSV = async () => {
    if (!active?.id) return;
    try {
      setExporting(true);
      const response = await exportResponses(active.id, "csv");
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeTitle = (active.title || "form").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      link.download = `${safeTitle}-responses.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
      toast.success("CSV exported successfully.");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Unable to export CSV responses.");
    } finally {
      setExporting(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return "0s";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  const selectedFieldDist = analytics?.field_distributions?.find(
    (f) => String(f.field_id) === String(selectedSource)
  );

  // Compute active chart data normalized to { label, value, color }
  const activeChartData = useMemo(() => {
    if (!analytics) return [];

    if (selectedSource === "status") {
      return (analytics.status_distribution || [])
        .filter((d) => d.value > 0 && d.name !== "Archived")
        .map((d, i) => ({
          label: d.name,
          value: d.value,
          color: d.color || CHART_COLORS[i % CHART_COLORS.length],
        }));
    }

    if (selectedSource === "duration") {
      return (analytics.duration_distribution || []).map((d, i) => ({
        label: d.value,
        value: d.count,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
    }

    if (selectedSource === "timeline") {
      return (analytics.timeline_distribution || []).map((d, i) => ({
        label: d.date,
        value: d.submissions,
        color: CHART_COLORS[0],
      }));
    }

    if (selectedFieldDist) {
      return (selectedFieldDist.distribution || []).map((d, i) => ({
        label: String(d.value),
        value: d.count,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
    }

    return [];
  }, [analytics, selectedSource, selectedFieldDist]);

  // Compute dynamic distribution summary items (synchronized with currently selected source/field)
  const currentSummaryItems = useMemo(() => {
    if (!analytics) return [];

    if (selectedSource === "status") {
      return (analytics.status_distribution || [])
        .filter((item) => item.name !== "Archived")
        .map((item) => ({
          name: item.name === "Submitted"
            ? t("dashboard.activeSubmissions", "Submitted")
            : item.name === "In-Progress"
            ? t("dashboard.inProgress", "In-Progress")
            : item.name,
          value: item.value,
          color: item.color || (item.name === "Submitted" ? "#10b981" : "#f59e0b"),
        }));
    }

    if (selectedSource === "duration") {
      return (analytics.duration_distribution || []).map((d, i) => ({
        name: d.value,
        value: d.count,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
    }

    if (selectedSource === "timeline") {
      return (analytics.timeline_distribution || []).map((d, i) => ({
        name: d.date,
        value: d.submissions,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
    }

    if (selectedFieldDist) {
      return (selectedFieldDist.distribution || []).map((d, i) => ({
        name: String(d.value),
        value: d.count,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
    }

    return (activeChartData || []).map((d) => ({
      name: d.label,
      value: d.value,
      color: d.color,
    }));
  }, [analytics, selectedSource, selectedFieldDist, activeChartData, t]);

  const totalValue = useMemo(() => {
    return (activeChartData || []).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  }, [activeChartData]);

  const chartMeta = useMemo(() => {

    if (selectedSource === "status") {
      return {
        title: t("dashboard.responseStatusDist", "Response status distribution"),
        subtitle: t("dashboard.responseStatusDesc", "Breakdown of completed submissions vs in-progress & archived"),
      };
    }
    if (selectedSource === "duration") {
      return {
        title: t("dashboard.responseDurOpt", "Response duration breakdown"),
        subtitle: t("dashboard.avgTime", "Time taken by respondents from opening form to submission"),
      };
    }
    if (selectedSource === "timeline") {
      return {
        title: t("dashboard.timelineOpt", "Submission timeline trends"),
        subtitle: t("dashboard.analyticsSubtitle", "Daily response volume recorded over time"),
      };
    }
    if (selectedFieldDist) {
      return {
        title: selectedFieldDist.label,
        subtitle: `Answer distribution for ${selectedFieldDist.field_type} field`,
      };
    }
    return {
      title: t("dashboard.analytics", "Analytics overview"),
      subtitle: t("dashboard.analyticsSubtitle", "Response breakdown"),
    };
  }, [selectedSource, selectedFieldDist, t]);

  // Handle source change with smart default visualization

  const handleSourceChange = (newSource) => {
    setSelectedSource(newSource);
    if (newSource === "status") {
      setVisType("pie");
    } else if (newSource === "timeline") {
      setVisType("area");
    } else if (newSource === "duration") {
      setVisType("bar");
    } else {
      setVisType("pie");
    }
  };

  return (
    <main className="min-h-screen lg:h-screen lg:overflow-hidden overflow-y-auto bg-slate-50 p-3 sm:p-4 lg:p-5">
      <div className="mx-auto flex h-full max-w-7xl flex-col">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 rounded-2xl border border-slate-200 bg-white p-4 sm:px-5 sm:py-3 shadow-xs">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              {t("dashboard.title", "FormCraft workspace")}
            </p>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
              {t("dashboard.welcome", "Welcome,")}{" "}
              <span className="capitalize">{currentUser?.username || "User"}</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSelector />
            <CreateFormDialog onCreated={loadForms} />
            <UserSettingsDialog user={currentUser} onUpdated={loadProfile} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                logout();
                toast.success("Logged out successfully.");
                navigate("/login");
              }}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              {t("nav.logout", "Log out")}
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)]">
          {/* Left Panel: Forms Workspace List */}
          <Card className="min-h-0 border-slate-200 py-0 shadow-xs max-h-72 lg:max-h-none flex flex-col">
            <CardHeader className="shrink-0 border-b border-slate-100 px-5 py-3">
              <CardTitle className="text-sm">{t("dashboard.workspace", "Forms workspace")}</CardTitle>
              <CardDescription>
                {forms.length} {t("dashboard.forms", "forms")} · {t("dashboard.selectOne", "select one to inspect")}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-full min-h-0 space-y-2 overflow-y-auto px-3 py-3">

              {forms.length ? (
                forms.map((form) => (
                  <button
                    key={form.id}
                    onClick={() => setActive(form)}
                    className={`group w-full rounded-xl border p-3 text-left transition ${active?.id === form.id
                        ? "border-primary/35 bg-primary/5 shadow-2xs"
                        : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                      }`}
                  >
                    <div className="flex gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 leading-snug break-words">
                            {form.title}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize ${statusStyles[form.status]}`}
                          >
                            {form.status === "published"
                              ? t("dashboard.statusPublished", "Published")
                              : form.status === "draft"
                              ? t("dashboard.statusDraft", "Draft")
                              : t("dashboard.statusArchived", "Archived")}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                          {form.description || t("dashboard.noFormsMatch", "No description provided.")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-2">
                      <Button
                        size="xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/builder/${form.id}`);
                        }}
                      >
                        {t("dashboard.editForm", "Open")}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={(event) => duplicate(event, form)}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        {t("dashboard.duplicate", "Duplicate")}
                      </Button>
                    </div>
                  </button>
                ))
              ) : (
                <p className="py-12 text-center text-sm text-slate-500">
                  {t("dashboard.noForms", "Create your first form to begin.")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Right Panel: Analytics & Operations */}
          <section className="min-h-0 overflow-hidden">
            {active ? (
              <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
                {/* Active Form Header */}
                <Card className="shrink-0 border-slate-200 py-0 shadow-xs">
                  <CardHeader className="px-5 py-3 flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-slate-900 break-words">
                        {active.title}
                      </CardTitle>
                      <CardDescription>{t("dashboard.analyticsSubtitle", "Analytics and response operations")}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {active.status === "published" && (
                        <ShareFormDialog form={active} />
                      )}
                      <Button
                        size="xs"
                        onClick={() => navigate(`/builder/${active.id}/responses`)}
                        className="h-7.5 text-xs font-medium"
                      >
                        {t("dashboard.viewResponses", "View responses")}
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => setDeleteConfirmOpen(true)}
                        className="h-7.5 text-xs font-medium gap-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete Form</span>
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                {/* Key Metric Cards */}
                <div className="grid shrink-0 grid-cols-3 gap-3">
                  <Metric
                    label={t("dashboard.activeSubmissions", "Submitted")}
                    value={analytics?.total_submissions ?? 0}
                    detail={
                      analytics?.archived_submissions
                        ? `${analytics.active_submissions ?? (analytics.total_submissions - analytics.archived_submissions)} ${t("dashboard.active", "active")} · ${analytics.archived_submissions} ${t("dashboard.statusArchived", "archived")}`
                        : t("dashboard.completed", "completed")
                    }
                  />
                  <Metric
                    label={t("dashboard.completionRate", "Completion")}
                    value={`${analytics?.completion_rate ?? 0}%`}
                    detail={`${analytics?.started_responses ?? 0} ${t("dashboard.started", "started")}`}
                  />
                  <Metric
                    label={t("dashboard.avgTime", "Avg. time")}
                    value={formatDuration(analytics?.average_completion_seconds)}
                    detail={t("dashboard.openToSubmit", "open to submit")}
                  />
                </div>

                {/* Main Visualization & Side Controls */}
                <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_270px]">
                  {/* Interactive Multi-Chart Card */}
                  <Card className="min-h-0 border-slate-200 py-0 shadow-xs flex flex-col">
                    <CardHeader className="shrink-0 flex-col sm:flex-row sm:items-center justify-between px-5 py-3 gap-2 border-b border-slate-100">
                      <div>
                        <CardTitle className="text-sm font-semibold text-slate-900">
                          {chartMeta.title}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {chartMeta.subtitle}
                        </CardDescription>
                      </div>

                      {/* Source & Visualization Controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Data Source Selector */}
                        <select
                          className="h-7.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 outline-none focus:border-primary focus:bg-white transition-colors"
                          value={selectedSource}
                          onChange={(e) => handleSourceChange(e.target.value)}
                        >
                          <option value="status">🍩 {t("dashboard.responseDistOpt", "Response distribution")}</option>
                          <option value="duration">⏱️ {t("dashboard.responseDurOpt", "Response duration")}</option>
                          {analytics?.timeline_distribution?.length > 0 && (
                            <option value="timeline">📈 {t("dashboard.timelineOpt", "Submissions timeline")}</option>
                          )}
                          {analytics?.field_distributions?.map((f) => (
                            <option key={f.field_id} value={f.field_id}>
                              📊 {f.label} ({f.field_type})
                            </option>
                          ))}
                        </select>

                        {/* Chart Type Icon Toggles */}

                        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
                          <button
                            type="button"
                            title="Pie / Donut Chart"
                            onClick={() => setVisType("pie")}
                            className={`flex h-6.5 w-6.5 items-center justify-center rounded-md text-xs transition-all ${visType === "pie"
                                ? "bg-white text-primary shadow-xs font-semibold"
                                : "text-slate-500 hover:text-slate-800"
                              }`}
                          >
                            <PieIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Bar Chart"
                            onClick={() => setVisType("bar")}
                            className={`flex h-6.5 w-6.5 items-center justify-center rounded-md text-xs transition-all ${visType === "bar"
                                ? "bg-white text-primary shadow-xs font-semibold"
                                : "text-slate-500 hover:text-slate-800"
                              }`}
                          >
                            <BarChart2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Area Trend Chart"
                            onClick={() => setVisType("area")}
                            className={`flex h-6.5 w-6.5 items-center justify-center rounded-md text-xs transition-all ${visType === "area"
                                ? "bg-white text-primary shadow-xs font-semibold"
                                : "text-slate-500 hover:text-slate-800"
                              }`}
                          >
                            <TrendingUp className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Chart Canvas */}
                    <CardContent className="min-h-[250px] sm:min-h-[280px] lg:h-[calc(100%-65px)] px-4 py-3 flex flex-col justify-center">

                      {activeChartData?.some((d) => d.value > 0) ? (
                        <div className="h-full w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            {/* PIE / DONUT CHART */}
                            {visType === "pie" && (
                              <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                <Tooltip
                                  contentStyle={{
                                    borderRadius: 12,
                                    border: "1px solid #e2e8f0",
                                    boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.1)",
                                    fontSize: "12px",
                                  }}
                                  formatter={(value, name) => {
                                    const pct = totalValue ? Math.round((value / totalValue) * 100) : 0;
                                    return [`${value} (${pct}%)`, name];
                                  }}
                                />
                                <Legend
                                  verticalAlign="bottom"
                                  height={32}
                                  iconType="circle"
                                  iconSize={8}
                                  formatter={(value) => (
                                    <span className="text-[11.5px] font-medium text-slate-700">
                                      {value}
                                    </span>
                                  )}
                                />
                                <Pie
                                  data={activeChartData}
                                  dataKey="value"
                                  nameKey="label"
                                  cx="50%"
                                  cy="48%"
                                  innerRadius={55}
                                  outerRadius={88}
                                  paddingAngle={3}
                                  stroke="#ffffff"
                                  strokeWidth={2}
                                >
                                  {activeChartData.map((entry, index) => (
                                    <Cell
                                      key={`cell-${entry.label}-${index}`}
                                      fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
                                    />
                                  ))}
                                </Pie>
                              </PieChart>
                            )}

                            {/* BAR CHART */}
                            {visType === "bar" && (
                              <BarChart
                                data={activeChartData}
                                margin={{ top: 16, right: 12, left: -18, bottom: 0 }}
                              >
                                <defs>
                                  <linearGradient id="emeraldBarGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" />
                                    <stop offset="100%" stopColor="#059669" />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="label"
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 11, fill: "#64748b" }}
                                  dy={6}
                                />
                                <YAxis
                                  allowDecimals={false}
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 11, fill: "#64748b" }}
                                />
                                <Tooltip
                                  cursor={{ fill: "#f0fdf4", radius: 8 }}
                                  contentStyle={{
                                    borderRadius: 12,
                                    border: "1px solid #d1fae5",
                                    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                                    fontSize: "12px",
                                  }}
                                  labelStyle={{ color: "#0f172a", fontWeight: 600 }}
                                  itemStyle={{ color: "#059669" }}
                                  formatter={(value) => [
                                    `${value} response${value === 1 ? "" : "s"}`,
                                    "Count",
                                  ]}
                                />
                                <Bar dataKey="value" radius={[8, 8, 2, 2]} maxBarSize={48}>
                                  {activeChartData.map((entry, index) => (
                                    <Cell
                                      key={`bar-cell-${entry.label}-${index}`}
                                      fill={entry.color || "url(#emeraldBarGradient)"}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            )}

                            {/* AREA CHART */}
                            {visType === "area" && (
                              <AreaChart
                                data={activeChartData}
                                margin={{ top: 16, right: 12, left: -18, bottom: 0 }}
                              >
                                <defs>
                                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="label"
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 11, fill: "#64748b" }}
                                  dy={6}
                                />
                                <YAxis
                                  allowDecimals={false}
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 11, fill: "#64748b" }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    borderRadius: 12,
                                    border: "1px solid #d1fae5",
                                    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                                    fontSize: "12px",
                                  }}
                                  formatter={(value) => [`${value} responses`, "Volume"]}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="value"
                                  stroke="#10b981"
                                  strokeWidth={2.5}
                                  fillOpacity={1}
                                  fill="url(#areaGradient)"
                                />
                              </AreaChart>
                            )}

                            {/* RADAR CHART */}
                            {visType === "radar" && (
                              <RadarChart cx="50%" cy="50%" outerRadius={78} data={activeChartData}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis
                                  dataKey="label"
                                  tick={{ fill: "#475569", fontSize: 11 }}
                                />
                                <PolarRadiusAxis allowDecimals={false} stroke="#cbd5e1" />
                                <Radar
                                  name="Responses"
                                  dataKey="value"
                                  stroke="#10b981"
                                  fill="#10b981"
                                  fillOpacity={0.45}
                                />
                                <Tooltip
                                  contentStyle={{
                                    borderRadius: 12,
                                    border: "1px solid #d1fae5",
                                    fontSize: "12px",
                                  }}
                                />
                              </RadarChart>
                             )}
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
                          {t("dashboard.noSubmissions", "No responses recorded yet for this view.")}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Side Column: Operations & Fast Stats */}
                  <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto pr-1">
                    {/* Quick Response Distribution Mini-Pill Card (Dynamic) */}
                    <Card className="shrink-0 border-slate-200 py-0 shadow-xs">
                      <CardHeader className="px-3.5 py-2.5 pb-1.5">
                        <CardTitle className="flex items-center justify-between text-xs font-semibold text-slate-800">
                          <span className="flex items-center gap-1.5">
                            <PieIcon className="h-3.5 w-3.5 text-primary" />
                            {t("dashboard.distSummary", "Distribution summary")}
                          </span>
                          {totalValue > 0 && (
                            <span className="text-[10.5px] font-normal text-slate-400">
                              Total: {totalValue}
                            </span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 px-3.5 pb-2.5 pt-0">
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                          {currentSummaryItems && currentSummaryItems.length > 0 ? (
                            currentSummaryItems.map((item, idx) => {
                              const percentage = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                                    <span
                                      className="h-2 w-2 rounded-full shrink-0"
                                      style={{ backgroundColor: item.color }}
                                    />
                                    <span className="text-slate-700 font-medium truncate text-xs" title={item.name}>
                                      {item.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-semibold text-slate-900">{item.value}</span>
                                    {totalValue > 0 && (
                                      <span className="text-[10px] text-slate-400 font-normal">
                                        ({percentage}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-400 italic py-2 text-center">
                              No distribution data recorded.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Data Retention */}
                    <Card className="shrink-0 border-slate-200 py-0 shadow-xs">
                      <CardHeader className="px-3.5 py-2.5 pb-1.5">
                        <CardTitle className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          {t("dashboard.dataRetention", "Data retention")}
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                          {t("dashboard.autoArchivePolicy", "Auto-archive policy")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 px-3.5 pb-2.5 pt-0">
                        <div className="flex items-center gap-2">
                          <input
                            className="h-7.5 w-20 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-primary"
                            type="number"
                            min="1"
                            max="3650"
                            placeholder={t("dashboard.daysPlaceholder", "Days")}
                            value={days}
                            onChange={(event) => setDays(event.target.value)}
                          />
                          <span className="text-xs text-slate-500">{t("dashboard.days", "days")}</span>
                          <Button size="xs" className="ml-auto h-7.5 px-3 text-xs" onClick={saveRetention}>
                            {t("builder.save", "Save")}
                          </Button>
                        </div>
                        <p className="text-[10.5px] leading-3.5 text-slate-500">
                          {t("dashboard.retentionNote", "Archived responses stay accessible in the browser.")}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Export CSV */}
                    <Card className="shrink-0 border-slate-200 py-0 shadow-xs">
                      <CardHeader className="px-3.5 py-2.5 pb-1.5">
                        <CardTitle className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                          <Download className="h-3.5 w-3.5 text-primary" />
                          {t("dashboard.exportResponses", "Export responses")}
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                          {t("dashboard.downloadResponses", "Download responses")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 px-3.5 pb-3 pt-0">
                        <Button
                          size="xs"
                          variant="outline"
                          className="w-full h-8 justify-center gap-1.5 border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-none"
                          onClick={downloadCSV}
                          disabled={exporting}
                        >
                          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                          {exporting ? "Exporting CSV..." : t("dashboard.exportCSV", "Export as CSV")}
                        </Button>
                        <p className="text-[10.5px] leading-3.5 text-slate-500">
                          {t("dashboard.exportCSVNote", "Includes questions, timestamps, and answers ready for Excel.")}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ) : (
              <Card className="grid h-full place-items-center border-dashed py-0">
                <div className="text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 font-medium text-slate-700">{t("dashboard.selectFormPrompt", "Select a form")}</p>
                  <p className="mt-1 text-sm text-slate-500">{t("dashboard.analyticsAppearHere", "Analytics will appear here.")}</p>
                </div>
              </Card>
            )}
          </section>
        </div>
      </div>

      {/* Delete Form Confirmation Dialog */}
      {deleteConfirmOpen && (
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm p-5">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-600" />
                Delete Form
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 pt-1">
                Are you sure you want to delete <strong className="text-slate-800">&quot;{active?.title}&quot;</strong>? All associated questions, configurations, and collected submissions will be permanently removed.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs border-slate-200"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDeleteActiveForm}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Form"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}


function Metric({ label, value, detail }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-400">{detail}</p>
    </div>
  );
}
