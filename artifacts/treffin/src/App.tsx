import { lazy, Suspense, useEffect, useRef } from "react";
import { setAuthTokenGetter, useSyncCurrentUser } from "@workspace/api-client-react";
import { syncMathUser, clearMathUser } from "@/lib/math-auth";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppContextProvider } from "@/context/app-context";
import { ThemeProvider } from "@/context/theme-context";
import { RepFloater } from "@/components/rep-floater";
import { LevelUpModal } from "@/components/level-up-modal";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineIndicator } from "@/components/offline-indicator";
import { UpdatePrompt } from "@/components/update-prompt";
import { BannerQueue } from "@/components/banner-queue";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { CookieBanner } from "@/components/cookie-banner";
import { WelcomeModal } from "@/components/welcome-modal";
import { ProfileGuestView } from "@/components/profile-guest-view";
import { authClient, getToken, useSession } from "@/lib/auth-client";
import { SessionProvider } from "@/lib/session-provider";

import { MathLayout } from "@/components/math/math-layout";

const Home = lazy(() => import("@/pages/home"));
const Debates = lazy(() => import("@/pages/debates"));
const DebateRoom = lazy(() => import("@/pages/debate-room"));
const Articles = lazy(() => import("@/pages/articles"));
const ArticleDetail = lazy(() => import("@/pages/article-detail"));
const ArticleEditor = lazy(() => import("@/pages/article-editor"));
const Profile = lazy(() => import("@/pages/profile"));
const Communities = lazy(() => import("@/pages/communities"));
const CommunityRoom = lazy(() => import("@/pages/community-room"));
const Notifications = lazy(() => import("@/pages/notifications"));
const Analytics = lazy(() => import("@/pages/analytics"));
const Saved = lazy(() => import("@/pages/saved"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const About = lazy(() => import("@/pages/about"));
const Terms = lazy(() => import("@/pages/terms"));
const Privacy = lazy(() => import("@/pages/privacy"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Admin = lazy(() => import("@/pages/admin"));
const Discover = lazy(() => import("@/pages/discover"));
const SignIn = lazy(() => import("@/pages/sign-in"));
const SignUp = lazy(() => import("@/pages/sign-up"));
const MathHub = lazy(() => import("@/pages/math/index"));
const ProblemDetail = lazy(() => import("@/pages/math/problem-detail"));
const PostProblem = lazy(() => import("@/pages/math/post-problem"));
const ProblemOfWeek = lazy(() => import("@/pages/math/potw"));
const MathLeaderboard = lazy(() => import("@/pages/math/leaderboard"));
const MathContests = lazy(() => import("@/pages/math/contests"));
const MathContestDetail = lazy(() => import("@/pages/math/contest-detail"));
const MathBookmarks = lazy(() => import("@/pages/math/bookmarks"));
const MathUserProfile = lazy(() => import("@/pages/math/user-profile"));
const MathNotifications = lazy(() => import("@/pages/math/notifications"));
const MathShowdown = lazy(() => import("@/pages/math/showdown"));
const MathEleganceBattle = lazy(() => import("@/pages/math/elegance-battle"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show cached data immediately on re-navigation; re-fetch silently in
      // the background only after 30 s.  Without this every route change
      // discards perfectly-good cached responses and re-renders full skeletons.
      staleTime: 30_000,
      // Don't re-fetch just because the user clicked another browser tab and
      // came back — this triggers a waterfall of requests on every focus.
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function UserSyncer() {
  const { user, isSignedIn } = useSession();
  const syncMutation = useSyncCurrentUser();
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user || syncedRef.current === user.id) return;
    syncedRef.current = user.id;
    const pendingName = localStorage.getItem("treffin_name")?.trim() ?? "";
    const displayName = pendingName || user.fullName || user.email || "Member";
    if (pendingName) localStorage.removeItem("treffin_name");
    syncMutation.mutate({ data: { name: displayName, title: "Member", avatarUrl: user.imageUrl } });
  }, [isSignedIn, user, syncMutation]);

  return null;
}

function MathUserSync() {
  const { user, isSignedIn, isLoaded } = useSession();

  useEffect(() => {
    if (isSignedIn && user) {
      const displayName = user.fullName || user.email || "Member";
      syncMathUser(user.id, displayName);
    } else if (isLoaded && !isSignedIn) {
      clearMathUser();
    }
  }, [isSignedIn, isLoaded, user]);

  return null;
}

function AuthSync() {
  const { user } = useSession();
  useEffect(() => {
    setAuthTokenGetter(getToken);
    return () => setAuthTokenGetter(null);
  }, [user?.id]);
  return null;
}

function SessionCacheInvalidator() {
  const { user, isLoaded } = useSession();
  const qc = useQueryClient();
  const previousId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;
    const userId = user?.id ?? null;
    if (previousId.current !== undefined && previousId.current !== userId) qc.clear();
    previousId.current = userId;
  }, [isLoaded, user?.id, qc]);

  return null;
}

function HomeRedirect() {
  if (!localStorage.getItem("treffin_onboarded")) return <Redirect to="/onboarding" />;
  return <Home />;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useSession();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function ProfileRoute() {
  const { isSignedIn, isLoaded } = useSession();
  if (!isLoaded) return null;
  return isSignedIn ? <Profile /> : <ProfileGuestView />;
}

function GlobalKeyboardShortcuts() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.metaKey || event.ctrlKey || event.altKey) return;
      const routes: Record<string, string> = { d: "/debates", a: "/articles", c: "/communities", p: "/profile" };
      if (routes[event.key.toLowerCase()]) setLocation(routes[event.key.toLowerCase()]);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setLocation]);
  return null;
}

