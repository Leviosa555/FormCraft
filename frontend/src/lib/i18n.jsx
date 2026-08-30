import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import en from "./translations/en.json";
import hi from "./translations/hi.json";
import kn from "./translations/kn.json";

export const LOCALES = [
  { code: "en", label: "English", nativeLabel: "English", short: "ENG" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", short: "HIN" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", short: "KAN" },
];

const TRANSLATIONS = {
  en,
  hi,
  kn,
};

const I18nContext = createContext({
  locale: "en",
  setLocale: () => {},
  t: (key, fallback) => fallback || key,
  locales: LOCALES,
});

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const saved = localStorage.getItem("formcraft_locale");
    if (saved && TRANSLATIONS[saved]) {
      return saved;
    }
    return "en";
  });

  const setLocale = (newLocale) => {
    if (TRANSLATIONS[newLocale]) {
      setLocaleState(newLocale);
      localStorage.setItem("formcraft_locale", newLocale);
      document.documentElement.lang = newLocale;
    }
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useMemo(() => {
    return (path, fallback = "") => {
      if (!path) return fallback;
      const keys = path.split(".");

      // 1. Try current locale
      let current = TRANSLATIONS[locale];
      for (const k of keys) {
        if (current && typeof current === "object" && k in current) {
          current = current[k];
        } else {
          current = undefined;
          break;
        }
      }
      if (typeof current === "string") return current;

      // 2. Fallback to English
      let enCurrent = TRANSLATIONS.en;
      for (const k of keys) {
        if (enCurrent && typeof enCurrent === "object" && k in enCurrent) {
          enCurrent = enCurrent[k];
        } else {
          enCurrent = undefined;
          break;
        }
      }
      if (typeof enCurrent === "string") return enCurrent;

      // 3. Fallback to given default or key itself
      return fallback || path;
    };
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      locales: LOCALES,
    }),
    [locale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
