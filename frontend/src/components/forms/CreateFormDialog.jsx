import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  Sparkles,
  FileText,
  Wand2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

import { createForm, autoGenerateForm } from "@/api/forms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";


const INSPIRATION_TEMPLATES = [
  {
    icon: "🛍️",
    label: "Customer Feedback",
    prompt: "Customer satisfaction survey with 1-5 rating, product dropdown, and conditional feedback for low ratings",
  },
  {
    icon: "💼",
    label: "Job Application",
    prompt: "Software developer job application with resume upload, tech skills checkboxes, and years of experience",
  },
  {
    icon: "📅",
    label: "Event RSVP",
    prompt: "Conference RSVP registration with attendance dropdown, guest count, and dietary restriction checkboxes",
  },
  {
    icon: "🏥",
    label: "Patient Intake",
    prompt: "Medical patient intake form with symptoms description, allergy checkboxes, date of birth, and emergency contact",
  },
  {
    icon: "🏢",
    label: "Contact & Quote",
    prompt: "Business contact and project quote inquiry with service selection, urgency rating, and preferred contact method",
  },
];

export default function CreateFormDialog({ onCreated }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("ai"); // "ai" | "manual"

  // AI Prompt State
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  // Manual Form State
  const [form, setForm] = useState({
    title: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);

  const countWords = (str) =>
    str ? str.trim().split(/\s+/).filter(Boolean).length : 0;
  const wordCount = countWords(form.description);

  const handleManualCreate = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }

    if (form.title.trim().length > 26) {
      toast.error("Form title cannot exceed 26 characters.");
      return;
    }

    if (wordCount > 14) {
      toast.error(
        `Description cannot exceed 14 words (currently ${wordCount} words).`
      );
      return;
    }

    setLoading(true);

    try {
      const created = await createForm(form);
      setOpen(false);
      setForm({ title: "", description: "" });
      toast.success("Form created successfully!");
      if (onCreated) onCreated();
      if (created?.id) navigate(`/builder/${created.id}`);
    } catch (err) {
      console.error(err);
      const data = err?.response?.data;
      const msg =
        data?.title?.[0] || data?.description?.[0] || "Failed to create form.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAiGenerate = async (e) => {
    e?.preventDefault();

    if (!prompt.trim()) {
      toast.error("Please describe your form idea or select an inspiration template.");
      return;
    }

    setGenerating(true);

    try {
      const generated = await autoGenerateForm({ prompt: prompt.trim() });
      setOpen(false);
      setPrompt("");
      toast.success("Form generated successfully with fields & logic!", {
        description: `Created: "${generated.title}"`,
      });
      if (onCreated) onCreated();
      if (generated?.id) {
        navigate(`/builder/${generated.id}`);
      }
    } catch (err) {
      console.error("Auto generate error:", err);
      const data = err?.response?.data;
      const msg = data?.error || data?.prompt?.[0] || "Failed to auto-generate form.";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
          <Plus className="h-3.5 w-3.5" />
          <span>{t("dashboard.createForm", "Create Form")}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900">
                {t("dashboard.modalCreateTitle", "Create New Form")}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {t("dashboard.modalCreateDesc", "Generate instantly from an idea or build from scratch.")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="mt-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100/70 p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("ai")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all ${
              tab === "ai"
                ? "bg-white text-emerald-700 shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wand2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t("dashboard.aiGenerate", "AI Automated Creation")}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all ${
              tab === "manual"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="h-3.5 w-3.5 text-slate-500" />
            <span>{t("dashboard.createForm", "Blank Form")}</span>
          </button>
        </div>


        {/* TAB 1: AI Auto Generator */}
        {tab === "ai" && (
          <form onSubmit={handleAiGenerate} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span>Describe your form idea</span>
                <span className="text-[10.5px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                  100% Automated & Free
                </span>
              </label>
              <Textarea
                rows={3}
                placeholder="e.g. Job application form for Senior React Developer with resume file upload, technical skills checkboxes, and years of experience..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="text-xs leading-relaxed resize-none rounded-xl border-slate-200 focus:border-emerald-500"
                disabled={generating}
              />
            </div>

            {/* Quick Inspiration Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-500">
                Quick inspiration templates:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {INSPIRATION_TEMPLATES.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setPrompt(item.prompt)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-900"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={generating}
                className="h-9 text-xs"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={generating || !prompt.trim()}
                className="h-9 px-5 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {generating ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>{t("dashboard.modalAIGenerating", "Generating Form Schema...")}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{t("dashboard.modalAIGenerateBtn", "Generate Form with AI")}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* TAB 2: Manual Blank Form */}
        {tab === "manual" && (
          <form onSubmit={handleManualCreate} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800">
                {t("dashboard.modalFormTitle", "Form Title")} <span className="text-red-500">*</span>
              </label>
              <Input
                name="title"
                placeholder={t("dashboard.modalFormTitlePlaceholder", "e.g. Employee Feedback")}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                maxLength={26}
                className="h-9 text-xs rounded-xl border-slate-200"
                disabled={loading}
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Max 26 characters</span>
                <span>{form.title.length}/26</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800">
                {t("dashboard.modalFormDesc", "Description")}
              </label>
              <Textarea
                name="description"
                rows={2}
                placeholder={t("dashboard.modalFormDescPlaceholder", "Brief summary of the form's purpose...")}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="text-xs leading-relaxed resize-none rounded-xl border-slate-200"
                disabled={loading}
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Max 14 words</span>
                <span className={wordCount > 14 ? "text-red-500 font-semibold" : ""}>
                  {wordCount}/14 words
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="h-9 text-xs"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !form.title.trim()}
                className="h-9 px-5 text-xs font-semibold"
              >
                {loading ? "Creating..." : t("dashboard.modalCreateBtn", "Create Form")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}