import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  exportResponses,
  getFormResponses,
  getForm,
} from "@/api/forms";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  Mail,
  Calendar,
  CheckCircle2,
  Inbox,
  FileText,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";

export default function FormResponses() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const downloadExport = async (format) => {
    try {
      const response = await exportResponses(id, format);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      const safeTitle = (form?.title || `form-${id}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      link.href = url;
      link.download = `${safeTitle}-responses.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported responses as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Export failed", error);
      toast.error(`Failed to export responses as ${format.toUpperCase()}`);
    }
  };

  const renderResponseValue = (response) => {
    if (response.download_url) {
      const fileName = response.value?.name || "Download file attachment";
      return (
        <a
          href={response.download_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-emerald-600 font-medium hover:underline text-xs"
        >
          📎 {fileName}
        </a>
      );
    }

    if (Array.isArray(response.value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {response.value.map((v, i) => (
            <span
              key={i}
              className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium"
            >
              {String(v)}
            </span>
          ))}
        </div>
      );
    }

    if (response.value && typeof response.value === "object") {
      return (
        <span className="font-mono text-xs text-slate-600">
          {JSON.stringify(response.value)}
        </span>
      );
    }

    return (
      <span className="text-slate-800 text-xs font-medium">
        {String(response.value ?? "N/A")}
      </span>
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [formData, responsesData] = await Promise.all([
          getForm(id).then((r) => r.data).catch(() => null),
          getFormResponses(id),
        ]);
        setForm(formData);
        // Only actual submitted/archived responses are returned by backend
        setResponses(responsesData.results || []);
        setTotalCount(responsesData.count || 0);
      } catch (error) {
        console.error("Failed to load responses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="text-sm text-slate-500 font-medium">Loading submitted responses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        {/* Top Header Card */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <Link
                to={`/builder/${id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Builder</span>
              </Link>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {form?.title || "Form"} Responses
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing <span className="font-semibold text-slate-800">{responses.length}</span> submitted response(s)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadExport("csv")}
              className="h-9 gap-1.5 text-xs font-medium border-slate-200 hover:bg-slate-50 shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadExport("json")}
              className="h-9 gap-1.5 text-xs font-medium border-slate-200 hover:bg-slate-50 shadow-2xs"
            >
              <FileCode className="h-3.5 w-3.5 text-blue-600" />
              <span>Export JSON</span>
            </Button>
          </div>
        </div>

        {/* Responses Container: Mobile Card Layout (block md:hidden) + Desktop Table (hidden md:block) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {responses.length === 0 ? (
            <div className="py-16 sm:py-20 text-center px-4">
              <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3 border border-slate-200">
                <Inbox className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">No Submitted Responses Yet</h3>
              <p className="mt-1 max-w-sm mx-auto text-xs text-slate-500 leading-relaxed">
                Once respondents complete and submit your form, their verified answers will appear here in real-time.
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE LAYOUT (< 768px): Sleek, compact card stack */}
              <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
                {responses.map((sub) => {
                  const submittedDate = sub.submitted_at || sub.created_at;
                  const dateStr = submittedDate
                    ? new Date(submittedDate).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";

                  return (
                    <div
                      key={sub.id}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 space-y-3 shadow-2xs"
                    >
                      {/* Top Bar: #ID + Status + Date */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                            #{sub.id}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              sub.status === "submitted"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                sub.status === "submitted" ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {sub.status === "submitted" ? "Submitted" : "Archived"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{dateStr}</span>
                        </div>
                      </div>

                      {/* Respondent Email */}
                      <div>
                        {sub.respondent_email ? (
                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/70 max-w-full truncate">
                            <Mail className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{sub.respondent_email}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Anonymous Respondent</span>
                        )}
                      </div>

                      {/* Collected Answers */}
                      {sub.responses && sub.responses.length > 0 ? (
                        <div className="space-y-2 pt-1 border-t border-slate-200/60">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Answers ({sub.responses.length})
                          </p>
                          <div className="space-y-1.5">
                            {sub.responses.map((item, rIdx) => (
                              <div
                                key={rIdx}
                                className="bg-white rounded-lg p-2.5 border border-slate-200/70 shadow-2xs space-y-1"
                              >
                                <p className="text-[11px] font-semibold text-slate-700 leading-tight">
                                  {item.field}
                                </p>
                                <div className="text-xs text-slate-900 font-medium">
                                  {renderResponseValue(item)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No answers recorded</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP LAYOUT (>= 768px): Full Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5"># ID</th>
                      <th className="px-5 py-3.5">Respondent</th>
                      <th className="px-5 py-3.5">Submitted At</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Collected Answers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {responses.map((sub) => {
                      const submittedDate = sub.submitted_at || sub.created_at;
                      const dateStr = submittedDate
                        ? new Date(submittedDate).toLocaleString()
                        : "—";

                      return (
                        <tr
                          key={sub.id}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          {/* ID */}
                          <td className="px-5 py-4 font-mono text-[11px] text-slate-500 font-medium">
                            #{sub.id}
                          </td>

                          {/* Respondent Email */}
                          <td className="px-5 py-4">
                            {sub.respondent_email ? (
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/60">
                                <Mail className="h-3 w-3 text-emerald-600" />
                                <span>{sub.respondent_email}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Anonymous</span>
                            )}
                          </td>

                          {/* Submitted Date */}
                          <td className="px-5 py-4 whitespace-nowrap text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              <span>{dateStr}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
                                sub.status === "submitted"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  sub.status === "submitted"
                                    ? "bg-emerald-500"
                                    : "bg-slate-400"
                                }`}
                              />
                              {sub.status === "submitted" ? "Submitted" : "Archived"}
                            </span>
                          </td>

                          {/* Responses list */}
                          <td className="px-5 py-4">
                            {sub.responses && sub.responses.length > 0 ? (
                              <div className="space-y-1.5 max-w-lg">
                                {sub.responses.map((item, rIdx) => (
                                  <div
                                    key={rIdx}
                                    className="flex items-start gap-2 bg-slate-50/80 rounded-lg px-2.5 py-1.5 border border-slate-100"
                                  >
                                    <span className="font-semibold text-slate-700 shrink-0 text-xs">
                                      {item.field}:
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      {renderResponseValue(item)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-xs">No answers recorded</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
