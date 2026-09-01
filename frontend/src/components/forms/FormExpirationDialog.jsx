import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Clock, Calendar, AlertCircle, Check, X, Timer } from "lucide-react";

import { setFormExpiration } from "@/api/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function FormExpirationDialog({ form, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const [targetDateObj, setTargetDateObj] = useState(null);

  const toLocalDatetimeString = (d) => {
    if (!d || isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  useEffect(() => {
    if (form?.expires_at) {
      const d = new Date(form.expires_at);
      setTargetDateObj(d);
      setExpiryDate(toLocalDatetimeString(d));
    } else {
      setTargetDateObj(null);
      setExpiryDate("");
    }
  }, [form?.expires_at, open]);

  const setPreset = (hours) => {
    toast.dismiss();
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    setTargetDateObj(target);
    setExpiryDate(toLocalDatetimeString(target));
  };

  const parseLocalDateTime = (str) => {
    if (!str) return null;
    const [datePart, timePart] = str.split("T");
    if (!datePart || !timePart) return new Date(str);
    const [y, m, d] = datePart.split("-").map(Number);
    const [h, min] = timePart.split(":").map(Number);
    return new Date(y, m - 1, d, h, min, 0);
  };

  const handleCustomChange = (e) => {
    const val = e.target.value;
    setExpiryDate(val);
    setTargetDateObj(parseLocalDateTime(val));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    const selectedTime = targetDateObj || parseLocalDateTime(expiryDate);
    if (!selectedTime || isNaN(selectedTime.getTime())) {
      toast.error("Please pick an expiration date/time or select a quick preset.");
      return;
    }

    // 30s grace buffer to prevent false negatives from UI latency
    if (selectedTime.getTime() < (Date.now() - 30000)) {
      toast.error("Expiration time must be set in the future.");
      return;
    }

    try {
      setLoading(true);
      const updated = await setFormExpiration(form.id, {
        expires_at: selectedTime.toISOString(),
      });
      toast.success("Auto-expiration limit scheduled successfully.");
      setOpen(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.expires_at?.[0] || "Failed to update form expiration.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      setLoading(true);
      const updated = await setFormExpiration(form.id, {
        expires_at: null,
      });
      setExpiryDate("");
      toast.success("Auto-expiration cleared. Form will remain open indefinitely.");
      setOpen(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear expiration.");
    } finally {
      setLoading(false);
    }
  };

  const isArchived = form?.status === "archived";
  const hasExpiration = Boolean(form?.expires_at);
  const isExpired = hasExpiration && new Date(form.expires_at) <= new Date();
  const isAutoExpireActive = !isArchived && hasExpiration && !isExpired;

  const userTimeZone = typeof Intl !== "undefined" && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Local";

  const formatExpiryDisplay = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return `${d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })} (${userTimeZone})`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={isAutoExpireActive ? "default" : "outline"}
            size="sm"
            className={`h-9 text-xs gap-1.5 ${
              isAutoExpireActive
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "text-slate-700 border-slate-200"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {isAutoExpireActive ? "Auto-Expire Active" : "Auto-Expire"}
          </Button>
        }
      />

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Timer className="h-4 w-4 text-amber-600" />
            Form Auto-Expiration Limit
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Set a time limit after which this published form automatically closes and transitions to the <strong>Archived</strong> stage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Expiry Status Banner */}
          {isArchived ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <span>Form is currently Archived. Auto-expiration is turned off.</span>
            </div>
          ) : isAutoExpireActive ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-amber-950">
                  Auto-Expiration Active
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Will automatically archive on {formatExpiryDisplay(form.expires_at)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-amber-800 hover:text-amber-950 hover:bg-amber-100"
                onClick={handleClear}
                disabled={loading}
              >
                Turn Off
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <span>Auto-expiration is currently off. Form accepts responses indefinitely when published.</span>
            </div>
          )}

          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">Quick Time Limit Presets</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="text-xs h-7.5 border-slate-200 hover:border-slate-300"
                onClick={() => setPreset(1)}
              >
                In 1 Hour
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="text-xs h-7.5 border-slate-200 hover:border-slate-300"
                onClick={() => setPreset(24)}
              >
                In 24 Hours
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="text-xs h-7.5 border-slate-200 hover:border-slate-300"
                onClick={() => setPreset(72)}
              >
                In 3 Days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="text-xs h-7.5 border-slate-200 hover:border-slate-300"
                onClick={() => setPreset(168)}
              >
                In 7 Days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="text-xs h-7.5 border-slate-200 hover:border-slate-300"
                onClick={() => setPreset(720)}
              >
                In 30 Days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="text-xs h-7.5 border-slate-200 hover:border-slate-300"
                onClick={() => setPreset(2160)}
              >
                In 90 Days
              </Button>
            </div>
          </div>

          {/* Custom Date Time Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="custom-expiry" className="text-xs font-medium text-slate-700">
                Or Custom Expiration Date & Time
              </Label>
              <span className="text-[10.5px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {userTimeZone}
              </span>
            </div>
            <Input
              id="custom-expiry"
              type="datetime-local"
              value={expiryDate}
              onChange={handleCustomChange}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {hasExpiration && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 mr-auto"
              onClick={handleClear}
              disabled={loading}
            >
              Remove Expiry
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="text-xs"
            onClick={handleSave}
            disabled={loading || !expiryDate}
          >
            {loading ? "Saving..." : "Set Expiration Limit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
