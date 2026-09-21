import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Award, Check, Eye, EyeOff, Gift, Heart, KeyRound, Loader2, Save, Sparkles, TrendingUp } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const departments = ["Engineering", "Design", "Marketing", "Sales"] as const;
type Department = (typeof departments)[number];

function initials(name?: string | null) { return name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "NW"; }

export default function Profile() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const profile = trpc.profile.me.useQuery(undefined, { enabled: Boolean(user) });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<Department>("Engineering");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: (updated) => {
      utils.auth.me.setData(undefined, updated);
      void utils.profile.me.invalidate();
      toast.success("Profile details updated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const changePassword = trpc.profile.changePassword.useMutation({
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully.");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setDepartment(user.department);
  }, [user]);

  if (loading) return <div className="min-h-screen bg-paper p-8"><Skeleton className="mx-auto h-96 max-w-3xl rounded-3xl" /></div>;
  if (!user) return <div className="grid min-h-screen place-items-center bg-paper px-5"><div className="max-w-sm text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-coral/15"><Heart className="size-6 text-coral" /></div><h1 className="mt-5 font-display text-3xl font-bold">Your recognition story</h1><p className="mt-2 text-sm leading-6 text-ink/50">Sign in to see the kudos you’ve given, received, and earned.</p><Button className="mt-6 rounded-xl bg-ink text-paper" onClick={() => { window.location.href = "/auth"; }}>Sign in</Button></div></div>;

  const data = profile.data;
  const person = data?.person;
  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    updateProfile.mutate({ name, email, department });
  };
  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return <div className="min-h-screen bg-paper text-ink"><div className="mx-auto max-w-[1000px] px-5 py-8 md:px-10 md:py-12">
    <Button asChild variant="ghost" className="mb-8 -ml-3 rounded-xl px-3 text-ink/50 hover:bg-ink/5 hover:text-ink"><Link href="/"><ArrowLeft className="size-4" />Back to wall</Link></Button>
    <section className="relative overflow-hidden rounded-3xl bg-ink p-7 text-paper md:p-10"><div className="absolute -right-20 -top-28 size-72 rounded-full border-[38px] border-coral/80" /><div className="relative flex flex-col gap-7 sm:flex-row sm:items-end"><Avatar className="size-24 border-4 border-coral bg-gold shadow-xl"><AvatarFallback className="bg-transparent font-display text-2xl font-bold text-ink">{person?.avatar || initials(person?.name || user.name)}</AvatarFallback></Avatar><div className="flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-paper/45">Your profile</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{person?.name || user.name || "Teammate"}</h1><p className="mt-1 text-sm text-paper/55">{person?.department || user.department} · {user.email || "northstar.co"}</p></div><div className="rounded-2xl bg-white/10 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-paper/45">This month</p><p className="mt-1 font-display text-3xl font-bold text-coral">{data?.earnedPoints ?? 0}</p><p className="text-[11px] text-paper/50">earned points</p></div></div></section>
    <section className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-coral/15 p-5"><Gift className="size-5 text-coral" /><p className="mt-4 font-display text-3xl font-bold">{data?.allowance ?? 0}</p><p className="mt-1 text-xs text-ink/50">points left to give</p></div><div className="rounded-2xl bg-lilac/55 p-5"><Heart className="size-5 text-ink/50" /><p className="mt-4 font-display text-3xl font-bold">{data?.stats.received ?? 0}</p><p className="mt-1 text-xs text-ink/50">kudos received</p></div><div className="rounded-2xl bg-mint/60 p-5"><TrendingUp className="size-5 text-ink/50" /><p className="mt-4 font-display text-3xl font-bold">{data?.stats.sent ?? 0}</p><p className="mt-1 text-xs text-ink/50">kudos given</p></div></section>
    <section className="mt-8 rounded-2xl border border-ink/10 bg-white p-5 md:p-7"><Tabs defaultValue="account"><TabsList className="h-auto rounded-xl bg-paper p-1"><TabsTrigger value="account" className="rounded-lg px-4 py-2 text-xs font-bold">Account details</TabsTrigger><TabsTrigger value="security" className="rounded-lg px-4 py-2 text-xs font-bold">Security</TabsTrigger><TabsTrigger value="badges" className="rounded-lg px-4 py-2 text-xs font-bold">Recognition badges</TabsTrigger><TabsTrigger value="activity" className="rounded-lg px-4 py-2 text-xs font-bold">Activity</TabsTrigger></TabsList>
      <TabsContent value="account" className="mt-7"><div className="max-w-xl"><p className="font-display text-xl font-bold">Keep your details current.</p><p className="mt-1 text-sm leading-6 text-ink/50">These details help teammates find and celebrate you.</p><form onSubmit={submitProfile} className="mt-6 space-y-4"><div><label htmlFor="profile-name" className="mb-2 block text-xs font-bold text-ink/60">Full name</label><Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} className="h-11 rounded-xl border-ink/15 bg-white" /></div><div><label htmlFor="profile-email" className="mb-2 block text-xs font-bold text-ink/60">Work email</label><Input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-11 rounded-xl border-ink/15 bg-white" /></div><div><label htmlFor="profile-department" className="mb-2 block text-xs font-bold text-ink/60">Department</label><select id="profile-department" value={department} onChange={(event) => setDepartment(event.target.value as Department)} className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20">{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><Button type="submit" disabled={updateProfile.isPending} className="rounded-xl bg-ink text-paper hover:bg-ink/90">{updateProfile.isPending ? <><Loader2 className="animate-spin" />Saving...</> : <><Save className="size-4" />Save details</>}</Button></form></div></TabsContent>
      <TabsContent value="security" className="mt-7"><div className="max-w-xl"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-coral/15"><KeyRound className="size-4 text-coral" /></span><div><p className="font-display text-xl font-bold">Change your password.</p><p className="mt-1 text-sm leading-6 text-ink/50">Use a password you do not reuse elsewhere. Your current password is required.</p></div></div><form onSubmit={submitPassword} className="mt-6 space-y-4"><PasswordField id="current-password" label="Current password" value={currentPassword} onChange={setCurrentPassword} visible={showCurrent} onToggle={() => setShowCurrent((value) => !value)} autoComplete="current-password" /><PasswordField id="new-password" label="New password" value={newPassword} onChange={setNewPassword} visible={showNew} onToggle={() => setShowNew((value) => !value)} autoComplete="new-password" /><PasswordField id="confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirm} onToggle={() => setShowConfirm((value) => !value)} autoComplete="new-password" /><p className="text-[11px] text-ink/40">At least 8 characters with one letter and one number.</p><Button type="submit" disabled={changePassword.isPending} className="rounded-xl bg-ink text-paper hover:bg-ink/90">{changePassword.isPending ? <><Loader2 className="animate-spin" />Updating...</> : <><KeyRound className="size-4" />Change password</>}</Button></form></div></TabsContent>
      <TabsContent value="badges" className="mt-7"><div className="flex items-start justify-between gap-6"><div><p className="font-display text-xl font-bold">Small moments, lasting culture.</p><p className="mt-1 max-w-lg text-sm leading-6 text-ink/50">Badges are earned by showing up consistently. The Culture Carrier badge unlocks after receiving 5 or more kudos in a month.</p></div><Award className="hidden size-8 text-gold sm:block" /></div>{profile.isLoading ? <div className="mt-6 flex gap-3"><Skeleton className="h-28 w-36 rounded-2xl" /><Skeleton className="h-28 w-36 rounded-2xl" /></div> : <div className="mt-6 flex flex-wrap gap-3">{data?.stats.badges?.length ? data.stats.badges.map((badge, index) => <div key={badge} className={`w-40 rounded-2xl p-4 ${index === 0 ? "bg-gold/40" : "bg-sky/50"}`}><div className="grid size-9 place-items-center rounded-xl bg-white/70"><Sparkles className="size-4" /></div><p className="mt-4 text-xs font-bold">{badge}</p><p className="mt-1 text-[10px] leading-4 text-ink/45">Culture in motion</p></div>) : <div className="w-full rounded-2xl border border-dashed border-ink/15 bg-paper p-6 text-center"><Sparkles className="mx-auto size-6 text-ink/30" /><p className="mt-3 text-sm font-bold text-ink/50">No badges yet</p><p className="mt-1 text-[11px] text-ink/40">Keep giving and receiving kudos to earn badges.</p></div>}</div>}</TabsContent>
      <TabsContent value="activity" className="mt-7"><div className="rounded-2xl bg-paper p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-mint"><Check className="size-4" /></span><div><p className="text-sm font-bold">You’re part of the culture loop</p><p className="mt-1 text-xs text-ink/45">Your recognition history is private to you and visible in the wall as shared.</p></div></div></div></TabsContent>
    </Tabs></section>
  </div></div>;
}

function PasswordField({ id, label, value, onChange, visible, onToggle, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; autoComplete: string }) {
  return <div><label htmlFor={id} className="mb-2 block text-xs font-bold text-ink/60">{label}</label><div className="relative"><Input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} required minLength={8} autoComplete={autoComplete} className="h-11 rounded-xl border-ink/15 bg-white pr-11" /><button type="button" onClick={onToggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink">{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>;
}
