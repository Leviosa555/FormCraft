import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Share2,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Download,
  Sparkles,
  Lock,
  Plus,
  Trash2,
  Globe,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import {
  getOneTimeLinks,
  createOneTimeLinks,
  deleteOneTimeLink,
} from "@/api/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";

export default function ShareFormDialog({ form, shareToken, trigger }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("public"); // "public" | "onetime"

  const [copied, setCopied] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const qrRef = useRef(null);

  // One-time tokens state
  const [oneTimeLinks, setOneTimeLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCount, setNewCount] = useState(1);
  const [creatingLink, setCreatingLink] = useState(false);
  const [selectedSingleQR, setSelectedSingleQR] = useState(null);

  const token = shareToken || form?.active_version?.share_token || form?.share_token;
  const formUrl = token ? `${window.location.origin}/forms/${token}` : "";
  const formId = form?.id;

  const loadOneTimeLinks = async () => {
    if (!formId) return;
    setLoadingLinks(true);
    try {
      const data = await getOneTimeLinks(formId);
      setOneTimeLinks(data || []);
    } catch {
      // Ignored if not published
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => {
    if (open && activeTab === "onetime" && formId) {
      loadOneTimeLinks();
    }
  }, [open, activeTab, formId]);

  const handleCopyLink = async (url, tokenId = null) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      if (tokenId) {
        setCopiedToken(tokenId);
        setTimeout(() => setCopiedToken(null), 2500);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Unable to copy link to clipboard.");
    }
  };

  const handleDownloadQR = (elementId = null, title = null) => {
    let canvas;
    if (elementId) {
      canvas = document.getElementById(elementId)?.querySelector("canvas");
    } else if (qrRef.current) {
      canvas = qrRef.current.querySelector("canvas");
    }
    if (!canvas) return;

    const image = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const safeTitle = (title || form?.title || "form")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    link.href = image;
    link.download = `${safeTitle}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("QR code downloaded as PNG!");
  };

  const handleCreateOneTimeLink = async (e) => {
    e.preventDefault();
    if (!formId) return;
    setCreatingLink(true);
    try {
      await createOneTimeLinks(formId, {
        label: newLabel.trim() || undefined,
        count: Number(newCount) || 1,
      });
      toast.success(
        newCount > 1
          ? `${newCount} one-time links generated!`
          : "One-time submission link generated!"
      );
      setNewLabel("");
      setNewCount(1);
      loadOneTimeLinks();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create single-use link.");
    } finally {
      setCreatingLink(false);
    }
  };

  const handleDeleteToken = async (tokenUuid) => {
    if (!formId) return;
    try {
      await deleteOneTimeLink(formId, tokenUuid);
      toast.success("Link deleted.");
      setOneTimeLinks((prev) => prev.filter((item) => item.token !== tokenUuid));
    } catch {
      toast.error("Failed to delete link.");
    }
  };

  if (!token && !formId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs font-medium border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs"
          >
            <QrCode className="h-3.5 w-3.5 text-primary" />
            <span>{t("dashboard.shareAndQR", "Share & QR")}</span>
          </Button>

        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900">
                Share Form & QR Code
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Distribute your live form via standard link or single-use tokens.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Selection */}
        <div className="mt-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100/70 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("public")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all ${
              activeTab === "public"
                ? "bg-white text-emerald-700 shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Public Link & QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("onetime")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all ${
              activeTab === "onetime"
                ? "bg-white text-amber-700 shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>One-Time Links</span>
          </button>
        </div>

        {/* TAB 1: Standard Public Share Link & QR */}
        {activeTab === "public" && (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Public Form URL
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    value={formUrl}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 font-mono select-all focus:outline-none focus:border-primary"
                  />
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyLink(formUrl)}
                  className="h-9 px-3 text-xs gap-1.5 shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(formUrl, "_blank")}
                  title="Open in new tab"
                  className="h-9 w-9 p-0 text-slate-500 hover:text-slate-900"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* QR Code Presentation Box */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/70 p-5 text-center shadow-2xs">
              <div
                ref={qrRef}
                className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm"
              >
                <QRCodeCanvas
                  value={formUrl}
                  size={160}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="mt-3 space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                  <Sparkles className="h-3 w-3" />
                  <span>Instant Mobile Access</span>
                </div>
                <p className="text-xs text-slate-500 max-w-xs">
                  Scan with your mobile camera to open and submit this form directly.
                </p>
              </div>

              <div className="mt-3.5 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleDownloadQR()}
                  className="h-8 px-3 text-xs font-medium gap-1.5 bg-primary text-primary-foreground shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download QR (PNG)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyLink(formUrl)}
                  className="h-8 px-3 text-xs gap-1.5 bg-white border-slate-200 text-slate-700"
                >
                  <Copy className="h-3 w-3" />
                  Copy Link
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: One-Time Single-Use Links */}
        {activeTab === "onetime" && (
          <div className="mt-4 space-y-4">
            {/* Generate Single-Use Link Bar */}
            <form
              onSubmit={handleCreateOneTimeLink}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 shadow-2xs"
            >
              <Input
                type="text"
                placeholder="Recipient name / note (e.g. John Doe)..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="h-8 text-xs bg-white border-slate-200 flex-1"
                disabled={creatingLink}
              />
              <Button
                type="submit"
                size="sm"
                disabled={creatingLink}
                className="h-8 px-3 text-xs font-medium gap-1 bg-amber-600 hover:bg-amber-700 text-white shadow-2xs shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{creatingLink ? "Generating..." : "Generate Link"}</span>
              </Button>
            </form>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
              <span>{oneTimeLinks.length} single-use link(s) created</span>
              <span>🔒 Automatically locks after 1 submission</span>
            </div>

            {/* Links List / Table */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5">
              {loadingLinks ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading single-use links...
                </div>
              ) : oneTimeLinks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  No single-use links generated yet. Click &quot;Generate Link&quot; above to create one.
                </div>
              ) : (
                oneTimeLinks.map((item) => {
                  const isUsed = item.is_used;
                  const itemUrl = `${window.location.origin}/forms/single/${item.token}`;

                  return (
                    <div
                      key={item.token}
                      className={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 transition-colors ${
                        isUsed
                          ? "border-slate-200/80 bg-slate-50/50 opacity-75"
                          : "border-slate-200 bg-white shadow-2xs hover:border-slate-300"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[9.5px] font-semibold ${
                              isUsed
                                ? "bg-slate-100 text-slate-600"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isUsed ? "bg-slate-400" : "bg-emerald-500"
                              }`}
                            />
                            {isUsed ? "Submitted / Used" : "Unused & Ready"}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {item.label || "Single-Use Link"}
                          </span>
                        </div>

                        <p className="mt-0.5 text-[10.5px] font-mono text-slate-400 truncate">
                          /forms/single/{item.token.slice(0, 13)}...
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!isUsed && (
                          <>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => setSelectedSingleQR(item)}
                              title="Show QR Code"
                              className="h-7 w-7 p-0 text-slate-600 border-slate-200"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => handleCopyLink(itemUrl, item.token)}
                              className="h-7 px-2 text-[11px] gap-1 border-slate-200"
                            >
                              {copiedToken === item.token ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  <span className="text-emerald-700">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 text-slate-500" />
                                  <span>Copy</span>
                                </>
                              )}
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => handleDeleteToken(item.token)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Single Link QR Modal Overlay if selected */}
            {selectedSingleQR && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-center">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-amber-900">
                    QR Code for: {selectedSingleQR.label || "Single-Use Link"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSingleQR(null)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    ✕ Close
                  </button>
                </div>
                <div
                  id={`single-qr-${selectedSingleQR.token}`}
                  className="inline-block rounded-lg border border-slate-200 bg-white p-3 shadow-xs"
                >
                  <QRCodeCanvas
                    value={`${window.location.origin}/forms/single/${selectedSingleQR.token}`}
                    size={140}
                    level="H"
                  />
                </div>
                <div className="mt-2.5 flex justify-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    onClick={() =>
                      handleDownloadQR(
                        `single-qr-${selectedSingleQR.token}`,
                        selectedSingleQR.label
                      )
                    }
                    className="h-7 text-xs gap-1 bg-amber-600 text-white"
                  >
                    <Download className="h-3 w-3" />
                    Download PNG
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
