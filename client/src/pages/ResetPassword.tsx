import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Password reset successfully! Please sign in with your new password.");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reset password.");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Reset token is missing.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error("Password must contain at least one letter and one number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    resetMutation.mutate({ token, newPassword });
  };

  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 shadow-xl sm:p-10">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <span className="grid size-9 place-items-center rounded-xl bg-ink text-paper shadow-[3px_3px_0_0_#ff6b4a]">
              <Sparkles className="size-4" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight">
              kudos<span className="text-coral">.</span>
            </span>
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight">Create new password</h1>
          <p className="mt-1.5 text-xs text-ink/50">
            Set a new secure password for your Kudos Wall account.
          </p>
        </div>

        {!token ? (
          <div className="text-center py-4">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-coral/15 text-coral mb-3">
              <AlertCircle className="size-6" />
            </div>
            <p className="text-sm font-semibold">Missing reset token</p>
            <p className="mt-1 text-xs text-ink/55">
              Please click the link generated in <code className="bg-paper px-1.5 py-0.5 rounded text-xs font-mono text-coral">docs/dev-emails.log</code>.
            </p>
            <Button asChild className="mt-6 w-full rounded-xl bg-ink text-paper hover:bg-ink/90">
              <Link href="/auth">Go to Sign in</Link>
            </Button>
          </div>
        ) : submitted ? (
          <div className="text-center py-4">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-mint text-ink mb-3">
              <CheckCircle2 className="size-6" />
            </div>
            <p className="text-sm font-bold">Password updated!</p>
            <p className="mt-1 text-xs text-ink/55">
              Your password has been changed and all previous sessions were revoked.
            </p>
            <Button
              onClick={() => navigate("/auth")}
              className="mt-6 w-full rounded-xl bg-ink text-paper hover:bg-ink/90"
            >
              Sign in now
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-pw" className="mb-2 block text-xs font-bold text-ink/60">
                New password
              </label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  className="h-11 rounded-xl border-ink/15 bg-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-ink/40">Include letters and numbers.</p>
            </div>

            <div>
              <label htmlFor="confirm-pw" className="mb-2 block text-xs font-bold text-ink/60">
                Confirm new password
              </label>
              <Input
                id="confirm-pw"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
                minLength={8}
                className="h-11 rounded-xl border-ink/15 bg-white"
              />
            </div>

            <Button
              type="submit"
              disabled={resetMutation.isPending}
              className="mt-2 h-11 w-full gap-2 rounded-xl bg-ink text-paper hover:bg-ink/90"
            >
              {resetMutation.isPending ? (
                <Loader2 className="animate-spin size-4" />
              ) : (
                <KeyRound className="size-4" />
              )}
              {resetMutation.isPending ? "Updating password..." : "Set new password"}
            </Button>

            <div className="text-center pt-2">
              <Link href="/auth" className="text-xs font-semibold text-ink/45 hover:text-ink">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
