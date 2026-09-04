import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function checkIsStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true ||
    (typeof document !== "undefined" && document.referrer && document.referrer.startsWith("android-app://"))
  );
}

export function useIsStandalone() {
  const [isStandalone, setIsStandalone] = useState(() => checkIsStandalone());

  useEffect(() => {
    const update = () => setIsStandalone(checkIsStandalone());
    update();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", update);
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(update);
    }

    const onAppInstalled = () => {
      setIsStandalone(true);
    };

    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", update);
      } else if (mediaQuery?.removeListener) {
        mediaQuery.removeListener(update);
      }
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  return isStandalone;
}

export function triggerPWAInstall() {
  window.dispatchEvent(new CustomEvent("trigger-pwa-install"));
}

export default function InstallPWA({ variant = "banner" }) {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const isStandalone = useIsStandalone();
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIosDevice);

    if (window.deferredInstallPrompt) {
      setDeferredPrompt(window.deferredInstallPrompt);
    }

    const handler = (e) => {
      e.preventDefault();
      window.deferredInstallPrompt = e;
      setDeferredPrompt(e);
    };

    const onPromptReady = () => {
      if (window.deferredInstallPrompt) {
        setDeferredPrompt(window.deferredInstallPrompt);
      }
    };

    const onTriggerGlobal = () => {
      handleInstallClick();
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("pwa-prompt-ready", onPromptReady);
    window.addEventListener("trigger-pwa-install", onTriggerGlobal);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("pwa-prompt-ready", onPromptReady);
      window.removeEventListener("trigger-pwa-install", onTriggerGlobal);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    const promptObj = deferredPrompt || window.deferredInstallPrompt;

    if (promptObj) {
      try {
        await promptObj.prompt();
        const { outcome } = await promptObj.userChoice;
        if (outcome === "accepted") {
          setDismissed(true);
        }
        setDeferredPrompt(null);
        window.deferredInstallPrompt = null;
      } catch (err) {
        console.error("Installation prompt error:", err);
        setShowManualGuide(true);
      }
    } else {
      setShowManualGuide(true);
    }
  };

  // If already running as an installed PWA, don't show
  if (isStandalone) return null;

  return (
    <>
      {/* Floating PWA Banner (only when variant === "banner" and not dismissed) */}
      {variant === "banner" && !dismissed && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs font-semibold text-xs">
              FC
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-slate-900">
                {t("pwa.installTitle", "Install FormCraft App")}
              </h4>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">
                {isIOS
                  ? "Add FormCraft to your iPhone home screen for fullscreen access."
                  : t("pwa.installDesc", "Add FormCraft to your home screen for fast access and offline support.")}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="xs"
                  onClick={handleInstallClick}
                  className="gap-1.5 h-7 px-3 text-xs bg-primary text-primary-foreground font-medium shadow-xs"
                >
                  <Download className="h-3 w-3" />
                  <span>{isIOS ? "How to Install" : t("pwa.installNow", "Install Now")}</span>
                </Button>
                <button
                  onClick={() => setDismissed(true)}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 transition-colors"
                >
                  {t("pwa.later", "Maybe later")}
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-400 hover:text-slate-600 p-1 -mt-1 -mr-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Global Manual Guide Modal (always rendered at root level when active) */}
      {showManualGuide && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-primary">
                  <Smartphone className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Install FormCraft App
                </h3>
              </div>
              <button
                onClick={() => setShowManualGuide(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-slate-600">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">1</span>
                    <p>Tap the <strong>Share</strong> icon <Share className="inline h-3.5 w-3.5 text-blue-600 align-text-bottom mx-1" /> at the bottom of Safari.</p>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">2</span>
                    <p>Scroll down and tap <strong>"Add to Home Screen"</strong>.</p>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">3</span>
                    <p>Tap <strong>"Add"</strong> in the top right to install!</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">1</span>
                    <p>Tap the <strong>3 dots menu</strong> <MoreVertical className="inline h-3.5 w-3.5 text-slate-700 align-text-bottom mx-0.5" /> in the top right of Chrome.</p>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">2</span>
                    <p>Select <strong>"Install app"</strong> (or <strong>"Add to Home screen"</strong>).</p>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">3</span>
                    <p>Confirm <strong>"Install"</strong> to add FormCraft to your App Drawer!</p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5">
              <Button
                className="w-full h-8.5 text-xs font-medium bg-primary text-primary-foreground shadow-xs"
                onClick={() => setShowManualGuide(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
