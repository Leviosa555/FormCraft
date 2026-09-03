import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Send,
  Eye,
  Edit3,
  FileText,
  File as FileIcon,
  Star,
  ShieldCheck,
  AlertCircle,
  Mail,
  KeyRound,
  Lock,
  RefreshCw,
  Sparkles,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  getPublicForm,
  startPublicForm,
  submitPublicForm,
  getPublicSingleUseForm,
  startPublicSingleUseForm,
  submitPublicSingleUseForm,
  sendPublicFormOTP,
  verifyPublicFormOTP,
} from "@/api/forms";
import FieldRenderer from "../components/public/FieldRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useTranslation } from "@/lib/i18n";

export default function PublicForm() {
  const { t } = useTranslation();
  const { shareToken, singleToken } = useParams();
  const navigate = useNavigate();


  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);

  // Step: "form" | "preview"
  const [step, setStep] = useState("form");
  const [expiredError, setExpiredError] = useState(false);
  const [alreadyUsedError, setAlreadyUsedError] = useState(false);
  const [usedAtTime, setUsedAtTime] = useState(null);

  // Email OTP Verification State
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState(null);
  const [verifiedEmail, setVerifiedEmail] = useState(null);
  const [alreadySubmittedError, setAlreadySubmittedError] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const activeToken = singleToken || shareToken;
  const isSingleUse = Boolean(singleToken);

  const isEmpty = (value) =>
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  const ruleMatches = (rule, value) => {
    if (rule.operator === "is_empty") return isEmpty(value);
    if (rule.operator === "equals") return value === rule.comparison_value;
    if (rule.operator === "not_equals") return value !== rule.comparison_value;
    if (rule.operator === "contains")
      return Array.isArray(value)
        ? value.includes(rule.comparison_value)
        : String(value ?? "").includes(rule.comparison_value);
    if (rule.operator === "greater_than")
      return Number(value) > Number(rule.comparison_value);
    return false;
  };

  const fieldState = () => {
    const showRules = (form?.version?.conditional_rules || []).filter(
      (rule) => rule.action === "show"
    );
    const showTargets = new Set(showRules.map((rule) => rule.target_field));

    const result = Object.fromEntries(
      (form?.version?.fields || []).map((field) => [
        field.id,
        {
          visible: !showTargets.has(field.id),
          required: field.required,
        },
      ])
    );

    (form?.version?.conditional_rules || []).forEach((rule) => {
      if (ruleMatches(rule, formData[rule.trigger_field])) {
        if (rule.action === "show") result[rule.target_field].visible = true;
        if (rule.action === "hide") result[rule.target_field].visible = false;
        if (rule.action === "require") result[rule.target_field].required = true;
      }
    });
    return result;
  };

  useEffect(() => {
    const fetchForm = async () => {
      try {
        let data, session;
        if (singleToken) {
          data = await getPublicSingleUseForm(singleToken);
          setForm(data);
          session = await startPublicSingleUseForm(singleToken);
        } else {
          data = await getPublicForm(shareToken);
          setForm(data);
          session = await startPublicForm(shareToken);
        }
        setSessionToken(session.session_token);
      } catch (err) {
        console.error("Failed to load public form:", err);
        const errData = err?.response?.data;
        if (errData?.already_used) {
          setAlreadyUsedError(true);
          setUsedAtTime(errData?.used_at);
        } else if (err?.response?.status === 410 || errData?.expired) {
          setExpiredError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [shareToken, singleToken]);

  const validateForm = () => {
    const newErrors = {};
    const state = fieldState();

    form.version.fields.forEach((field) => {
      const value = formData[field.id];
      const config = field.config || {};
      const isFieldVisible = state[field.id].visible;
      const isFieldRequired = state[field.id].required;

      if (isFieldVisible) {
        const isEmptyValue =
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0);

        if (isFieldRequired && isEmptyValue) {
          newErrors[field.id] = `${field.label} is required.`;
        } else if (!isEmptyValue) {
          // Type-specific validations
          if (field.field_type === "text") {
            const valStr = String(value);
            if (
              config.min_length !== undefined &&
              config.min_length !== "" &&
              valStr.length < Number(config.min_length)
            ) {
              newErrors[field.id] = `Must contain at least ${config.min_length} characters.`;
            }
            if (
              config.max_length !== undefined &&
              config.max_length !== "" &&
              valStr.length > Number(config.max_length)
            ) {
              newErrors[field.id] = `Must contain no more than ${config.max_length} characters.`;
            }
            if (
              config.text_pattern === "alphanumeric" &&
              !/^[a-zA-Z0-9]+$/.test(valStr)
            ) {
              newErrors[field.id] = "Must contain letters and numbers only.";
            }
            if (
              config.text_pattern === "alpha" &&
              !/^[a-zA-Z\s]+$/.test(valStr)
            ) {
              newErrors[field.id] = "Must contain letters only.";
            }
          } else if (field.field_type === "number") {
            const valStr = String(value);
            const numPattern = config.number_pattern || "numeric";

            if (numPattern === "alphanumeric") {
              if (!/^[a-zA-Z0-9]+$/.test(valStr)) {
                newErrors[field.id] = "Must contain alphanumeric characters only.";
              }
            } else if (numPattern === "integer") {
              if (!/^-?\d+$/.test(valStr)) {
                newErrors[field.id] = "Must be a whole integer.";
              }
            } else if (numPattern === "decimal") {
              if (!/^-?\d+(\.\d+)?$/.test(valStr)) {
                newErrors[field.id] = "Must be a valid decimal number.";
              }
            } else if (numPattern === "positive_integer") {
              if (!/^\d+$/.test(valStr) || Number(valStr) < 0) {
                newErrors[field.id] = "Must be a positive integer.";
              }
            } else if (numPattern === "numeric") {
              if (isNaN(Number(valStr))) {
                newErrors[field.id] = "Must be a valid number.";
              }
            }

            if (!newErrors[field.id]) {
              const numVal = Number(value);
              const minLimit = config.min !== undefined && config.min !== "" ? config.min : config.min_value;
              const maxLimit = config.max !== undefined && config.max !== "" ? config.max : config.max_value;

              if (
                minLimit !== undefined &&
                minLimit !== "" &&
                numVal < Number(minLimit)
              ) {
                newErrors[field.id] = `Must be at least ${minLimit}.`;
              }
              if (
                maxLimit !== undefined &&
                maxLimit !== "" &&
                numVal > Number(maxLimit)
              ) {
                newErrors[field.id] = `Must be no more than ${maxLimit}.`;
              }
              if (
                config.min_length !== undefined &&
                config.min_length !== "" &&
                valStr.length < Number(config.min_length)
              ) {
                newErrors[field.id] = `Must contain at least ${config.min_length} digits.`;
              }
              if (
                config.max_length !== undefined &&
                config.max_length !== "" &&
                valStr.length > Number(config.max_length)
              ) {
                newErrors[field.id] = `Must contain no more than ${config.max_length} digits.`;
              }
            }
          } else if (field.field_type === "date") {
            if (config.min_date && value < config.min_date) {
              newErrors[field.id] = `Date cannot be before ${config.min_date}.`;
            }
            if (config.max_date && value > config.max_date) {
              newErrors[field.id] = `Date cannot be after ${config.max_date}.`;
            }
            if (config.disable_past_dates) {
              const selectedDate = new Date(value);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (selectedDate < today) {
                newErrors[field.id] = "Past dates are not allowed.";
              }
            }
            if (config.disable_future_dates) {
              const selectedDate = new Date(value);
              const today = new Date();
              today.setHours(23, 59, 59, 999);
              if (selectedDate > today) {
                newErrors[field.id] = "Future dates are not allowed.";
              }
            }
          } else if (field.field_type === "checkbox") {
            if (Array.isArray(value)) {
              const minSel = config.min_select !== undefined && config.min_select !== "" ? config.min_select : config.min_choices;
              const maxSel = config.max_select !== undefined && config.max_select !== "" ? config.max_select : config.max_choices;

              if (
                minSel !== undefined &&
                minSel !== "" &&
                value.length < Number(minSel)
              ) {
                newErrors[field.id] = `Select at least ${minSel} option${Number(minSel) > 1 ? "s" : ""}.`;
              }
              if (
                maxSel !== undefined &&
                maxSel !== "" &&
                value.length > Number(maxSel)
              ) {
                newErrors[field.id] = `Select no more than ${maxSel} option${Number(maxSel) > 1 ? "s" : ""}.`;
              }
            }
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = otpEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSendingOtp(true);
    setAlreadySubmittedError(null);

    try {
      await sendPublicFormOTP(activeToken, cleanEmail, isSingleUse);
      setOtpSent(true);
      setResendTimer(60);
      toast.success(`Verification code sent to ${cleanEmail}`);
    } catch (err) {
      console.error("Send OTP error:", err);
      const errData = err?.response?.data;
      if (errData?.already_submitted) {
        setAlreadySubmittedError({
          message: errData.error || "This email address has already submitted a response to this form.",
          submittedAt: errData.submitted_at,
        });
      } else {
        toast.error(errData?.error || errData?.email?.[0] || "Failed to send verification code.");
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      toast.error("Please enter the 6-digit verification code.");
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await verifyPublicFormOTP(activeToken, otpEmail.trim().toLowerCase(), cleanCode, isSingleUse);
      if (res.verified) {
        setIsVerified(true);
        setVerificationToken(res.verification_token);
        setVerifiedEmail(res.email);

        // Pre-populate any email fields in the form
        if (form?.version?.fields) {
          const emailField = form.version.fields.find((f) => f.field_type === "email");
          if (emailField && !formData[emailField.id]) {
            setFormData((prev) => ({ ...prev, [emailField.id]: res.email }));
          }
        }

        toast.success("Email verified successfully! You may now fill the form.");
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      const msg = err?.response?.data?.error || "Invalid verification code.";
      toast.error(msg);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleProceedToPreview = (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fill in all required fields correctly before previewing.");
      return;
    }
    setStep("preview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFinalSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      setStep("form");
      toast.error("Please correct the errors in the form.");
      return;
    }

    setSubmitting(true);

    try {
      const state = fieldState();
      const responses = Object.entries(formData)
        .filter(([fieldId, value]) => state[fieldId]?.visible && !(value instanceof File))
        .map(([fieldId, value]) => ({ field: Number(fieldId), value }));
      const hasFiles = Object.values(formData).some((value) => value instanceof File);
      const payload = hasFiles ? new FormData() : { responses, session_token: sessionToken };
      if (hasFiles) {
        payload.append("responses", JSON.stringify(responses));
        if (sessionToken) payload.append("session_token", sessionToken);
        if (verificationToken) payload.append("verification_token", verificationToken);
        if (verifiedEmail) payload.append("respondent_email", verifiedEmail);
        Object.entries(formData).forEach(([fieldId, value]) => {
          if (state[fieldId]?.visible && value instanceof File)
            payload.append(`file_${fieldId}`, value);
        });
      } else {
        if (verificationToken) payload.verification_token = verificationToken;
        if (verifiedEmail) payload.respondent_email = verifiedEmail;
      }

      if (singleToken) {
        await submitPublicSingleUseForm(singleToken, payload);
      } else {
        await submitPublicForm(shareToken, payload);
      }
      toast.success("Form submitted successfully!");
      navigate("/success");
    } catch (error) {
      console.error(error);
      const errData = error?.response?.data;
      if (errData?.already_submitted) {
        setAlreadySubmittedError({
          message: errData.error || "You have already submitted a response to this form.",
          submittedAt: errData.submitted_at,
        });
        toast.error("Duplicate submission blocked: You have already submitted this form.");
      } else if (errData?.already_used) {
        setAlreadyUsedError(true);
        setUsedAtTime(errData?.used_at);
        toast.error("This single-use link has already been submitted.");
      } else if (error?.response?.status === 410 || errData?.expired) {
        setExpiredError(true);
        toast.error("This form has expired and is no longer accepting submissions.");
      } else {
        toast.error(errData?.error || "Failed to submit form.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderPreviewValue = (field, value) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return <span className="text-slate-400 italic text-sm">Not provided</span>;
    }

    switch (field.field_type) {
      case "checkbox":
        return (
          <div className="flex flex-wrap gap-1.5">
            {(Array.isArray(value) ? value : [value]).map((val) => {
              const opt = (field.options || []).find((o) => o.value === val);
              return (
                <span
                  key={val}
                  className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-200/60"
                >
                  {opt?.label || val}
                </span>
              );
            })}
          </div>
        );

      case "dropdown":
      case "radio": {
        const opt = (field.options || []).find((o) => o.value === value);
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 border border-slate-200">
            {opt?.label || String(value)}
          </span>
        );
      }

      case "rating":
        return (
          <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: field.config?.max_rating || 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${i < Number(value) ? "fill-amber-400 text-amber-400" : "text-slate-200"
                  }`}
              />
            ))}
            <span className="ml-2 text-xs font-semibold text-slate-700">
              {value} / {field.config?.max_rating || 5}
            </span>
          </div>
        );

      case "file":
        if (value instanceof File) {
          const sizeMb = (value.size / (1024 * 1024)).toFixed(2);
          return (
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
              <FileIcon className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium truncate max-w-xs">{value.name}</span>
              <span className="text-slate-400 shrink-0">({sizeMb} MB)</span>
            </div>
          );
        }
        return <span className="text-sm font-medium text-slate-800">{String(value)}</span>;

      case "textarea":
        return (
          <div className="whitespace-pre-wrap text-sm text-slate-800 bg-slate-50 rounded-lg p-3 border border-slate-100 leading-relaxed font-sans">
            {String(value)}
          </div>
        );

      case "date": {
        try {
          const dateObj = new Date(value);
          if (!isNaN(dateObj.getTime())) {
            return (
              <span className="text-sm font-medium text-slate-800">
                {dateObj.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            );
          }
        } catch { }
        return <span className="text-sm font-medium text-slate-800">{String(value)}</span>;
      }

      default:
        return <span className="text-sm font-medium text-slate-800">{String(value)}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="text-sm text-slate-500 font-medium">Loading form...</p>
        </div>
      </div>
    );
  }

  if (alreadySubmittedError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200/60">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Already Submitted</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {alreadySubmittedError.message ||
              "You have already submitted a response to this form. Only 1 submission is allowed per respondent."}
          </p>
          {alreadySubmittedError.submittedAt && (
            <p className="mt-3 text-xs text-slate-400 font-mono">
              Completed on: {new Date(alreadySubmittedError.submittedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (alreadyUsedError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4 border border-rose-200/60">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Submission Completed</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            This one-time submission link has already been submitted and cannot accept any further responses.
          </p>
          {usedAtTime && (
            <p className="mt-3 text-xs text-slate-400 font-mono">
              Submitted on {new Date(usedAtTime).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (expiredError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200/60">
            <Clock className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Form Closed</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            This form has expired and is no longer accepting new responses.
          </p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-slate-400 mb-3" />
          <h2 className="text-lg font-semibold text-slate-800">Form Not Found</h2>
          <p className="mt-1 text-sm text-slate-500">
            The link you followed may be invalid or the form has been removed.
          </p>
        </div>
      </div>
    );
  }

  const isSingleMode = Boolean(form.is_single_use || singleToken || form.limit_one_submission_per_email);
  const requiresVerification = true; // Email OTP verification is always required on entry

  // OTP Email Verification Gate
  if (requiresVerification && !isVerified) {
    return (
      <div className="relative min-h-screen bg-slate-50/70 text-slate-900 antialiased flex flex-col justify-center items-center p-4">
        <div className="absolute top-4 right-4">
          <LanguageSelector />
        </div>
        <div className="w-full max-w-md">
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-xs mb-3">
              FC
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {form.title}
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              {isSingleMode
                ? t("publicForm.alreadySubmittedSubtitle", "Please verify your email address to access and submit this one-time form. Only 1 submission is allowed per email.")
                : t("publicForm.emailVerificationSubtitle", "Please verify your email address via 6-digit OTP code to access and submit this form.")}
            </p>
          </div>


          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            {!otpSent ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                    <span>Your Email Address</span>
                    {isSingleMode ? (
                      <span className="text-[11px] font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
                        1 response only
                      </span>
                    ) : (
                      <span className="text-[11px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                        OTP Verified
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      className="pl-9 h-10 text-sm rounded-xl border-slate-200 focus:border-emerald-500"
                      disabled={sendingOtp}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={sendingOtp || !otpEmail.trim()}
                  className="w-full h-10 text-xs font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  {sendingOtp ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Sending Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      <span>Send Verification Code</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-center">
                  <p className="text-xs text-slate-600">
                    We sent a 6-digit code to:{" "}
                    <strong className="text-slate-900 font-semibold">{otpEmail}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                    }}
                    className="text-[11px] text-emerald-600 hover:underline mt-1 font-medium"
                  >
                    Change email
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 text-center block">
                    Enter 6-Digit Verification Code
                  </label>
                  <Input
                    type="text"
                    maxLength={6}
                    autoFocus
                    required
                    placeholder="Code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="h-12 text-center text-xl tracking-[0.35em] font-mono font-bold rounded-xl border-slate-200 focus:border-emerald-500"
                    disabled={verifyingOtp}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={verifyingOtp || otpCode.length < 6}
                  className="w-full h-10 text-xs font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  {verifyingOtp ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Verify & Open Form</span>
                    </>
                  )}
                </Button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    disabled={resendTimer > 0 || sendingOtp}
                    onClick={handleSendOTP}
                    className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${sendingOtp ? "animate-spin" : ""}`} />
                    <span>
                      {resendTimer > 0
                        ? `Resend code in ${resendTimer}s`
                        : "Resend code"}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  const visibleFields = form.version.fields.filter(
    (field) => fieldState()[field.id]?.visible
  );

  const answeredCount = visibleFields.filter(
    (f) => !isEmpty(formData[f.id])
  ).length;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900 pb-16">
      {/* Brand Header Strip */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-[10px] font-bold text-primary-foreground shadow-2xs">
              FC
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              FormCraft
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Stepper Indicator */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/70 p-1 text-xs">
              <button
                type="button"
                onClick={() => setStep("form")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${step === "form"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                <span>1. Fill Form</span>
              </button>
              <button
                type="button"
                onClick={() => handleProceedToPreview()}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${step === "preview"
                  ? "bg-white text-primary shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                <span>2. Review & Verify</span>
              </button>
            </div>
            <LanguageSelector />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        {/* Form Title Header Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {form.is_single_use ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Single-Use Link {form.recipient_label ? `• For ${form.recipient_label}` : "• One-Time Access"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live Form
                  </span>
                )}

                {verifiedEmail && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span>Verified: {verifiedEmail}</span>
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {form.title}
              </h1>
              {form.description && (
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {form.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>
              {answeredCount} of {visibleFields.length} questions answered
            </span>
            <span className="text-[11px] text-slate-400">
              * Indicates required question
            </span>
          </div>
        </div>

        {/* STEP 1: Interactive Form Inputs View */}
        {step === "form" && (
          <form onSubmit={handleProceedToPreview} className="mt-6 space-y-5">
            <div className="space-y-4">
              {visibleFields.map((field, idx) => (
                <div
                  key={field.id}
                  id={`field-container-${field.id}`}
                  className={`rounded-2xl border bg-white p-5 sm:p-6 transition-all shadow-xs ${errors[field.id]
                    ? "border-red-300 ring-2 ring-red-100"
                    : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <label className="text-sm font-semibold text-slate-900">
                      <span className="mr-1.5 text-slate-400 font-mono text-xs">
                        {String(idx + 1).padStart(2, "0")}.
                      </span>
                      {field.label}
                      {fieldState()[field.id]?.required && (
                        <span className="ml-1 text-red-500 font-bold">*</span>
                      )}
                    </label>
                  </div>

                  <FieldRenderer
                    field={field}
                    value={
                      formData[field.id] ??
                      (field.field_type === "checkbox" ? [] : "")
                    }
                    error={errors[field.id]}
                    onChange={(value) => {
                      setFormData((prev) => ({
                        ...prev,
                        [field.id]: value,
                      }));
                      if (errors[field.id]) {
                        setErrors((prev) => ({
                          ...prev,
                          [field.id]: "",
                        }));
                      }
                    }}
                  />

                  {field.help_text && (
                    <p className="mt-2 text-xs text-slate-500">
                      {field.help_text}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4">
              <p className="text-xs text-slate-400">
                You can review all answers on the next screen before submitting.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-sm gap-2 shadow-sm hover:opacity-95"
                >
                  <Eye className="h-4 w-4" />
                  Preview & Verify
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 2: Verification Preview Summary View */}
        {step === "preview" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 space-y-6"
          >
            {/* Verification Notice Banner */}
            <div className="flex items-start gap-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4.5 text-emerald-950 shadow-xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-emerald-900">
                  Verify your details before submission
                </h3>
                <p className="mt-0.5 text-xs text-emerald-800/80 leading-relaxed">
                  Please review your responses below to ensure all information is correct. Click
                  &quot;Edit&quot; on any item if you need to make changes.
                </p>
              </div>
            </div>

            {/* Review Cards List */}
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {visibleFields.map((field, idx) => {
                const val = formData[field.id];
                const hasValue = !isEmpty(val);

                return (
                  <div
                    key={field.id}
                    className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-5 sm:p-6 transition-colors hover:bg-slate-50/60"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">
                          {String(idx + 1).padStart(2, "0")}.
                        </span>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {field.label}
                          {fieldState()[field.id]?.required && (
                            <span className="ml-1 text-red-500 font-bold">*</span>
                          )}
                        </p>
                      </div>

                      <div className="pt-1">
                        {renderPreviewValue(field, val)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setStep("form");
                        setTimeout(() => {
                          const el = document.getElementById(`field-container-${field.id}`);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }, 100);
                      }}
                      className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs shrink-0"
                    >
                      <Edit3 className="h-3 w-3 text-slate-400" />
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Final Action Bar */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("form")}
                className="h-11 px-5 rounded-xl border-slate-200 text-slate-700 text-sm font-medium gap-2 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Edit
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  className="w-full sm:w-auto h-11 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold gap-2 shadow-sm transition-all hover:shadow-md hover:shadow-emerald-600/20"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Submitting Response...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm & Submit Form
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
