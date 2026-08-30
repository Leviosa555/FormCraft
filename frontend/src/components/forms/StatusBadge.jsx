import { Badge } from "@/components/ui/badge";
import { Circle } from "lucide-react";

const statusStyles = {
  draft: {
    label: "Draft",
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100",
  },
  published: {
    label: "Published",
    className:
      "bg-green-100 text-green-800 border-green-300 hover:bg-green-100",
  },
  archived: {
    label: "Archived",
    className:
      "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-100",
  },
};

export default function StatusBadge({ status }) {
  const config = statusStyles[status] || {
    label: status,
    className: "",
  };

  return (
    <Badge
      variant="outline"
      className={`flex w-fit items-center gap-1 ${config.className}`}
    >
      <Circle className="h-2 w-2 fill-current" />
      {config.label}
    </Badge>
  );
}