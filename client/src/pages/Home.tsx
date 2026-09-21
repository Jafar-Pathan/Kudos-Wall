import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpRight,
  ChevronRight,
  Flame,
  Gift,
  Heart,
  Loader2,
  Menu,
  PartyPopper,
  Search,
  Send,
  Sparkles,
  ThumbsUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const values = ["#Teamwork", "#CustomerObsession", "#Innovation"] as const;
const pointOptions = [10, 20, 50] as const;
const colors = ["bg-coral", "bg-lilac", "bg-mint", "bg-sky", "bg-gold"];

type FeedItem = {
  id: string | number;
  senderId: string | number;
  recipientId: string | number;
  points: number;
  message: string;
  tags: string[];
  reactions: Record<string, number>;
  sender?: { name?: string | null; avatar?: string | null; department?: string | null };
  recipient?: { name?: string | null; avatar?: string | null; department?: string | null };
  createdAt: Date | string;
};

function initials(name?: string | null, fallback = "NW") {
  return name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || fallback;
}

function PersonAvatar({ name, avatar, index = 0, size = "md" }: { name?: string | null; avatar?: string | null; index?: number | string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "size-12" : size === "sm" ? "size-8" : "size-10";
  const numIndex = typeof index === "number" ? index : (index ? index.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) : 0);
  return (
    <Avatar className={`${sizeClass} border-2 border-white shadow-sm ${colors[Math.abs(numIndex) % colors.length]}`}>
      <AvatarFallback className="bg-transparent text-[11px] font-bold text-ink">{avatar || initials(name)}</AvatarFallback>
    </Avatar>
  );
}

