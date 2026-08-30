import { GripVertical } from "lucide-react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function SortableField({
  field,
  selectedField,
  setSelectedField,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSelected = selectedField?.id === field.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => setSelectedField(field)}
      className={`
        rounded-xl
        border
        bg-white
        p-4
        transition-all
        select-none
        cursor-pointer
        ${
          isSelected
            ? "border-primary ring-2 ring-primary/20"
            : "border-slate-200 hover:border-primary/50"
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <label className="block font-medium">
            {field.label}

            {field.required && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </label>
          <div className="mt-4">
            {field.field_type === "text" && (
              <input
                type="text"
                disabled
                placeholder={field.placeholder || "Text input"}
                className="w-full rounded-md border bg-gray-50 px-3 py-2 text-sm"
              />
            )}

            {field.field_type === "email" && (
              <input
                type="email"
                disabled
                placeholder={field.placeholder || "Email"}
                className="w-full rounded-md border bg-gray-50 px-3 py-2 text-sm"
              />
            )}

            {field.field_type === "number" && (
              <input
                type="number"
                disabled
                placeholder={field.placeholder || "Number"}
                className="w-full rounded-md border bg-gray-50 px-3 py-2 text-sm"
              />
            )}

            {field.field_type === "date" && (
              <input
                type="date"
                disabled
                className="w-full rounded-md border bg-gray-50 px-3 py-2 text-sm"
              />
            )}

            {field.field_type === "dropdown" && (
              <div className="space-y-2">
                <select
                  disabled
                  className="w-full rounded-md border bg-gray-50 px-3 py-2 text-sm"
                >
                  <option>
                    {field.placeholder || "Select an option"}
                  </option>
                </select>
                <div className="pl-2 text-sm text-gray-500">
                  {field.options?.map((option) => (
                    <div key={option.id ?? option.value}>
                      • {option.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {field.field_type === "checkbox" && (
              <div className="space-y-2">
                {field.options?.map((option) => (
                  <label
                    key={option.id ?? option.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      disabled
                    />

                    {option.label}
                  </label>
                ))}
              </div>
            )}

            {field.field_type === "rating" && (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className="flex h-10 w-10 items-center justify-center rounded-full border bg-gray-50 text-sm font-medium text-gray-600"
                  >
                    {n}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drag Handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
          aria-label="Drag field"
        >
          <GripVertical size={18} />
        </button>
      </div>

      {field.placeholder &&
        !["dropdown", "checkbox", "rating", "text", "email", "date", "number"].includes(field.field_type) && (
          <div className="mt-3 text-sm italic text-gray-400">
            {field.placeholder}
          </div>
      )}
    </div>
  );
}