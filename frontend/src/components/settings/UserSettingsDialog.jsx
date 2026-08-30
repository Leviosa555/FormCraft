import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  KeyRound,
  Mail,
  Settings,
  Trash2,
  User,
  AlertTriangle,
  Check,
} from "lucide-react";

import { changePassword, deleteAccount, logout, updateProfile } from "@/api/auth";

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
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";

export default function UserSettingsDialog({ user, onUpdated }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "security" | "danger"


  // Profile Form
  const [profileForm, setProfileForm] = useState({
    username: "",
    email: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Delete State
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username || "",
        email: user.email || "",
      });
    }
  }, [user, open]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.username.trim()) {
      toast.error("Username cannot be empty.");
      return;
    }
    if (!profileForm.email.trim()) {
      toast.error("Email cannot be empty.");
      return;
    }

    try {
      setProfileLoading(true);
      const res = await updateProfile({
        username: profileForm.username.trim(),
        email: profileForm.email.trim(),
      });
      toast.success(res.data.message || "Profile updated successfully.");
      if (onUpdated) onUpdated();
    } catch (err) {
      const data = err?.response?.data;
      if (data?.username) {
        toast.error(Array.isArray(data.username) ? data.username[0] : String(data.username));
      } else if (data?.email) {
        toast.error(Array.isArray(data.email) ? data.email[0] : String(data.email));
      } else {
        toast.error(data?.detail || "Failed to update profile.");
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.current_password) {
      toast.error("Current password is required.");
      return;
    }
    if (!passwordForm.new_password) {
      toast.error("New password is required.");
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New passwords do not match.");
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success(res.data.message || "Password changed successfully.");
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      const data = err?.response?.data;
      if (data?.current_password) {
        toast.error(Array.isArray(data.current_password) ? data.current_password[0] : String(data.current_password));
      } else if (data?.new_password) {
        toast.error(Array.isArray(data.new_password) ? data.new_password[0] : String(data.new_password));
      } else {
        toast.error(data?.detail || "Failed to change password.");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    try {
      setDeleteLoading(true);
      await deleteAccount();
      logout();
      toast.success("Your account has been deleted permanently.");
      navigate("/login");
    } catch (err) {

      toast.error("Failed to delete account. Please try again.");
      setDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5 text-xs text-slate-700">
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            {t("dashboard.settings", "Settings")}
          </Button>
        }
      />

      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            {t("dashboard.userSettings", "Account Settings")}
          </DialogTitle>

          <DialogDescription className="text-xs">
            Manage your credentials, password, and account settings.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/60 px-6 pt-2 gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => { setActiveTab("profile"); setDeleteConfirm(false); }}
            className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "profile"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Profile Details
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("security"); setDeleteConfirm(false); }}
            className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "security"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Password
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("danger"); setDeleteConfirm(false); }}
            className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "danger"
                ? "border-red-600 text-red-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-red-600"
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Danger Zone
          </button>
        </div>

        <div className="p-6 pt-4">
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="settings-username" className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Username
                </Label>
                <Input
                  id="settings-username"
                  name="username"
                  value={profileForm.username}
                  onChange={handleProfileChange}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settings-email" className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  Email Address
                </Label>
                <Input
                  id="settings-email"
                  name="email"
                  type="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" size="sm" className="text-xs" disabled={profileLoading}>
                  {profileLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password" className="text-xs font-medium text-slate-700">
                  Current Password
                </Label>
                <Input
                  id="current-password"
                  name="current_password"
                  type="password"
                  placeholder="Enter current password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-medium text-slate-700">
                  New Password
                </Label>
                <Input
                  id="new-password"
                  name="new_password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-medium text-slate-700">
                  Confirm New Password
                </Label>
                <Input
                  id="confirm-password"
                  name="confirm_password"
                  type="password"
                  placeholder="Repeat new password"
                  value={passwordForm.confirm_password}
                  onChange={handlePasswordChange}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" size="sm" className="text-xs" disabled={passwordLoading}>
                  {passwordLoading ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          )}

          {/* DANGER ZONE TAB */}
          {activeTab === "danger" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-800 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-red-900">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  Permanent Account Deletion
                </div>
                <p className="text-[11px] leading-relaxed text-red-700">
                  Deleting your account will permanently wipe all your forms, conditional rules, version histories, and collected response data. This action cannot be undone.
                </p>
              </div>

              {deleteConfirm && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 font-medium text-center">
                  ⚠️ Are you completely sure? Click confirm below to finalize deletion.
                </div>
              )}

              <div className="pt-2 flex gap-2 justify-end">
                {deleteConfirm && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setDeleteConfirm(false)}
                    disabled={deleteLoading}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleteLoading
                    ? "Deleting..."
                    : deleteConfirm
                    ? "Confirm Delete My Account"
                    : "Delete Account"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