function AppShell({ children, onGive, user, logout }: { children: React.ReactNode; onGive: () => void; user: ReturnType<typeof useAuth>["user"]; logout: ReturnType<typeof useAuth>["logout"] }) {
  const overview = trpc.kudos.overview.useQuery();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { href: "/", label: "Wall", icon: Heart },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/profile", label: "My profile", icon: Users },
  ];
  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-ink/10 bg-paper px-5 py-6 transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <span className="grid size-9 place-items-center rounded-xl bg-ink text-paper shadow-[3px_3px_0_0_#ff6b4a]"><Sparkles className="size-4" /></span>
            <span className="font-display text-lg font-bold tracking-tight">kudos<span className="text-coral">.</span></span>
          </Link>
          <Button className="lg:hidden" variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></Button>
        </div>
        <div className="mt-12">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40">Workspace</p>
          <nav className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return <Button key={item.href} asChild variant="ghost" className="h-11 w-full justify-start gap-3 rounded-xl px-3 text-sm font-semibold text-ink/60 hover:bg-ink/5 hover:text-ink"><Link href={item.href} onClick={() => setMobileOpen(false)}><Icon className="size-[18px]" />{item.label}{item.href === "/" && <span className="ml-auto size-1.5 rounded-full bg-coral" />}</Link></Button>;
            })}
          </nav>
        </div>
        <div className="mt-auto rounded-2xl bg-lilac/35 p-4">
          <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-ink/60">Your giving wallet</span><Gift className="size-4 text-ink/50" /></div>
          <div className="flex items-end justify-between"><span className="font-display text-3xl font-bold">{overview.data?.allowance ?? 72}</span><span className="pb-1 text-xs font-medium text-ink/50">/ 100 pts</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, ((overview.data?.allowance ?? 72) / 100) * 100)}%` }} /></div>
          <p className="mt-3 text-[11px] leading-4 text-ink/55">Allowance resets in <b className="text-ink">12 days</b>.</p>
          <Button className="mt-4 w-full rounded-xl bg-ink text-paper hover:bg-ink/90" size="sm" onClick={onGive}><Gift className="size-4" />Give kudos</Button>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-ink/10 pt-5">
          <PersonAvatar name={user?.name} index={2} size="sm" />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{user?.name || "Guest teammate"}</p><p className="truncate text-[11px] text-ink/45">{user?.email || "Preview mode"}</p></div>
          {user ? <Button variant="ghost" size="icon-sm" className="text-ink/40" onClick={() => logout()} aria-label="Sign out"><ArrowUpRight className="size-4" /></Button> : <Button variant="ghost" size="sm" className="text-xs font-bold text-coral" onClick={() => { window.location.href = "/auth"; }}>Sign in</Button>}
        </div>
      </aside>
      {mobileOpen && <Button className="fixed inset-0 z-30 h-full w-full rounded-none bg-ink/20 lg:hidden" variant="ghost" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <main className="min-h-screen lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-ink/10 bg-paper/90 px-5 backdrop-blur-md md:px-10">
          <div className="flex items-center gap-3"><Button className="lg:hidden" variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></Button><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/35">Friday, September 18</p><h1 className="font-display text-xl font-bold tracking-tight">Good morning, team <span className="text-coral">✦</span></h1></div></div>
          <div className="flex items-center gap-2"><Button variant="outline" size="sm" className="hidden rounded-xl border-ink/15 bg-transparent md:flex" onClick={onGive}><Gift className="size-4" />Give kudos</Button><Button variant="ghost" size="icon" className="rounded-xl" aria-label="Notifications"><span className="relative"><Heart className="size-[18px]" /><span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-coral" /></span></Button></div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Metric({ label, value, hint, tone, icon: Icon }: { label: string; value: string; hint: string; tone: string; icon: typeof Gift }) {
  return <div className={`rounded-2xl p-5 ${tone}`}><div className="flex items-start justify-between"><p className="text-xs font-semibold text-ink/55">{label}</p><Icon className="size-4 text-ink/45" /></div><p className="mt-4 font-display text-3xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[11px] font-medium text-ink/50">{hint}</p></div>;
}

function FeedCard({ item, onReact, reacting, currentUserId }: { item: FeedItem; onReact: (id: string | number, reaction: "thumbs" | "party" | "fire") => void; reacting: boolean; currentUserId?: string | number }) {
  const senderName = item.sender?.name || "Teammate";
  const recipientName = item.recipient?.name || "Teammate";
  return <article className="rounded-2xl border border-ink/10 bg-white p-5 shadow-[0_12px_30px_rgba(31,31,31,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(31,31,31,0.08)] sm:p-6">
    <div className="flex items-start gap-3"><PersonAvatar name={senderName} avatar={item.sender?.avatar} index={item.senderId} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5 text-sm"><span className="font-bold">{senderName}</span><span className="text-ink/35">recognized</span><span className="font-bold">{recipientName}</span><Badge className="ml-1 rounded-md bg-coral/10 px-2 py-0.5 text-[10px] font-bold text-coral hover:bg-coral/10">+{item.points} pts</Badge></div><p className="mt-1 text-[11px] text-ink/40">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p></div><Button variant="ghost" size="icon-sm" className="text-ink/30 hover:text-ink" aria-label="More options"><span className="text-lg leading-none">•••</span></Button></div>
    <div className="mt-5 border-l-2 border-coral/40 pl-4"><p className="text-[15px] leading-7 text-ink/75">“{item.message}”</p><div className="mt-3 flex flex-wrap gap-2">{item.tags.map((tag) => <Badge key={tag} variant="outline" className="rounded-md border-ink/10 bg-paper px-2 py-1 text-[10px] font-semibold text-ink/55">{tag}</Badge>)}</div></div>
    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink/8 pt-4"><Button variant="ghost" size="sm" disabled={reacting} onClick={() => onReact(item.id, "thumbs")} className="h-8 rounded-lg px-2.5 text-xs text-ink/50 hover:bg-sky/50 hover:text-ink"><ThumbsUp className="size-3.5" />{item.reactions.thumbs || 0}</Button><Button variant="ghost" size="sm" disabled={reacting} onClick={() => onReact(item.id, "party")} className="h-8 rounded-lg px-2.5 text-xs text-ink/50 hover:bg-gold/50 hover:text-ink"><PartyPopper className="size-3.5" />{item.reactions.party || 0}</Button><Button variant="ghost" size="sm" disabled={reacting} onClick={() => onReact(item.id, "fire")} className="h-8 rounded-lg px-2.5 text-xs text-ink/50 hover:bg-coral/10 hover:text-coral"><Flame className="size-3.5" />{item.reactions.fire || 0}</Button><span className="ml-auto text-[11px] text-ink/30">{currentUserId ? "React to celebrate" : "Sign in to react"}</span></div>
  </article>;
}

function KudosComposer({ open, onOpenChange, user }: { open: boolean; onOpenChange: (open: boolean) => void; user: ReturnType<typeof useAuth>["user"] }) {
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipient, setRecipient] = useState<{ id: string | number; name?: string | null; avatar?: string | null; department?: string | null } | null>(null);
  const [points, setPoints] = useState<(typeof pointOptions)[number]>(20);
  const [message, setMessage] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["#Teamwork"]);
  const searchQuery = trpc.kudos.searchUsers.useQuery({ query: recipientQuery, excludeId: user?.id }, { enabled: open });
  const utils = trpc.useUtils();
  const give = trpc.kudos.give.useMutation({ onSuccess: (result) => { toast.success(`Kudos sent to ${result.recipientName}!`); onOpenChange(false); setRecipient(null); setRecipientQuery(""); setMessage(""); setSelectedTags(["#Teamwork"]); void utils.kudos.feed.invalidate(); }, onError: (error) => toast.error(error.message) });
  const toggleTag = (tag: string) => setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!user) { window.location.href = "/auth"; return; } if (!recipient) { toast.error("Choose a teammate to recognize."); return; } give.mutate({ recipientId: String(recipient.id), points, message, tags: selectedTags as typeof values[number][] }); };
  const results = searchQuery.data ?? [];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl rounded-3xl border-ink/10 bg-paper p-0"><form onSubmit={submit}><DialogHeader className="border-b border-ink/10 px-6 py-5"><DialogTitle className="font-display text-2xl">Give a little kudos<span className="text-coral">.</span></DialogTitle><DialogDescription className="text-ink/50">Make someone’s week. Your recognition is visible to the whole team.</DialogDescription></DialogHeader><div className="space-y-5 px-6 py-6"><div><label className="mb-2 block text-xs font-bold text-ink/60">Who are you recognizing?</label><div className="relative"><Input value={recipient ? recipient.name || "" : recipientQuery} onChange={(event) => { setRecipient(null); setRecipientQuery(event.target.value); }} placeholder="Search by name or email…" className="h-11 rounded-xl border-ink/15 bg-white" />{recipient && <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-1/2 -translate-y-1/2 text-ink/40" onClick={() => { setRecipient(null); setRecipientQuery(""); }} aria-label="Clear recipient"><X /></Button>}{!recipient && (recipientQuery.length > 0 || results.length > 0) && <div className="absolute top-12 z-10 w-full rounded-xl border border-ink/10 bg-white p-1.5 shadow-xl">{results.length ? results.map((person) => <Button key={person.id} type="button" variant="ghost" className="h-auto w-full justify-start gap-3 rounded-lg px-3 py-2.5" onClick={() => { setRecipient(person); setRecipientQuery(""); }}><PersonAvatar name={person.name} avatar={person.avatar} index={person.id} size="sm" /><span className="text-left"><span className="block text-sm font-bold">{person.name}</span><span className="block text-[11px] text-ink/45">{person.department}</span></span></Button>) : <p className="px-3 py-3 text-xs text-ink/45">No teammates found.</p>}</div>}</div></div><div><label className="mb-2 block text-xs font-bold text-ink/60">How many points?</label><div className="grid grid-cols-3 gap-2">{pointOptions.map((option) => <Button key={option} type="button" variant={points === option ? "default" : "outline"} onClick={() => setPoints(option)} className={`h-11 rounded-xl ${points === option ? "bg-ink text-paper hover:bg-ink/90" : "border-ink/15 bg-white"}`}><span className="font-display text-lg font-bold">{option}</span><span className="text-[10px] opacity-60">points</span></Button>)}</div></div><div><label className="mb-2 block text-xs font-bold text-ink/60">What value did they show?</label><div className="flex flex-wrap gap-2">{values.map((tag) => <Button key={tag} type="button" variant="outline" size="sm" onClick={() => toggleTag(tag)} className={`rounded-lg border-ink/15 ${selectedTags.includes(tag) ? "border-coral bg-coral/10 text-coral" : "bg-white text-ink/55"}`}>{selectedTags.includes(tag) && <span>✓</span>}{tag}</Button>)}</div></div><div><label className="mb-2 block text-xs font-bold text-ink/60">Your message</label><Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell the team what made this moment special…" className="min-h-24 resize-none rounded-xl border-ink/15 bg-white" maxLength={280} required /><p className="mt-1 text-right text-[10px] text-ink/35">{message.length}/280</p></div></div><DialogFooter className="border-t border-ink/10 bg-white/50 px-6 py-4"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button><Button type="submit" disabled={give.isPending} className="rounded-xl bg-coral text-white hover:bg-coral/90">{give.isPending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />}Send recognition</Button></DialogFooter></form></DialogContent></Dialog>;
}

export default function Home() {
  const { user, logout } = useAuth();
  const [composerOpen, setComposerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const feedInput = useMemo(() => ({ limit: 10, search: search || undefined }), [search]);
  const feed = trpc.kudos.feed.useQuery(feedInput);
  const overview = trpc.kudos.overview.useQuery();
  const utils = trpc.useUtils();
  const react = trpc.kudos.react.useMutation({ onSuccess: () => void utils.kudos.feed.invalidate(), onError: (error) => toast.error(error.message) });
  const leaderboardQuery = trpc.leaderboard.list.useQuery({});
  const topPeople = leaderboardQuery.data?.slice(0, 3) ?? [];
  const items = (feed.data?.rows ?? []) as FeedItem[];
  const openComposer = () => { if (!user) { window.location.href = "/auth"; return; } setComposerOpen(true); };
  return <AppShell user={user} logout={logout} onGive={openComposer}><div className="mx-auto max-w-[1220px] px-5 py-7 md:px-10 md:py-10"><section className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">{overview.isLoading ? <><Skeleton className="h-[156px] rounded-2xl" /><Skeleton className="h-[156px] rounded-2xl" /><Skeleton className="h-[156px] rounded-2xl" /></> : <><Metric label="Points to give" value={`${overview.data?.allowance ?? 72}`} hint="Resets October 1" tone="bg-coral/15" icon={Gift} /><Metric label="Kudos received" value={`${overview.data?.received ?? 0}`} hint={user ? "Your total" : "Demo data"} tone="bg-lilac/55" icon={Heart} /><Metric label="Kudos sent" value={`${overview.data?.sent ?? 0}`} hint={user ? "Your contributions" : "Demo data"} tone="bg-mint/60" icon={Sparkles} /></>}</section><div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_310px]"><section><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-coral">Live from the team</p><h2 className="mt-1 font-display text-3xl font-bold tracking-tight">The wall</h2></div><div className="flex items-center gap-2"><div className="relative hidden sm:block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/35" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search kudos" className="h-9 w-44 rounded-xl border-ink/10 bg-white pl-9 text-xs" /></div><Button onClick={openComposer} className="rounded-xl bg-ink text-paper hover:bg-ink/90"><Gift className="size-4" />Give kudos</Button></div></div>{feed.isLoading ? <div className="space-y-4"><Skeleton className="h-60 rounded-2xl" /><Skeleton className="h-52 rounded-2xl" /></div> : feed.isError ? <div className="rounded-2xl border border-coral/20 bg-coral/5 p-8 text-center"><p className="font-bold">The wall is taking a breather.</p><p className="mt-1 text-sm text-ink/50">Try refreshing the feed.</p><Button className="mt-4 rounded-xl bg-ink text-paper" onClick={() => feed.refetch()}>Try again</Button></div> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center"><Sparkles className="mx-auto size-7 text-coral" /><p className="mt-3 font-bold">{user ? "No kudos yet." : "No kudos match that search."}</p><p className="mt-1 text-sm text-ink/45">{user ? "Be the first to recognize someone on your team!" : "Try another phrase or be the first to recognize someone."}</p></div> : <div className="space-y-4">{items.map((item) => <FeedCard key={item.id} item={item} currentUserId={user?.id} reacting={react.isPending} onReact={(id, reaction) => { if (!user) { window.location.href = "/auth"; return; } react.mutate({ kudosId: String(id), reaction }); }} />)}<Button variant="outline" className="mt-2 w-full rounded-xl border-ink/10 bg-transparent text-ink/55" onClick={() => toast.success("You're all caught up!")}>You're all caught up <ChevronRight className="size-4" /></Button></div>}</section><aside className="space-y-5"><div className="rounded-2xl bg-ink p-5 text-paper"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-paper/55">Team activity</p><span className="rounded-full bg-mint px-2 py-1 text-[10px] font-bold text-ink">Active</span></div><p className="mt-8 font-display text-5xl font-bold">{topPeople.length}<span className="text-2xl text-paper/40"> members</span></p><p className="mt-1 text-xs text-paper/55">recognized on the leaderboard this month</p><div className="mt-5 flex -space-x-2">{topPeople.slice(0, 5).map((person, index) => <PersonAvatar key={person.id} avatar={person.avatar} name={person.name} index={index} size="sm" />)}{!topPeople.length && ["MP", "JL", "SC", "OW", "PN"].map((avatar, index) => <PersonAvatar key={avatar} avatar={avatar} index={index} size="sm" />)}</div></div><div className="rounded-2xl border border-ink/10 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40">Top recognition</p><h3 className="mt-1 font-display text-lg font-bold">This month</h3></div><Trophy className="size-5 text-gold" /></div><div className="mt-5 space-y-4">{topPeople.length ? topPeople.map((person, index) => <div key={person.id} className="flex items-center gap-3"><span className="w-3 text-xs font-bold text-ink/30">{index + 1}</span><PersonAvatar avatar={person.avatar} name={person.name} index={index + 2} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{person.name}</p><p className="text-[10px] text-ink/40">{person.department}</p></div><span className="text-xs font-bold text-coral">{person.earnedPoints}</span></div>) : [{ name: "Maya Patel", dept: "Design", points: "420", avatar: "MP" }, { name: "Priya Nair", dept: "Engineering", points: "365", avatar: "PN" }, { name: "Sofia Chen", dept: "Marketing", points: "310", avatar: "SC" }].map((person, index) => <div key={person.name} className="flex items-center gap-3"><span className="w-3 text-xs font-bold text-ink/30">{index + 1}</span><PersonAvatar avatar={person.avatar} index={index + 2} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{person.name}</p><p className="text-[10px] text-ink/40">{person.dept}</p></div><span className="text-xs font-bold text-coral">{person.points}</span></div>)}</div><Button asChild variant="ghost" className="mt-4 w-full justify-between rounded-xl px-0 text-xs font-bold text-ink/55 hover:bg-transparent hover:text-ink"><Link href="/leaderboard">View full leaderboard <ArrowUpRight className="size-4" /></Link></Button></div><div className="rounded-2xl border border-ink/10 bg-sky/45 p-5"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-white/70"><Sparkles className="size-3.5" /></span><p className="text-xs font-bold">Recognition tip</p></div><p className="mt-3 text-sm leading-6 text-ink/65">Specific beats generic. Share the moment and the impact — it makes recognition stick.</p></div></aside></div></div><KudosComposer user={user} open={composerOpen} onOpenChange={setComposerOpen} /></AppShell>;
}
