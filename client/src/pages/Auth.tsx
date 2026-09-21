import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storeAccessToken } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Check, Eye, EyeOff, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

const departments = ["Engineering", "Design", "Marketing", "Sales"] as const;

type Mode = "signin" | "signup" | "forgot";

function GoogleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function Auth() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState<(typeof departments)[number]>("Engineering");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const signin = trpc.auth.signin.useMutation();
  const signup = trpc.auth.signup.useMutation();
  const forgotPassword = trpc.auth.forgotPassword.useMutation();
  const mutation = mode === "signin" ? signin : mode === "signup" ? signup : forgotPassword;

  // Handle URL errors from OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      if (error === "google_not_configured") {
        toast.error("Google OAuth is not configured yet. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.");
      } else if (error === "access_denied") {
        toast.error("Google sign-in was cancelled.");
      } else if (error === "invalid_oauth_state") {
        toast.error("Security verification failed. Please try signing in again.");
      } else {
        toast.error(`Authentication error (${error}). Please try again.`);
      }
      // Clean up error query param from URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const utils = trpc.useUtils();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "forgot") {
      try {
        await forgotPassword.mutateAsync({ email });
        setForgotSent(true);
        toast.success("Password reset simulated! Check docs/dev-emails.log or terminal.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to request reset link.");
      }
      return;
    }

    try {
      const result = mode === "signin"
        ? await signin.mutateAsync({ email, password })
        : await signup.mutateAsync({ name, email, password, department });
      storeAccessToken(result.accessToken);
      utils.auth.me.setData(undefined, result.user);
      void utils.kudos.invalidate();
      void utils.leaderboard.invalidate();
      void utils.profile.invalidate();
      if (mode === "signup") {
        toast.success("Account created! Verification email simulated in docs/dev-emails.log");
      } else {
        toast.success("Welcome back to Kudos Wall.");
      }
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setForgotSent(false);
    signin.reset();
    signup.reset();
    forgotPassword.reset();
  };

  const handleGoogleSignIn = () => {
    window.location.href = "/api/oauth/google";
  };

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden overflow-hidden bg-ink p-10 text-paper lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-20 size-80 rounded-full border-[40px] border-coral/70" />
          <div className="absolute -bottom-28 -left-24 size-96 rounded-full border-[46px] border-lilac/25" />
          <Link href="/" className="relative flex items-center gap-3 text-paper">
            <span className="grid size-10 place-items-center rounded-xl bg-paper text-ink shadow-[3px_3px_0_0_#ff6b4a]"><Sparkles className="size-5" /></span>
            <span className="font-display text-xl font-bold tracking-tight">kudos<span className="text-coral">.</span></span>
          </Link>
          <div className="relative max-w-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-coral">A little recognition goes a long way</p>
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight">Make the good work visible.</h1>
            <p className="mt-5 text-sm leading-7 text-paper/60">Celebrate the moments that move your team forward. Every thoughtful note adds to the culture you are building together.</p>
            <div className="mt-8 flex items-center gap-3 text-xs font-semibold text-paper/70">
              <span className="grid size-8 place-items-center rounded-full bg-mint text-ink"><Check className="size-4" /></span>
              Google OAuth 2.0 & secure JWT sessions
            </div>
          </div>
          <p className="relative text-xs text-paper/35">Northstar workspace · Team recognition</p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 md:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link href="/" className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-ink text-paper shadow-[3px_3px_0_0_#ff6b4a]"><Sparkles className="size-4" /></span>
                <span className="font-display text-lg font-bold">kudos<span className="text-coral">.</span></span>
              </Link>
              <Link href="/" className="text-xs font-bold text-ink/50"><ArrowLeft className="mr-1 inline size-3" />Back to wall</Link>
            </div>
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-coral">Workspace access</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">
                {mode === "signin"
                  ? "Welcome back."
                  : mode === "signup"
                    ? "Join the culture loop."
                    : "Reset your password."}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/50">
                {mode === "signin"
                  ? "Sign in to give kudos, celebrate teammates, and see your recognition story."
                  : mode === "signup"
                    ? "Create your teammate profile and start recognizing the work that matters."
                    : "Enter your work email address to receive a simulated password reset link."}
              </p>
            </div>

            {mode !== "forgot" && (
              <>
                {/* Google OAuth 2.0 Button */}
                <div className="mb-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleSignIn}
                    className="h-12 w-full gap-3 rounded-xl border-ink/15 bg-white text-sm font-bold text-ink shadow-sm transition hover:bg-ink/5 hover:border-ink/25"
                  >
                    <GoogleIcon className="size-5" />
                    Continue with Google
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-ink/10" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-paper px-3 text-[11px] font-semibold text-ink/40">
                        or continue with work email
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-2 rounded-xl bg-ink/5 p-1">
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className={`rounded-lg px-4 py-2.5 text-xs font-bold transition ${mode === "signin" ? "bg-white text-ink shadow-sm" : "text-ink/45"}`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className={`rounded-lg px-4 py-2.5 text-xs font-bold transition ${mode === "signup" ? "bg-white text-ink shadow-sm" : "text-ink/45"}`}
                  >
                    Create account
                  </button>
                </div>
              </>
            )}

            {mode === "forgot" && forgotSent ? (
              <div className="rounded-2xl border border-ink/10 bg-white p-6 text-center space-y-4 shadow-sm">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-mint text-ink">
                  <Check className="size-6" />
                </div>
                <h3 className="font-display text-xl font-bold">Reset link generated</h3>
                <p className="text-xs text-ink/60 leading-5">
                  A simulated password reset link was dispatched. You can find and click the link in{" "}
                  <code className="bg-paper px-1.5 py-0.5 rounded text-xs font-mono text-coral">docs/dev-emails.log</code> or your server terminal console.
                </p>
                <Button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="w-full rounded-xl bg-ink text-paper hover:bg-ink/90"
                >
                  Back to Sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label htmlFor="name" className="mb-2 block text-xs font-bold text-ink/60">
                      Full name
                    </label>
                    <Input
                      id="name"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      required
                      className="h-12 rounded-xl border-ink/15 bg-white"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="mb-2 block text-xs font-bold text-ink/60">
                    Work email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    required
                    className="h-12 rounded-xl border-ink/15 bg-white"
                  />
                </div>
                {mode !== "forgot" && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="password" className="text-xs font-bold text-ink/60">
                        Password
                      </label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-xs font-semibold text-coral hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                        required
                        minLength={8}
                        className="h-12 rounded-xl border-ink/15 bg-white pr-11"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {mode === "signup" && (
                      <p className="mt-2 text-[11px] text-ink/40">
                        Use at least 8 characters with one letter and one number.
                      </p>
                    )}
                  </div>
                )}
                {mode === "signup" && (
                  <div>
                    <label htmlFor="department" className="mb-2 block text-xs font-bold text-ink/60">
                      Department
                    </label>
                    <select
                      id="department"
                      value={department}
                      onChange={(event) => setDepartment(event.target.value as (typeof departments)[number])}
                      className="h-12 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
                    >
                      {departments.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  aria-busy={mutation.isPending}
                  className="mt-2 h-12 w-full rounded-xl bg-ink text-paper hover:bg-ink/90"
                >
                  {mutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <LockKeyhole className="size-4" />
                  )}
                  {mutation.isPending
                    ? mode === "signin"
                      ? "Signing in..."
                      : mode === "signup"
                        ? "Creating account..."
                        : "Sending reset link..."
                    : mode === "signin"
                      ? "Sign in securely"
                      : mode === "signup"
                        ? "Create my account"
                        : "Send reset link"}
                </Button>
                {mode === "forgot" && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => switchMode("signin")}
                      className="text-xs font-semibold text-ink/50 hover:text-ink hover:underline"
                    >
                      Cancel and back to sign in
                    </button>
                  </div>
                )}
                <p aria-live="polite" className="min-h-4 text-center text-[11px] text-ink/45">
                  {mutation.isPending
                    ? mode === "signin"
                      ? "Checking your workspace credentials..."
                      : mode === "signup"
                        ? "Securing your new account..."
                        : "Generating simulation reset link..."
                    : ""}
                </p>
              </form>
            )}
            <p className="mt-6 text-center text-xs text-ink/40">By continuing, you agree to use Kudos Wall for internal team recognition.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
