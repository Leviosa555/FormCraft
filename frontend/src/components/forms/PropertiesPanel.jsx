import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { updateField, deleteField } from "@/api/forms";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";

export default function PropertiesPanel({
  editedField,
  setEditedField,
  fetchFields,
  setSelectedField,
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  if (!editedField) {
    return (
      <div className="h-full flex items-center justify-center p-2 select-none">
        <div className="w-full border-2 border-dashed border-slate-150 rounded-lg p-8 text-center text-slate-400">
          <p className="text-xs font-medium">
            {t("builder.dragToCanvas", "Select a field from the canvas to edit its properties.")}
          </p>
        </div>
      </div>
    );
  }


  const handleChange = (key, value) => {
    setEditedField((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleConfigChange = (key, value) => {
    setEditedField((prev) => ({
      ...prev,
      config: {
        ...(prev.config || {}),
        [key]: value === "" || value === undefined ? undefined : value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const rawCfg = editedField.config || {};
      const cleanCfg = {};

      if (editedField.field_type === "text") {
        if (rawCfg.text_pattern) cleanCfg.text_pattern = rawCfg.text_pattern;
        if (rawCfg.min_length !== undefined && rawCfg.min_length !== "") cleanCfg.min_length = Number(rawCfg.min_length);
        if (rawCfg.max_length !== undefined && rawCfg.max_length !== "") cleanCfg.max_length = Number(rawCfg.max_length);
      } else if (editedField.field_type === "number") {
        if (rawCfg.number_pattern) cleanCfg.number_pattern = rawCfg.number_pattern;
        if (rawCfg.min_length !== undefined && rawCfg.min_length !== "") cleanCfg.min_length = Number(rawCfg.min_length);
        if (rawCfg.max_length !== undefined && rawCfg.max_length !== "") cleanCfg.max_length = Number(rawCfg.max_length);
        if (rawCfg.number_pattern !== "alphanumeric") {
          if (rawCfg.min !== undefined && rawCfg.min !== "") cleanCfg.min = Number(rawCfg.min);
          if (rawCfg.max !== undefined && rawCfg.max !== "") cleanCfg.max = Number(rawCfg.max);
          if (rawCfg.decimal !== undefined) cleanCfg.decimal = Boolean(rawCfg.decimal);
        }
      } else if (editedField.field_type === "dropdown") {
        if (rawCfg.allow_other !== undefined) cleanCfg.allow_other = Boolean(rawCfg.allow_other);
      } else if (editedField.field_type === "checkbox") {
        if (rawCfg.min_select !== undefined && rawCfg.min_select !== "") cleanCfg.min_select = Number(rawCfg.min_select);
        if (rawCfg.max_select !== undefined && rawCfg.max_select !== "") cleanCfg.max_select = Number(rawCfg.max_select);
      } else if (editedField.field_type === "file") {
        if (Array.isArray(rawCfg.allowed_extensions) && rawCfg.allowed_extensions.length > 0) {
          cleanCfg.allowed_extensions = rawCfg.allowed_extensions;
        }
        if (rawCfg.max_size_mb !== undefined && rawCfg.max_size_mb !== "") cleanCfg.max_size_mb = Number(rawCfg.max_size_mb);
      } else if (editedField.field_type === "rating") {
        cleanCfg.max_rating = 5;
      }

      await updateField(editedField.id, {
        label: editedField.label,
        placeholder: editedField.placeholder,
        help_text: editedField.help_text,
        required: editedField.required,
        field_type: editedField.field_type,
        display_order: editedField.display_order,
        config: cleanCfg,
        options: editedField.options,
      });

      await fetchFields();

      setSelectedField((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          ...editedField,
        };
      });

      toast.success("Field updated successfully.");
    } catch (err) {
      console.error(err);

      if (err.response) {
        console.log(err.response.data);
      }

      toast.error("Failed to update field.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteField(editedField.id);

      await fetchFields();

      setSelectedField(null);

      toast.success("Field deleted successfully.");
    } catch (err) {
      console.error(err);

      if (err.response) {
        console.log(err.response.data);
      }

      toast.error("Failed to delete field.");
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Label */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          {t("builder.fieldLabel", "Field Label")}
        </label>

        <Input
          className="h-8.5 text-xs"
          value={editedField.label}
          onChange={(e) => handleChange("label", e.target.value)}
          placeholder={t("builder.fieldLabel", "Field Label")}
        />
      </div>

      {/* Placeholder */}
      {["text", "email", "number", "dropdown"].includes(
        editedField.field_type
      ) && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            {t("builder.fieldPlaceholder", "Placeholder Text")}
          </label>

          <Input
            className="h-8.5 text-xs"
            value={editedField.placeholder || ""}
            onChange={(e) =>
              handleChange("placeholder", e.target.value)
            }
            placeholder={t("builder.fieldPlaceholder", "Placeholder text")}
          />
        </div>
      )}

      {/* Help Text */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          {t("builder.fieldHelpText", "Help Text")}
        </label>

        <Textarea
          className="text-xs min-h-[60px]"
          value={editedField.help_text || ""}
          onChange={(e) =>
            handleChange("help_text", e.target.value)
          }
          placeholder={t("builder.fieldHelpText", "Help text")}
          rows={3}
        />
      </div>

      {/* Required checkbox */}
      <div className="flex items-center gap-2 py-1">
        <input
          id="required"
          type="checkbox"
          checked={editedField.required}
          onChange={(e) =>
            handleChange("required", e.target.checked)
          }
          className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary"
        />

        <label
          htmlFor="required"
          className="text-xs font-medium text-slate-600 cursor-pointer select-none"
        >
          {t("builder.fieldRequired", "Required Field")}
        </label>
      </div>

      {/* Field Type Display */}
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
          {t("landing.statFields", "Field Type")}
        </p>

        <p className="mt-0.5 font-medium capitalize text-slate-700">
          {editedField.field_type}
        </p>
      </div>

      {/* Validation Rules Section */}
      {["text", "number", "dropdown", "checkbox", "file"].includes(editedField.field_type) && (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <label className="block text-xs font-semibold text-slate-600">
            {t("builder.validationRules", "Validation Rules")}
          </label>

          {/* Text validation properties */}
          {editedField.field_type === "text" && (
            <div className="space-y-2.5">
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Text Format Pattern
                </label>
                <Select
                  value={editedField.config?.text_pattern || "any"}
                  onValueChange={(value) => handleConfigChange("text_pattern", value)}
                >
                  <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any" className="text-xs">Any characters</SelectItem>
                    <SelectItem value="alphanumeric" className="text-xs">Alphanumeric only</SelectItem>
                    <SelectItem value="alpha" className="text-xs">Letters / String only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Min Length
                  </label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="Min characters"
                    value={editedField.config?.min_length ?? ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "min_length",
                        e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0)
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Max Length
                  </label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="Max characters"
                    value={editedField.config?.max_length ?? ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "max_length",
                        e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Number validation properties */}
          {editedField.field_type === "number" && (
            <div className="space-y-2.5">
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Number Format Pattern
                </label>
                <Select
                  value={editedField.config?.number_pattern || "numeric"}
                  onValueChange={(value) => handleConfigChange("number_pattern", value)}
                >
                  <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="numeric" className="text-xs">Number only</SelectItem>
                    <SelectItem value="alphanumeric" className="text-xs">Alphanumeric only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Min Length (Digits)
                  </label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="Min length"
                    value={editedField.config?.min_length ?? ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "min_length",
                        e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0)
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Max Length (Digits)
                  </label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="Max length"
                    value={editedField.config?.max_length ?? ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "max_length",
                        e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                  />
                </div>
              </div>

              {/* Min / Max values are only editable if pattern is numeric */}
              {editedField.config?.number_pattern !== "alphanumeric" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                        Min Value
                      </label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        placeholder="Min value"
                        value={editedField.config?.min ?? ""}
                        onChange={(e) =>
                          handleConfigChange(
                            "min",
                            e.target.value === "" ? "" : parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                        Max Value
                      </label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        placeholder="Max value"
                        value={editedField.config?.max ?? ""}
                        onChange={(e) =>
                          handleConfigChange(
                            "max",
                            e.target.value === "" ? "" : parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input
                      id="decimal"
                      type="checkbox"
                      checked={editedField.config?.decimal ?? false}
                      onChange={(e) =>
                        handleConfigChange("decimal", e.target.checked)
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary"
                    />
                    <label
                      htmlFor="decimal"
                      className="text-[11px] font-medium text-slate-600 cursor-pointer select-none"
                    >
                      Allow Decimal Values
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Dropdown validation properties */}
          {editedField.field_type === "dropdown" && (
            <div className="flex items-center gap-2 py-1">
              <input
                id="allow_other"
                type="checkbox"
                checked={editedField.config?.allow_other ?? false}
                onChange={(e) =>
                  handleConfigChange("allow_other", e.target.checked)
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary"
              />
              <label
                htmlFor="allow_other"
                className="text-[11px] font-medium text-slate-600 cursor-pointer select-none"
              >
                Allow "Other" write-in response
              </label>
            </div>
          )}

          {/* Checkbox validation properties */}
          {editedField.field_type === "checkbox" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Min Selections
                </label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  placeholder="Min selected"
                  value={editedField.config?.min_select ?? ""}
                  onChange={(e) =>
                    handleConfigChange(
                      "min_select",
                      e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0)
                    )
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Max Selections
                </label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  placeholder="Max selected"
                  value={editedField.config?.max_select ?? ""}
                  onChange={(e) =>
                    handleConfigChange(
                      "max_select",
                      e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1)
                    )
                  }
                />
              </div>
            </div>
          )}

          {/* File validation properties */}
          {editedField.field_type === "file" && (
            <div className="space-y-2.5">
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Max File Size (MB)
                </label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  placeholder="e.g. 10"
                  value={editedField.config?.max_size_mb ?? 10}
                  onChange={(e) =>
                    handleConfigChange(
                      "max_size_mb",
                      e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 10)
                    )
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Allowed Extensions (comma-separated)
                </label>
                <Input
                  type="text"
                  className="h-8 text-xs"
                  placeholder="pdf, docx, png, jpg"
                  value={
                    Array.isArray(editedField.config?.allowed_extensions)
                      ? editedField.config.allowed_extensions.join(", ")
                      : typeof editedField.config?.allowed_extensions === "string"
                      ? editedField.config.allowed_extensions
                      : "pdf, docx, png, jpg"
                  }
                  onChange={(e) => {
                    const exts = e.target.value
                      .split(",")
                      .map((s) => s.trim().toLowerCase().replace(/^\./, ""))
                      .filter(Boolean);
                    handleConfigChange("allowed_extensions", exts);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Field Options */}
      {["dropdown", "checkbox"].includes(editedField.field_type) && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className="block text-xs font-semibold text-slate-600">
            Options
          </label>

          <div className="space-y-1.5">
            {editedField.options?.map((option, index) => (
              <div
                key={option.id ?? index}
                className="flex items-center gap-1.5"
              >
                <Input
                  className="h-8 text-xs"
                  value={option.label}
                  placeholder={`Option ${index + 1}`}
                  onChange={(e) => {
                    const updatedOptions = [...editedField.options];

                    updatedOptions[index] = {
                      ...updatedOptions[index],
                      label: e.target.value,
                      value: e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, "_"),
                    };

                    handleChange("options", updatedOptions);
                  }}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={editedField.options.length <= 2}
                  className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                  onClick={() => {
                    const updatedOptions = editedField.options
                      .filter((_, i) => i !== index)
                      .map((option, idx) => ({
                        ...option,
                        display_order: idx + 1,
                      }));

                    handleChange("options", updatedOptions);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-8 text-xs font-semibold gap-1 border-slate-200/80 hover:bg-slate-50 transition-colors"
            onClick={() => {
              handleChange("options", [
                ...editedField.options,
                {
                  label: `Option ${editedField.options.length + 1}`,
                  value: `option_${editedField.options.length + 1}`,
                  display_order: editedField.options.length + 1,
                },
              ]);
            }}
          >
            <Plus className="h-3 w-3" />
            {t("builder.addOption", "Add Option")}
          </Button>
        </div>
      )}

      {/* Save Button */}
      <div className="space-y-2 pt-3 border-t border-slate-100">
        <Button
          className="w-full h-8.5 text-xs font-semibold"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t("builder.saving", "Saving...") : t("builder.save", "Save Changes")}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="destructive"
                className="w-full h-8.5 text-xs font-semibold"
              />
            }
          >
            {t("common.delete", "Delete Field")}
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("builder.deleteFieldConfirm", "Delete this field?")}
              </AlertDialogTitle>

              <AlertDialogDescription>
                This action cannot be undone. The field will be permanently removed from the form.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>
                {t("common.cancel", "Cancel")}
              </AlertDialogCancel>

              <AlertDialogAction onClick={handleDelete}>
                {t("common.delete", "Delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

