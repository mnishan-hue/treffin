import { useEffect, useRef } from "react";
import { setGlobalHeaders, setAuthTokenGetter, useSyncCurrentUser } from "@workspace/api-client-react";
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
import { BannerQueue } from "@/components/banner-queue";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { CookieBanner } from "@/components/cookie-banner";
import { WelcomeModal } from "@/components/welcome-modal";
import { ProfileGuestView } from "@/components/profile-guest-view";
import { authClient, getToken, useSession } from "@/lib/auth-client";

import Home from "@/pages/home";
import Debates from "@/pages/debates";
import DebateRoom from "@/pages/debate-room";
import Articles from "@/pages/articles";
import ArticleDetail from "@/pages/article-detail";
import ArticleEditor from "@/pages/article-editor";
import Profile from "@/pages/profile";
import Communities from "@/pages/communities";
import CommunityRoom from "@/pages/community-room";
import Notifications from "@/pages/notifications";
import Analytics from "@/pages/analytics";
import Saved from "@/pages/saved";
import Onboarding from "@/pages/onboarding";
import About from "@/pages/about";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import NotFound from "@/pages/not-found";
import Admin from "@/pages/admin";
import Discover from "@/pages/discover";
import SignIn from "@/pages/sign-in";
import SignUp from "@/pages/sign-up";
import MathHub from "@/pages/math/index";
import ProblemDetail from "@/pages/math/problem-detail";
import PostProblem from "@/pages/math/post-problem";
import ProblemOfWeek from "@/pages/math/potw";
import MathLeaderboard from "@/pages/math/leaderboard";
import MathContests from "@/pages/math/contests";
import MathContestDetail from "@/pages/math/contest-detail";
import MathBookmarks from "@/pages/math/bookmarks";
import MathUserProfile from "@/pages/math/user-profile";
import MathNotifications from "@/pages/math/notifications";
import MathShowdown from "@/pages/math/showdown";
import MathEleganceBattle from "@/pages/math/elegance-battle";
import { MathLayout } from "@/components/math/math-layout";

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
      setGlobalHeaders({ "x-math-user-id": user.id, "x-math-user-name": displayName });
    } else if (isLoaded && !isSignedIn) {
      clearMathUser();
      setGlobalHeaders({});
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
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <WouterRouter base={basePath}>
          <QueryClientProvider client={queryClient}>
            <AppContextProvider>
              <AuthSync />
              <SessionCacheInvalidator />
              <UserSyncer />
              <MathUserSync />
              <TooltipProvider>
                <GlobalKeyboardShortcuts />
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
          </QueryClientProvider>
        </WouterRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;