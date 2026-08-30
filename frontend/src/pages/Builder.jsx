import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getForm,
  getFields,
  reorderFields,
  publishForm,
  archiveForm,
  editForm,
  deleteForm,
  getConditionalRules,
  createConditionalRule,
  deleteConditionalRule,
} from "@/api/forms";

import FieldPalette from "@/components/builder/FieldPalette";
import FormCanvas from "@/components/builder/FormCanvas";
import PropertiesPanel from "@/components/forms/PropertiesPanel";
import StatusBadge from "@/components/forms/StatusBadge";
import FormExpirationDialog from "@/components/forms/FormExpirationDialog";
import ShareFormDialog from "@/components/forms/ShareFormDialog";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useTranslation } from "@/lib/i18n";


import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Builder() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();


  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [editedField, setEditedField] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conditionalRules, setConditionalRules] = useState([]);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState("canvas"); // "palette" | "canvas" | "properties"

  const [newRule, setNewRule] = useState({
    trigger_field: "",
    operator: "equals",
    comparison_value: "",
    action: "show",
    target_field: "",
  });

  // Fetch form
  const fetchForm = async () => {
    try {
      const res = await getForm(id);
      setForm(res.data);
    } catch (err) {
      console.error("Failed to fetch form:", err);
    }
  };

  // Refresh field list
  const fetchFields = async () => {
    try {
      const res = await getFields(id);

      setFields(res.data);

      if (editedField) {
        const updated = res.data.find(
          (field) => field.id === editedField.id
        );

        if (updated) {
          setSelectedField(updated);
          setEditedField(updated);
        }
      }
    } catch (err) {
      console.error("Error fetching fields:", err);
    }
  };

  const fetchConditionalRules = async () => {
    try {
      const data = await getConditionalRules(id);

      setConditionalRules(data);
    } catch (err) {
      console.error(
        "Failed to fetch conditional rules:",
        err
      );
    }
  };

  // Fetch builder data
  const fetchBuilderData = async () => {
    await Promise.all([
      fetchForm(),
      fetchFields(),
      fetchConditionalRules(),
    ]);
  };

  // Load form + fields
  useEffect(() => {
    const loadBuilder = async () => {
      try {
        await fetchBuilderData();
      } finally {
        setLoading(false);
      }
    };

    loadBuilder();
  }, [id]);

  const handleReorder = async (newFields) => {
    setFields(newFields);

    try {
      await reorderFields(id, {
        field_order: newFields.map((field, index) => ({
          id: field.id,
          display_order: index + 1,
        })),
      });

      await fetchFields();
    } catch (err) {
      console.error("Failed to reorder fields:", err);

      fetchFields();
    }
  };

  const handlePublish = async () => {
    try {
      const result = await publishForm(id);

      setShareToken(result.share_token);

      await fetchForm();

      toast.success(result.message, {
        description: `Version ${result.version} is now live.`,
      });
    } catch (err) {
      console.error("Failed to publish form:", err);

      let description = "Please try again.";

      const data = err.response?.data;

      if (typeof data === "string") {
        description = data;
      } else if (Array.isArray(data)) {
        description = data.join(", ");
      } else if (data?.detail) {
        description = data.detail;
      } else if (data?.non_field_errors?.length) {
        description = data.non_field_errors.join(", ");
      } else if (data && typeof data === "object") {
        const firstValue = Object.values(data)[0];

        if (Array.isArray(firstValue)) {
          description = firstValue.join(", ");
        } else if (typeof firstValue === "string") {
          description = firstValue;
        }
      }

      toast.error("Publish Failed", {
        description,
      });
    }
  };

  const handleArchive = async () => {
    try {
      const result = await archiveForm(id);

      await fetchForm();

      toast.success(result.message);
    } catch (err) {
      console.error("Failed to archive form:", err);

      const data = err.response?.data;

      let description = "Please try again.";

      if (Array.isArray(data)) {
        description = data.join(", ");
      } else if (typeof data === "string") {
        description = data;
      } else if (data?.detail) {
        description = data.detail;
      }

      toast.error("Archive Failed", {
        description,
      });
    }
  };

  const handleEditDraft = async () => {
    try {
      const result = await editForm(id);

      await fetchBuilderData();

      toast.success(result.message, {
        description: `Draft version ${result.version} created.`,
      });
    } catch (err) {
      console.error("Failed to create draft:", err);

      const data = err.response?.data;

      let description = "Please try again.";

      if (Array.isArray(data)) {
        description = data.join(", ");
      } else if (typeof data === "string") {
        description = data;
      } else if (data?.detail) {
        description = data.detail;
      }

      toast.error("Edit Failed", {
        description,
      });
    }
  };

  const handleCreateRule = async () => {
    try {
      const trigger = fields.find((field) => field.id === newRule.trigger_field);
      const comparisonValue = newRule.operator === "is_empty"
        ? null
        : ["number", "rating"].includes(trigger?.field_type)
          ? Number(newRule.comparison_value)
          : newRule.comparison_value;

      await createConditionalRule(id, {
        ...newRule,
        comparison_value: comparisonValue,
      });

      await fetchConditionalRules();

      toast.success("Conditional rule created.");

      setRuleDialogOpen(false);

      setNewRule({
        trigger_field: "",
        operator: "equals",
        comparison_value: "",
        action: "show",
        target_field: "",
      });

    } catch (err) {
      console.error(err);

      let description = "Please try again.";

      const data = err.response?.data;

      if (Array.isArray(data)) {
        description = data.join(", ");
      } else if (typeof data === "string") {
        description = data;
      } else if (data?.detail) {
        description = data.detail;
      }

      toast.error("Failed to create rule", {
        description,
      });
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await deleteConditionalRule(ruleId);
      await fetchConditionalRules();
      toast.success("Conditional rule removed.");
    } catch (err) {
      console.error("Failed to delete conditional rule:", err);
      toast.error("Failed to remove conditional rule.");
    }
  };

  const handleCopyLink = async () => {
    if (!shareToken) return;

    const url = `${window.location.origin}/forms/${shareToken}`;

    try {
      await navigator.clipboard.writeText(url);

      toast.success("Link copied!", {
        description: "Public form URL copied to clipboard.",
      });
    } catch {
      toast.error("Unable to copy link.");
    }
  };

  const handleDeleteForm = async () => {
    try {
      await deleteForm(id);

      toast.success("Form deleted successfully.");

      navigate("/dashboard", {
        replace: true,
      });
    } catch (err) {
      console.error(err);

      toast.error("Failed to delete form.");
    }
  };

  useEffect(() => {
    setEditedField(selectedField);
  }, [selectedField]);

  const displayFields = fields.map((field) =>
    editedField && field.id === editedField.id
      ? editedField
      : field
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading Builder...
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-slate-50 overflow-y-auto lg:overflow-hidden">
      {/* Header section - clean top navbar */}
      <header className="border-b bg-white px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                {form.title}
              </h1>
              <StatusBadge status={form.status} />
            </div>
            {form.description ? (
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl font-normal leading-relaxed">
                {form.description}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5 italic">
                No description provided.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LanguageSelector />
          <FormExpirationDialog
            form={form}
            onUpdated={(updated) => setForm((prev) => ({ ...prev, ...updated }))}
          />

          {form.status === "draft" && (
            <Button size="sm" onClick={handlePublish} className="h-8.5 text-xs">
              {t("builder.publish", "Publish Form")}
            </Button>
          )}

          {form.status === "published" && (
            <>
              <Button size="sm" onClick={handleEditDraft} className="h-8.5 text-xs">
                {t("builder.activeDraft", "Edit Draft")}
              </Button>

              <ShareFormDialog form={form} shareToken={shareToken} />

              <Button
                variant="destructive"
                size="sm"
                onClick={handleArchive}
                className="h-8.5 text-xs"
              >
                {t("dashboard.statusArchived", "Archive")}
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="h-8.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            {t("dashboard.delete", "Delete Form")}
          </Button>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 min-h-0 p-3 sm:p-4 lg:p-6 bg-slate-50/50 flex flex-col">
        {/* Mobile / Tablet Tab Switcher (< lg only) */}
        <div className="flex lg:hidden items-center justify-center p-1 mb-3 rounded-xl border border-slate-200 bg-white shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab("palette")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === "palette"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("builder.palette", "Field Palette")}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("canvas")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === "canvas"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("builder.canvas", "Form Canvas")}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("properties")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === "properties"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("builder.properties", "Properties")}
          </button>
        </div>

        <div className="mx-auto max-w-7xl w-full h-full flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Left Column: Field Palette & Conditional Logic */}
          <div className={`${mobileTab === "palette" ? "flex" : "hidden"} lg:flex lg:col-span-3 flex-col gap-4 h-full min-h-[500px] lg:min-h-0 overflow-hidden`}>
            <FieldPalette
              formId={id}
              fields={fields}
              fetchFields={fetchFields}
            />

            <Card className="flex-1 flex flex-col min-h-0 border-slate-200/80 shadow-xs overflow-hidden bg-white">
              <CardHeader className="pt-3 pb-2 px-4 flex flex-row items-center justify-between shrink-0 border-b border-slate-100 space-y-0">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  {t("builder.conditionalLogic", "Conditional Logic")} ({conditionalRules.length})
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                  onClick={() => setRuleDialogOpen(true)}
                  disabled={fields.length < 2}
                  title={fields.length < 2 ? "Requires at least 2 fields" : "Add Logic Rule"}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto p-4">
                {conditionalRules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6 text-slate-400">
                    <p className="text-xs">{t("builder.noRules", "No conditional rules yet.")}</p>
                    <p className="text-[11px] mt-1 text-slate-400">
                      {fields.length < 2
                        ? t("builder.needFields", "Add 2+ fields to enable logic rules.")
                        : t("builder.clickPlus", "Click + to create a rule.")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conditionalRules.map((rule) => {
                      const triggerField = fields.find((f) => f.id === rule.trigger_field);
                      const targetField = fields.find((f) => f.id === rule.target_field);
                      const triggerLabel = triggerField?.label || "Unknown Field";
                      const targetLabel = targetField?.label || "Unknown Field";
                      const operatorLabel = {
                        equals: "equals",
                        not_equals: "does not equal",
                        contains: "contains",
                        gt: "is greater than",
                        lt: "is less than",
                        is_empty: "is empty",
                      }[rule.operator] || rule.operator;
                      const actionLabel = {
                        show: "Show",
                        hide: "Hide",
                        require: "Require",
                      }[rule.action] || rule.action;

                      return (
                        <div
                          key={rule.id}
                          className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-left text-xs transition-all hover:bg-slate-50 relative group shadow-2xs"
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-5 w-5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <div className="space-y-1 pr-4">
                            <div>
                              <span className="font-semibold text-primary mr-1 text-[10px] tracking-wider uppercase">IF</span>
                              <span className="font-medium text-slate-700">{triggerLabel}</span>
                            </div>
                            <div className="pl-3.5 text-[11px] text-slate-500 flex items-center gap-1">
                              <span>{operatorLabel}</span>
                              {rule.operator !== "is_empty" && (
                                <span className="font-medium text-slate-800 bg-white border border-slate-100 px-1.5 py-0.5 rounded-sm">
                                  "{rule.comparison_value}"
                                </span>
                              )}
                            </div>
                            <div className="pt-2 border-t border-slate-100/80 mt-2">
                              <span className="font-semibold text-emerald-600 mr-1 text-[10px] tracking-wider uppercase">THEN</span>
                              <span className="font-medium text-slate-800">{actionLabel}</span>
                              <span className="text-slate-500 pl-1">{targetLabel}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center Column: Form Canvas */}
          <Card className={`${mobileTab === "canvas" ? "flex" : "hidden"} lg:flex lg:col-span-6 flex-col min-h-[500px] lg:min-h-0 h-full border-slate-200/80 shadow-xs overflow-hidden bg-white`}>
            <CardHeader className="pt-3 pb-2 px-4 border-b border-slate-100 shrink-0">
              <CardTitle className="text-sm font-semibold text-slate-700">Form Canvas</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4">
              <FormCanvas
                fields={displayFields}
                selectedField={selectedField}
                setSelectedField={setSelectedField}
                onReorder={handleReorder}
              />
            </CardContent>
          </Card>

          {/* Right Column: Properties */}
          <Card className={`${mobileTab === "properties" ? "flex" : "hidden"} lg:flex lg:col-span-3 flex-col min-h-[500px] lg:min-h-0 h-full border-slate-200/80 shadow-xs overflow-hidden bg-white`}>
            <CardHeader className="pt-3 pb-2 px-4 border-b border-slate-100 shrink-0">
              <CardTitle className="text-sm font-semibold text-slate-700">Properties</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4">
              <PropertiesPanel
                editedField={editedField}
                setEditedField={setEditedField}
                fetchFields={fetchFields}
                setSelectedField={setSelectedField}
              />
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete Form
            </DialogTitle>

            <DialogDescription>
              Are you sure you want to permanently delete
              <strong> "{form.title}"</strong>?
              <br />
              <br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={handleDeleteForm}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
      >
        <DialogContent className="sm:max-w-2xl border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>
              Create Conditional Rule
            </DialogTitle>

            <DialogDescription>
              Create a rule that controls another field
              based on a user's input.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">

            {/* IF Section */}
            <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                <h3 className="text-xs font-bold tracking-wider uppercase text-primary">
                  IF THIS CONDITION IS MET
                </h3>
                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                  Trigger
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Field */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                    Field
                  </label>

                  <Select
                    value={newRule.trigger_field.toString()}
                    onValueChange={(value) =>
                      setNewRule((prev) => ({
                        ...prev,
                        trigger_field: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-200 bg-white">
                      <SelectValue>
                        {fields.find(
                          (field) => field.id === newRule.trigger_field
                        )?.label || "Select field"}
                      </SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                      {fields.map((field) => (
                        <SelectItem
                          key={field.id}
                          value={field.id.toString()}
                          className="text-xs"
                        >
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Operator */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                    Operator
                  </label>

                  <Select
                    value={newRule.operator}
                    onValueChange={(value) =>
                      setNewRule((prev) => ({
                        ...prev,
                        operator: value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="equals" className="text-xs">is equal to</SelectItem>
                      <SelectItem value="not_equals" className="text-xs">is not equal to</SelectItem>
                      <SelectItem value="contains" className="text-xs">contains</SelectItem>
                      <SelectItem value="greater_than" className="text-xs">is greater than</SelectItem>
                      <SelectItem value="is_empty" className="text-xs">is empty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Value */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                    Value
                  </label>

                  <input
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50 disabled:bg-slate-50"
                    value={newRule.comparison_value}
                    disabled={newRule.operator === "is_empty"}
                    placeholder={newRule.operator === "is_empty" ? "No value required" : "Enter value"}
                    onChange={(e) =>
                      setNewRule((prev) => ({
                        ...prev,
                        comparison_value: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* THEN Section */}
            <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                <h3 className="text-xs font-bold tracking-wider uppercase text-emerald-600">
                  THEN PERFORM THIS ACTION
                </h3>
                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                  Action
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Action */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                    Action
                  </label>

                  <Select
                    value={newRule.action}
                    onValueChange={(value) =>
                      setNewRule((prev) => ({
                        ...prev,
                        action: value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="show" className="text-xs">Show</SelectItem>
                      <SelectItem value="hide" className="text-xs">Hide</SelectItem>
                      <SelectItem value="require" className="text-xs">Require</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Affected Field */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                    Affected Field
                  </label>

                  <Select
                    value={newRule.target_field.toString()}
                    onValueChange={(value) =>
                      setNewRule((prev) => ({
                        ...prev,
                        target_field: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-200 bg-white">
                      <SelectValue>
                        {fields.find(
                          (field) => field.id === newRule.target_field
                        )?.label || "Select field"}
                      </SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                      {fields.map((field) => (
                        <SelectItem
                          key={field.id}
                          value={field.id.toString()}
                          className="text-xs"
                        >
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRuleDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              disabled={
                !newRule.trigger_field ||
                !newRule.target_field ||
                (newRule.operator !== "is_empty" && newRule.comparison_value === "")
              }
              onClick={handleCreateRule}
            >
              Create Rule
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </div>
  );
}
