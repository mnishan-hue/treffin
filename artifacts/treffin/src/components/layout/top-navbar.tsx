import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, Plus, Bell, X, FileText, MessageSquare, Pen, Users, Sun, Moon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useClerk, Show } from "@clerk/react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings } from "lucide-react";
import { useGlobalSearch, getGlobalSearchQueryKey, useGetNotifications, getGetNotificationsQueryOptions } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/theme-context";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");


function SearchBar({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const q = debouncedQuery.toLowerCase();
  const { data: results, isFetching } = useGlobalSearch(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 0, queryKey: getGlobalSearchQueryKey({ q: debouncedQuery }) } },
  );

  const matchedDebates = results?.debates ?? [];
  const matchedArticles = results?.articles ?? [];
  const matchedThinkers = results?.users ?? [];
  const matchedCommunities = results?.communities ?? [];
  const hasResults = matchedDebates.length + matchedArticles.length + matchedThinkers.length + matchedCommunities.length > 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const goTo = (path: string) => { setQuery(""); setOpen(false); onNavigate(path); };

  return (
    <div ref={containerRef} className="flex-1 max-w-[420px] mx-4 md:mx-6 hidden md:block relative">
      <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search debates, articles, people..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full bg-muted/60 border border-border/60 hover:border-border focus:border-primary/60 focus:bg-card focus:ring-1 focus:ring-primary/20 rounded-xl py-2.5 pl-10 pr-16 text-sm transition-all outline-none placeholder:text-muted-foreground/60"
        data-testid="input-search"
      />
      {query ? (
        <button className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setQuery(""); setOpen(false); }}>
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5">
          <kbd className="h-5 items-center rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground/70 inline-flex">⌘ K</kbd>
        </div>
      )}
      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-card border border-border rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
          {!q ? (
            <div className="p-4 flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quick Access</p>
              {[
                { label: "🔥 Trending Debates", path: "/debates" },
                { label: "📰 Latest Articles", path: "/articles" },
                { label: "🏘️ Communities", path: "/communities" },
                { label: "🏆 Analytics & Rankings", path: "/analytics" },
                { label: "🔖 Saved Items", path: "/saved" },
              ].map(({ label, path }) => (
                <button key={path} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left" onClick={() => goTo(path)}>
                  {label}
                </button>
              ))}
            </div>
          ) : isFetching && !results ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Searching…</div>
          ) : !hasResults ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No results for "<strong>{query}</strong>"</div>
          ) : (
            <div className="py-2 max-h-[60vh] overflow-y-auto">
              {matchedDebates.length > 0 && (<>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-1.5">Debates</p>
                {matchedDebates.map(d => (
                  <button key={`d-${d.id}`} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left" onClick={() => goTo(`/debates/${d.id}`)}>
                    <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-sm truncate">{d.title}</span>
                  </button>
                ))}
              </>)}
              {matchedArticles.length > 0 && (<>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-1.5 mt-1">Articles</p>
                {matchedArticles.map(a => (
                  <button key={`a-${a.id}`} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left" onClick={() => goTo(`/articles/${a.id}`)}>
                    <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-sm truncate">{a.title}</span>
                  </button>
                ))}
              </>)}
              {matchedCommunities.length > 0 && (<>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-1.5 mt-1">Communities</p>
                {matchedCommunities.map(c => (
                  <button key={`c-${c.id}`} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left" onClick={() => goTo(`/communities/${c.id}`)}>
                    <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-base shrink-0">{c.emoji}</span>
                    <span className="text-sm truncate">{c.name}</span>
                  </button>
                ))}
              </>)}
              {matchedThinkers.length > 0 && (<>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-1.5 mt-1">People</p>
                {matchedThinkers.map(t => (
                  <button key={`u-${t.id}`} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left" onClick={() => goTo(`/profile/${t.id}`)}>
                    <Avatar className="w-5 h-5 shrink-0">
                      <AvatarFallback className="text-[9px] bg-primary/20 text-primary">{t.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <span className="text-sm truncate block">{t.name}</span>
                      <span className="text-xs text-muted-foreground truncate block">{t.title}</span>
                    </div>
                  </button>
                ))}
              </>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateMenu({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const actions = [
    { icon: Pen, label: "New Post", desc: "Share a thought or opinion", action: () => { onNavigate("/"); setOpen(false); } },
    { icon: MessageSquare, label: "Start Debate", desc: "Challenge a topic", action: () => { onNavigate("/debates"); setOpen(false); } },
    { icon: FileText, label: "Write Article", desc: "Min 500 words · long-form ideas", action: () => { onNavigate("/articles"); setOpen(false); } },
  ];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button data-testid="button-create" className="hidden sm:flex items-center gap-1.5 treffin-gradient text-white text-sm font-semibold px-4 py-2 rounded-xl treffin-glow hover:opacity-90 transition-all outline-none">
          <Plus className="w-4 h-4" /> Create
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border-border p-1">
        {actions.map(({ icon: Icon, label, desc, action }) => (
          <DropdownMenuItem key={label} onClick={action} className="flex items-start gap-3 p-3 rounded-lg cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </DropdownMenuItem>
        ))}
        <div className="px-3 pb-2 pt-1 border-t border-border mt-1">
          <p className="text-[10px] text-muted-foreground">Press <kbd className="font-mono bg-muted px-1 rounded">D</kbd> Debates · <kbd className="font-mono bg-muted px-1 rounded">A</kbd> Articles · <kbd className="font-mono bg-muted px-1 rounded">/</kbd> Search</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopNavbar() {
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const { toast } = useToast();
  const prevUnreadRef = useRef<number | null>(null);

  const { data: notifications } = useQuery({ ...getGetNotificationsQueryOptions(), refetchInterval: 30_000, enabled: !!isSignedIn });
  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  useEffect(() => {
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = unreadCount;
      return;
    }
    if (unreadCount > prevUnreadRef.current) {
      const newCount = unreadCount - prevUnreadRef.current;
      toast({
        title: `${newCount} new notification${newCount > 1 ? "s" : ""}`,
        description: "Check your bell for the latest activity.",
      });
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName[0]}.` : ""}`
    : user?.username ?? "Thinker";


  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "T";

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="flex items-center justify-between h-[60px] px-4 md:px-6 max-w-[1400px] mx-auto">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2.5 cursor-pointer shrink-0 group">
            <img
              src={`${import.meta.env.BASE_URL}treffin-mark.png`}
              alt="Treffin"
              className="h-8 w-auto object-contain mix-blend-screen drop-shadow-[0_0_10px_rgba(99,102,241,0.6)] group-hover:drop-shadow-[0_0_16px_rgba(99,102,241,0.85)] transition-all"
            />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="font-bold text-[15px] tracking-tight text-foreground">Treffin</span>
              <span className="text-[9px] text-muted-foreground/70 tracking-widest uppercase mt-0.5">Where Minds Debate.</span>
            </div>
          </div>
        </Link>

        <SearchBar onNavigate={setLocation} />

        <div className="flex items-center gap-2 shrink-0">
          <CreateMenu onNavigate={setLocation} />

          <Link href="/notifications">
            <button data-testid="button-notifications" className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center relative text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full border border-background" />
              )}
            </button>
          </Link>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          {/* Hamburger — hidden on mobile (replaced by bottom nav) */}

          <div className="h-6 w-[1px] bg-border/50 hidden sm:block" />

          <Show when="signed-in">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="button-user-menu" className="flex items-center gap-2 hover:bg-muted p-1 pr-3 rounded-xl transition-colors border border-transparent hover:border-border/60 outline-none">
                  <Avatar className="w-8 h-8 border border-primary/30">
                    <AvatarImage src={user?.imageUrl} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-semibold leading-none">{displayName}</span>
                    <span className="text-[10px] treffin-gradient-text font-semibold mt-0.5">Thinker</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/saved")} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" /> Saved Items
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/analytics")} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" /> Analytics
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ redirectUrl: basePath || "/" })} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Show>

          <Show when="signed-out">
            <div className="flex items-center gap-2">
              <Link href="/sign-in">
                <button data-testid="button-sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted">Sign in</button>
              </Link>
              <Link href="/sign-up">
                <button data-testid="button-sign-up" className="text-sm font-semibold treffin-gradient text-white px-4 py-2 rounded-xl treffin-glow hover:opacity-90 transition-all">Join</button>
              </Link>
            </div>
          </Show>
        </div>
      </div>
    </header>

    </>
  );
}