function GlobalPanels() {
  return <><RepFloater /><LevelUpModal /></>;
}

/** Scrolls the window to the top on every route change. */
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function AppRouter() {
  return (
    <>
    <ScrollToTop />
    <Suspense fallback={<RouteLoadingFallback />}>
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/home" component={HomeRedirect} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/about" component={About} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/sign-up" component={SignUp} />
      <Route path="/debates" component={Debates} />
      <Route path="/debates/:id" component={DebateRoom} />
      <Route path="/articles" component={Articles} />
      <Route path="/articles/new"><RequireAuth><ArticleEditor /></RequireAuth></Route>
      <Route path="/articles/:id" component={ArticleDetail} />
      <Route path="/profile" component={ProfileRoute} />
      <Route path="/profile/:id" component={Profile} />
      <Route path="/communities" component={Communities} />
      <Route path="/communities/:id" component={CommunityRoom} />
      <Route path="/notifications"><RequireAuth><Notifications /></RequireAuth></Route>
      <Route path="/analytics" component={Analytics} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/saved"><RequireAuth><Saved /></RequireAuth></Route>
      <Route path="/admin" component={Admin} />
      <Route path="/discover" component={Discover} />
      <Route path="/math"><MathLayout><MathHub /></MathLayout></Route>
      <Route path="/math/problem/:id/elegance-battle"><MathLayout><MathEleganceBattle /></MathLayout></Route>
      <Route path="/math/problem/:id/showdown"><MathLayout><MathShowdown /></MathLayout></Route>
      <Route path="/math/problem/:id"><MathLayout><ProblemDetail /></MathLayout></Route>
      <Route path="/math/post"><MathLayout><RequireAuth><PostProblem /></RequireAuth></MathLayout></Route>
      <Route path="/math/potw"><MathLayout><ProblemOfWeek /></MathLayout></Route>
      <Route path="/math/leaderboard"><MathLayout><MathLeaderboard /></MathLayout></Route>
      <Route path="/math/contests"><MathLayout><MathContests /></MathLayout></Route>
      <Route path="/math/contests/:contestId"><MathLayout><MathContestDetail /></MathLayout></Route>
      <Route path="/math/bookmarks"><MathLayout><MathBookmarks /></MathLayout></Route>
      <Route path="/math/users/:userId"><MathLayout><MathUserProfile /></MathLayout></Route>
      <Route path="/math/notifications"><MathLayout><MathNotifications /></MathLayout></Route>
      <Route component={NotFound} />
    </Switch>
    </Suspense>
    </>
  );
}

function RouteLoadingFallback() {
  return (
    <main className="flex min-h-[50dvh] items-center justify-center px-4" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
        Loading…
      </div>
    </main>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <WouterRouter base={basePath}>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
            <AppContextProvider>
              <AuthSync />
              <SessionCacheInvalidator />
              <UserSyncer />
              <MathUserSync />
              <TooltipProvider>
                <GlobalKeyboardShortcuts />
                <UpdatePrompt />
                <AppRouter />
                <GlobalPanels />
                <Toaster />
                <OfflineIndicator />
                <BannerQueue />
                <PushNotificationPrompt />
                <InstallAppPrompt />
                <CookieBanner />
                <WelcomeModal />
              </TooltipProvider>
            </AppContextProvider>
            </SessionProvider>
          </QueryClientProvider>
        </WouterRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;