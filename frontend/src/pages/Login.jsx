import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  GitBranch,
  Inbox,
} from "lucide-react";

import { login, register } from "../api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useTranslation } from "@/lib/i18n";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState("login"); // "login" | "register"

  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const highlights = [
    {
      icon: GitBranch,
      num: "01",
      title: t("landing.feature1Title", "Conditional Field Logic"),
      desc: t("landing.feature1Desc", "Show, hide, or require fields dynamically based on user input."),
    },
    {
      icon: ShieldCheck,
      num: "02",
      title: t("landing.feature2Title", "Server-Enforced Validation"),
      desc: t("landing.feature2Desc", "Strict type, range, and format checks guarantee clean data."),
    },
    {
      icon: Inbox,
      num: "03",
      title: t("landing.feature6Title", "Unified Response Hub"),
      desc: t("landing.feature6Desc", "Browse, filter, and export clean CSV submissions instantly."),
    },
  ];

  useEffect(() => {
    const token = localStorage.getItem("access") || localStorage.getItem("access_token");
    if (token) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (location.pathname === "/register") {
      setMode("register");
    } else {
      setMode("login");
    }
  }, [location.pathname, navigate]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
    if (generalError) {
      setGeneralError("");
    }
  };

  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setFieldErrors({});
    setGeneralError("");
    if (newMode === "register") {
      window.history.replaceState(null, "", "/register");
    } else {
      window.history.replaceState(null, "", "/login");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});
    setGeneralError("");

    if (mode === "register") {
      const errors = {};
      if (!form.email.trim()) {
        errors.email = "Email address is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        errors.email = "Please enter a valid email address.";
      }

      if (!form.username.trim()) {
        errors.username = "Username is required.";
      } else if (form.username.trim().length < 3) {
        errors.username = "Username must be at least 3 characters.";
      }

      if (!form.password) {
        errors.password = "Password is required.";
      } else if (form.password.length < 6) {
        errors.password = "Password must be at least 6 characters.";
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setLoading(false);
        return;
      }

      try {
        const regRes = await register(form.username.trim(), form.email.trim(), form.password);
        toast.success("Account created successfully! Signing in...");
        const loginData = await login(form.username.trim(), form.password);
        const access = loginData.access || regRes.access;
        const refresh = loginData.refresh || regRes.refresh;
        const user = loginData.user || regRes.user;

        localStorage.setItem("access", access);
        localStorage.setItem("access_token", access);
        localStorage.setItem("refresh", refresh);
        localStorage.setItem("refresh_token", refresh);
        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
        }
        navigate("/dashboard", { replace: true });
      } catch (err) {

        const backendErrors = {};
        if (err.response?.data) {
          const data = err.response.data;
          if (data.username) {
            backendErrors.username = Array.isArray(data.username) ? data.username[0] : data.username;
          }
          if (data.email) {
            backendErrors.email = Array.isArray(data.email) ? data.email[0] : data.email;
          }
          if (data.password) {
            backendErrors.password = Array.isArray(data.password) ? data.password[0] : data.password;
          }
          if (data.detail) {
            setGeneralError(data.detail);
          } else if (data.error) {
            setGeneralError(data.error);
          } else if (Object.keys(backendErrors).length === 0) {
            setGeneralError("Registration failed. Please check your inputs.");
          }
        } else {
          setGeneralError("Network error. Please try again later.");
        }
        setFieldErrors(backendErrors);
        toast.error("Registration failed. Please correct the highlighted errors.");
      } finally {
        setLoading(false);
      }
    } else {
      // Login mode
      const errors = {};
      if (!form.username.trim()) {
        errors.username = "Username is required.";
      }
      if (!form.password) {
        errors.password = "Password is required.";
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setLoading(false);
        return;
      }

      try {
        const data = await login(form.username.trim(), form.password);
        localStorage.setItem("access", data.access);
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh", data.refresh);
        localStorage.setItem("refresh_token", data.refresh);
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        }
        toast.success("Welcome back!");
        navigate("/dashboard", { replace: true });
      } catch (err) {


        let errorMsg = t("auth.noAccountError", "Email or Password is incorrect.");
        if (err.response?.data) {
          const data = err.response.data;
          const raw = data.detail || data.error || (typeof data === "string" ? data : "");
          if (
            typeof raw === "string" &&
            (raw.toLowerCase().includes("no active account") || raw.toLowerCase().includes("not found") || raw.toLowerCase().includes("credentials") || raw.toLowerCase().includes("incorrect"))
          ) {
            errorMsg = t("auth.noAccountError", "Email or Password is incorrect.");
          } else if (raw) {
            errorMsg = raw;
          }
        } else {

          errorMsg = "Unable to connect to the server. Please check your network and try again.";
        }
        setGeneralError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen lg:h-screen w-full lg:w-screen overflow-y-auto lg:overflow-hidden bg-background text-foreground flex flex-col lg:flex-row antialiased selection:bg-primary/20 selection:text-primary">
      {/* Mobile Top Header Bar (< lg) */}
      <div className="flex lg:hidden items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border bg-surface shrink-0 z-30">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-primary text-[11px] font-semibold text-primary-foreground shadow-xs">
            FC
          </span>
          <span className="text-[15px] font-semibold tracking-tight">FormCraft</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Left Column: Editorial, Branding & Highlights (Desktop lg: and up) */}
      <div className="hidden lg:flex relative flex-1 flex-col justify-between border-r border-border bg-surface p-5 sm:p-7 lg:overflow-hidden lg:px-10 lg:py-6 xl:px-14 xl:py-7">
        {/* Subtle radial ambient background glow */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />

        {/* Top bar: Brand & Back link & Language */}
        <div className="relative z-30 flex items-center justify-between shrink-0">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-primary text-[11px] font-semibold tracking-tight text-primary-foreground shadow-xs transition-transform group-hover:scale-105">
              FC
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">FormCraft</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <LanguageSelector />
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t("auth.backToWebsite", "Back to website")}
            </Link>
          </div>
        </div>


        {/* Main Content Area */}
        <div className="relative z-10 my-auto max-w-lg py-2">
          <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-[10.5px] font-medium text-primary shadow-2xs">
            <span>{t("auth.tagline", "The Modern Form Platform")}</span>
          </div>

          <h1 className="text-2xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-3xl lg:text-[34px]">
            {t("auth.heroLead", "Build forms")}{" "}
            <span className="text-muted-foreground">{t("auth.heroMuted", "without the busywork.")}</span>
          </h1>

          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
            {t(
              "auth.heroDesc",
              "Create intelligent forms, enforce strict server validation rules, automate responses, and keep every submission clean and structured in one place."
            )}
          </p>

          {/* Feature Highlights Grid */}
          <div className="mt-5 space-y-3">
            {highlights.map((h) => {
              const Icon = h.icon;
              return (
                <div
                  key={h.num}
                  className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/80 p-2.5 shadow-2xs backdrop-blur-xs transition-all hover:border-foreground/20 hover:bg-background"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[18px] text-primary">{h.num}</span>
                      <h3 className="text-[15px] font-medium tracking-tight text-foreground">
                        {h.title}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                      {h.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 hidden items-center justify-between border-t border-border/70 pt-3.5 text-[11.5px] text-muted-foreground shrink-0 lg:flex">
          <span>© {new Date().getFullYear()} FormCraft. {t("landing.footerRights", "All rights reserved.")}</span>
          <div className="flex items-center gap-3.5">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3 w-3 text-primary" /> {t("auth.serverLogic", "Server-side logic")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3 w-3 text-primary" /> {t("auth.instantCsv", "Instant CSV export")}
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-background/50 p-5 sm:p-7 lg:p-10">
        {/* Dot pattern grid */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--border)_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-70 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_60%,transparent_100%)]" />

        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/10 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-primary/8 blur-[90px]" />

        <div className="relative z-10 w-full max-w-[390px]">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 rounded-xl border border-border bg-surface/80 p-1 shadow-2xs backdrop-blur-xs">
            <button
              type="button"
              onClick={() => handleSwitchMode("login")}
              className={`relative flex items-center justify-center py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${mode === "login"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {t("auth.signInBtn", "Sign In")}
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode("register")}
              className={`relative flex items-center justify-center py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${mode === "register"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {t("auth.createAccountBtn", "Create Account")}
            </button>
          </div>

          {/* Form Card Container */}
          <div className="mt-4 rounded-2xl border border-border/80 bg-card/90 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-md sm:p-6.5">
            <div className="mb-4">
              <h2 className="text-lg font-medium tracking-tight text-foreground">
                {mode === "login" ? t("auth.signInTitle", "Welcome back") : t("auth.createAccountTitle", "Create your workspace")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {mode === "login"
                  ? t("auth.signInSubtitle", "Enter your credentials to access your form studio.")
                  : t("auth.createAccountSubtitle", "Fill in the details below to start building dynamic forms.")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* General Error Banner */}
              {generalError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive leading-relaxed">
                  {generalError}
                </div>
              )}

              {/* Email Address (Register mode only) */}
              <AnimatePresence>
                {mode === "register" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1 overflow-hidden"
                  >
                    <Label
                      htmlFor="email"
                      className="text-xs font-medium text-foreground flex items-center gap-1.5"
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("auth.email", "Email address")}
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t("auth.emailPlaceholder", "you@example.com")}
                      value={form.email}
                      onChange={handleChange}
                      autoComplete="email"
                      className={`h-9 rounded-lg border bg-surface/40 text-xs transition-colors focus-visible:bg-background ${fieldErrors.email
                        ? "border-destructive focus-visible:ring-destructive"
                        : "border-border"
                        }`}
                      required
                    />
                    {fieldErrors.email && (
                      <p className="text-[11px] font-medium text-destructive">{fieldErrors.email}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Username */}
              <div className="space-y-1">
                <Label
                  htmlFor="username"
                  className="text-xs font-medium text-foreground flex items-center gap-1.5"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("auth.username", "Username")}
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder={mode === "register" ? t("auth.usernameRegisterPlaceholder", "Choose a unique username") : t("auth.usernamePlaceholder", "Enter your username")}
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                  className={`h-9 rounded-lg border bg-surface/40 text-xs transition-colors focus-visible:bg-background ${fieldErrors.username
                    ? "border-destructive focus-visible:ring-destructive"
                    : "border-border"
                    }`}
                  required
                />
                {fieldErrors.username && (
                  <p className="text-[11px] font-medium text-destructive">
                    {fieldErrors.username}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-xs font-medium text-foreground flex items-center gap-1.5"
                  >
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("auth.password", "Password")}
                  </Label>
                  {mode === "register" && (
                    <span className="text-[10px] text-muted-foreground">{t("auth.minCharacters", "Min. 6 characters")}</span>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  placeholder={mode === "register" ? t("auth.passwordRegisterPlaceholder", "Create a secure password") : t("auth.passwordPlaceholder", "Enter your password")}
                  value={form.password}
                  onChange={handleChange}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className={`h-9 rounded-lg border bg-surface/40 text-xs transition-colors focus-visible:bg-background ${fieldErrors.password
                    ? "border-destructive focus-visible:ring-destructive"
                    : "border-border"
                    }`}
                  required
                />
                {fieldErrors.password && (
                  <p className="text-[11px] font-medium text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-9.5 rounded-xl text-xs font-medium gap-2 mt-2 bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
                disabled={loading}
              >
                {loading ? (
                  mode === "register" ? t("auth.creatingAccount", "Creating workspace...") : t("auth.signingIn", "Signing in...")
                ) : (
                  <>
                    {mode === "register" ? t("auth.createAccountAction", "Create workspace") : t("auth.signInAction", "Sign in to FormCraft")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </form>

            {/* Toggle Footer */}
            <div className="mt-4 pt-3.5 border-t border-border text-center text-xs text-muted-foreground">
              {mode === "login" ? (
                <p>
                  {t("auth.noAccount", "Don't have an account?")}{" "}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode("register")}
                    className="font-medium text-primary hover:underline ml-1 cursor-pointer"
                  >
                    {t("auth.registerLink", "Create an account")}
                  </button>
                </p>
              ) : (
                <p>
                  {t("auth.haveAccount", "Already have an account?")}{" "}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode("login")}
                    className="font-medium text-primary hover:underline ml-1 cursor-pointer"
                  >
                    {t("auth.loginLink", "Sign in instead")}
                  </button>
                </p>
              )}
            </div>
          </div>

          <p className="mt-3 text-center text-[10.5px] text-muted-foreground">
            {t("auth.termsDisclaimer", "By continuing, you agree to FormCraft's Terms of Service and Privacy Policy.")}
          </p>
        </div>
      </div>
    </div>
  );
}
