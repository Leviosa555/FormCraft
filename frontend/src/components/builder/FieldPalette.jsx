import {
  Type,
  Mail,
  Hash,
  Calendar,
  Star,
  ChevronDown,
  CheckSquare,
  Paperclip,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { createField } from "@/api/forms";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

export default function FieldPalette({ formId, fields, fetchFields }) {
  const { t } = useTranslation();

  const fieldTypes = [
    { label: t("builder.text", "Text"), type: "text", icon: Type },
    { label: t("builder.email", "Email"), type: "email", icon: Mail },
    { label: t("builder.number", "Number"), type: "number", icon: Hash },
    { label: t("builder.date", "Date"), type: "date", icon: Calendar },
    { label: t("builder.rating", "Rating"), type: "rating", icon: Star },
    { label: t("builder.dropdown", "Dropdown"), type: "dropdown", icon: ChevronDown },
    { label: t("builder.checkbox", "Checkbox"), type: "checkbox", icon: CheckSquare },
    { label: t("builder.file", "File upload"), type: "file", icon: Paperclip },
  ];

  const handleAddField = async (fieldType) => {
    try {
      const payload = {
        label: `Untitled ${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`,
        field_type: fieldType,
        required: false,
        placeholder: "",
        help_text: "",
        display_order: fields.length > 0 ? Math.max(...fields.map((f) => f.display_order)) + 1 : 1,
        config: {},
        options:
          ["dropdown", "checkbox"].includes(fieldType)
            ? [
                {
                  label: "Option 1",
                  value: "option_1",
                  display_order: 1,
                },
                {
                  label: "Option 2",
                  value: "option_2",
                  display_order: 2,
                },
              ]
            : [],
      };

      await createField(formId, payload);
      await fetchFields();
    } catch (err) {
      console.error("Create Field Error:", err);
      if (err.response) {
        toast.error("Failed to add field", {
          description: typeof err.response.data === "string" ? err.response.data : JSON.stringify(err.response.data),
        });
      } else {
        toast.error("Failed to add field", {
          description: err.message,
        });
      }
    }
  };

  return (
    <Card className="border-slate-200/80 shadow-xs shrink-0 bg-white overflow-hidden flex flex-col">
      <CardHeader className="pt-3 pb-2 px-4 border-b border-slate-100 shrink-0">
        <CardTitle className="text-sm font-semibold text-slate-700">
          {t("builder.fieldsPalette", "Field Palette")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3.5">
        <div className="grid grid-cols-2 gap-2">
          {fieldTypes.map((field) => {
            const Icon = field.icon;

            return (
              <Button
                key={field.type}
                variant="outline"
                className="w-full justify-start px-2.5 gap-1.5 h-8 text-[11px] font-medium border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                onClick={() => handleAddField(field.type)}
              >
                <Icon size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{field.label}</span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

