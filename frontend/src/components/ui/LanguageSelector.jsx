import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useTranslation, LOCALES } from "@/lib/i18n";

export function LanguageSelector({ variant = "default", align = "auto", className = "" }) {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [dropdownAlign, setDropdownAlign] = useState(align === "auto" ? "left" : align);
  const dropdownRef = useRef(null);

  const currentLocale = LOCALES.find((l) => l.code === locale) || LOCALES[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      if (dropdownRef.current && align === "auto") {
        const rect = dropdownRef.current.getBoundingClientRect();
        // If button is in the rightmost 140px of the viewport, align right; else align left.
        if (window.innerWidth - rect.right < 140) {
          setDropdownAlign("right");
        } else {
          setDropdownAlign("left");
        }
      } else if (align !== "auto") {
        setDropdownAlign(align);
      }
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, align]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-800 backdrop-blur-md transition-all hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs cursor-pointer"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Globe className="h-3.5 w-3.5 text-slate-500" />
        <span className="tracking-wide uppercase font-bold text-[11px]">{currentLocale.short}</span>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-xl ring-1 ring-black/5 focus:outline-none z-[9999] animate-in fade-in-0 zoom-in-95 duration-150 ${
            dropdownAlign === "right"
              ? "right-0 origin-top-right"
              : "left-0 origin-top-left"
          }`}
          style={{ zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Select Language
          </div>
          <div className="h-px bg-slate-100 my-1" />
          <div className="flex flex-col gap-0.5">
            {LOCALES.map((item) => {
              const isSelected = item.code === locale;
              return (
                <button
                  key={item.code}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setLocale(item.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{item.nativeLabel}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({item.short})</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
