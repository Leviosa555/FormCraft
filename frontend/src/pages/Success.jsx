import { Link } from "react-router-dom";
import { CheckCircle2, Mail, ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Success() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/80 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-sm animate-in fade-in zoom-in duration-300">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 shadow-2xs">
          <CheckCircle2 className="h-9 w-9" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Submission Successful!
        </h1>

        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Thank you for completing the form. Your response has been securely recorded.
        </p>

        {/* Confirmation Email Notice Box */}
        <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-left shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-950">
                Confirmation Email Sent
              </p>
              <p className="text-[11.5px] text-emerald-800/90 mt-0.5 leading-snug">
                A copy of your submission receipt and answers has been dispatched to your verified email address.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col gap-2">
          <Button asChild variant="outline" className="w-full text-xs font-medium h-10 border-slate-200 hover:bg-slate-50">
            <Link to="/" className="inline-flex items-center justify-center gap-1.5">
              <Home className="h-3.5 w-3.5" />
              <span>Return to FormCraft</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
