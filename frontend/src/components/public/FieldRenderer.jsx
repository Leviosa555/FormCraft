export default function FieldRenderer({
  field,
  value,
  onChange,
  error,
}) {
  const inputClass = `w-full rounded-lg border p-3 ${
    error ? "border-red-500" : ""
  }`;

  switch (field.field_type) {
    case "text":
      return (
        <>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />

          {error && (
            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      );

    case "email":
      return (
        <>
          <input
            type="email"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />

          {error && (
            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      );

    case "number": {
      const isAlphanumeric = field.config?.number_pattern === "alphanumeric";
      return (
        <>
          <input
            type={isAlphanumeric ? "text" : "number"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />

          {error && (
            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      );
    }

    case "textarea":
      return (
        <>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={inputClass}
          />

          {error && (
            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      );

    case "date":
      return (
        <>
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />

          {error && (
            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      );

    case "dropdown":
      return (
        <>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          >
            <option value="">
              Select an option
            </option>

            {field.options.map((option) => (
              <option
                key={option.id}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          {error && (
            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      );

    case "checkbox":
      return (
        <>
          <div className="space-y-3">
            {field.options.map((option) => {
              const checked = (value || []).includes(option.value);

              return (
                <label
                  key={option.id}
                  className="flex items-center gap-3 font-normal"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange([
                          ...(value || []),
                          option.value,
                        ]);
                      } else {
                        onChange(
                          (value || []).filter(
                            (v) => v !== option.value
                          )
                        );
                      }
                    }}
                  />

                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>

          {error && (
            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      );

    case "rating":
      return (
        <>
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, index) => index + 1).map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => onChange(rating)}
                className={`h-10 w-10 rounded-full border text-sm font-medium transition ${
                  value === rating
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white hover:bg-gray-100"
                }`}
              >
                {rating}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      );

    case "file":
      return (
        <>
          <input
            type="file"
            accept={(field.config?.allowed_extensions || []).map((extension) => `.${extension.replace(/^\./, "")}`).join(",") || undefined}
            onChange={(e) => onChange(e.target.files?.[0] || null)}
            className={inputClass}
          />
          {field.config?.max_size_mb && <p className="mt-1 text-xs text-muted-foreground">Maximum file size: {field.config.max_size_mb} MB</p>}
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </>
      );

    default:
      return (
        <p className="text-red-500">
          Unsupported field type: {field.field_type}
        </p>
      );
  }
}
