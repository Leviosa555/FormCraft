import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import SortableField from "./SortableField";

export default function FormCanvas({
  fields,
  selectedField,
  setSelectedField,
  onReorder,
}) {
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex(
        (field) => field.id === active.id
    );

    const newIndex = fields.findIndex(
        (field) => field.id === over.id
    );

    const reordered = arrayMove(
        fields,
        oldIndex,
        newIndex
    );

    onReorder(reordered);
  };

  if (!fields.length) {
    return (
      <div className="h-full flex items-center justify-center p-2 select-none">
        <div className="w-full border-2 border-dashed border-slate-150 rounded-lg p-8 text-center text-slate-400">
          <p className="text-xs font-medium">Drag or add a field to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={fields.map((field) => field.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {fields.map((field) => (
            <SortableField
              key={field.id}
              field={field}
              selectedField={selectedField}
              setSelectedField={setSelectedField}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}