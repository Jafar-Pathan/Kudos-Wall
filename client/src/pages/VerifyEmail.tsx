import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, Sparkles, ArrowRight } from "lucide-react";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const verifyMutation = trpc.auth.verifyEmail.useMutation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    setToken(urlToken);

    if (urlToken) {
      verifyMutation.mutate({ token: urlToken });
    }
  }, []);

  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 shadow-xl text-center sm:p-10">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <span className="grid size-9 place-items-center rounded-xl bg-ink text-paper shadow-[3px_3px_0_0_#ff6b4a]">
            <Sparkles className="size-4" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            kudos<span className="text-coral">.</span>
          </span>
        </Link>

        {!token ? (
          <div>
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-coral/15 text-coral mb-4">
              <AlertCircle className="size-7" />
            </div>
            <h1 className="font-display text-2xl font-bold">Missing verification token</h1>
            <p className="mt-2 text-sm text-ink/55">
              The verification link appears incomplete. Please check the link in <code className="bg-paper px-1.5 py-0.5 rounded text-xs font-mono text-coral">docs/dev-emails.log</code>.
            </p>
            <Button asChild className="mt-6 w-full rounded-xl bg-ink text-paper hover:bg-ink/90">
              <Link href="/auth">Return to Sign in</Link>
            </Button>
          </div>
        ) : verifyMutation.isPending ? (
          <div>
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-sky/30 text-ink mb-4">
              <Loader2 className="size-7 animate-spin" />
            </div>
            <h1 className="font-display text-2xl font-bold">Verifying your email...</h1>
            <p className="mt-2 text-sm text-ink/55">Please wait a moment while we activate your recognition workspace.</p>
          </div>
        ) : verifyMutation.isSuccess ? (
          <div>
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint text-ink mb-4">
              <CheckCircle2 className="size-7" />
            </div>
            <h1 className="font-display text-2xl font-bold">Email verified!</h1>
            <p className="mt-2 text-sm text-ink/55">
              Your email <b className="text-ink">{verifyMutation.data.email}</b> has been verified. You're ready to share kudos with your team.
            </p>
            <Button
              onClick={() => navigate("/")}
              className="mt-6 w-full gap-2 rounded-xl bg-ink text-paper hover:bg-ink/90"
            >
              Continue to Kudos Wall <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div>
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-coral/15 text-coral mb-4">
              <AlertCircle className="size-7" />
            </div>
            <h1 className="font-display text-2xl font-bold">Verification failed</h1>
            <p className="mt-2 text-sm text-ink/55">
              {verifyMutation.error?.message || "This verification link is invalid or has expired."}
            </p>
            <div className="mt-6 space-y-2">
              <Button asChild className="w-full rounded-xl bg-ink text-paper hover:bg-ink/90">
                <Link href="/auth">Go to Sign in</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
