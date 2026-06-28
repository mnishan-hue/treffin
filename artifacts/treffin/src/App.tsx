import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser, useAuth } from "@clerk/react";
import { setGlobalHeaders, setAuthTokenGetter } from "@workspace/api-client-react";
import { syncMathUser, clearMathUser } from "@/lib/math-auth";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
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
import { CookieBanner } from "@/components/cookie-banner";
import { useSyncCurrentUser } from "@workspace/api-client-react";
import { ProfileGuestView } from "@/components/profile-guest-view";

import Home from "@/pages/home";
import Debates from "@/pages/debates";
import DebateRoom from "@/pages/debate-room";
import Articles from "@/pages/articles";
import ArticleDetail from "@/pages/article-detail";
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
import { MathLayout } from "@/components/math/math-layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#3b82f6",
    colorForeground: "#f0f4ff",
    colorMutedForeground: "#8b98b8",
    colorDanger: "#ef4444",
    colorBackground: "#0d1117",
    colorInput: "#161d2b",
    colorInputForeground: "#f0f4ff",
    colorNeutral: "#1e2d45",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0d1117] border border-[#1e2d45] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl shadow-black/50",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-bold",
    headerSubtitle: "text-[#8b98b8]",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-[#8b98b8] font-medium",
    footerActionLink: "text-[#3b82f6] hover:text-blue-400 font-medium",
    footerActionText: "text-[#8b98b8]",
    dividerText: "text-[#8b98b8]",
    identityPreviewEditButton: "text-[#3b82f6]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-white",
    logoBox: "hidden",
    logoImage: "hidden",
    socialButtonsBlockButton: "bg-[#161d2b] border border-[#1e2d45] hover:bg-[#1e2d45] text-white transition-colors",
    formButtonPrimary: "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold transition-all",
    formFieldInput: "bg-[#161d2b] border-[#1e2d45] text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-xl",
    footerAction: "bg-[#0a0c10] border-t border-[#1e2d45]",
    dividerLine: "bg-[#1e2d45]",
    alert: "bg-[#161d2b] border border-[#1e2d45] rounded-xl",
    otpCodeFieldInput: "bg-[#161d2b] border-[#1e2d45] text-white",
    formFieldRow: "gap-3",
    main: "gap-4",
  },
};

const clerkLocalization = {
  socialButtonsBlockButton: "Continue with {{provider|titleize}}",
  dividerText: "or",
  signIn: {
    start: {
      title: "Welcome back",
      subtitle: "Sign in to your Treffin account",
      actionText: "Don't have an account?",
      actionLink: "Sign up",
    },
    emailCode: {
      title: "Check your email",
      subtitle: "Enter the code sent to {{identifier}}",
      formTitle: "Verification code",
      formSubtitle: "Enter the code sent to your email address",
      resendButton: "Resend code",
    },
    password: {
      title: "Enter your password",
      subtitle: "Enter the password for {{identifier}}",
      actionLink: "Forgot password?",
    },
    forgotPasswordAlternativeMethods: {
      title: "Forgot password?",
      label__alternativeMethods: "Or sign in with another method",
    },
    forgotPassword: {
      title: "Reset your password",
      subtitle: "Enter the code sent to {{identifier}}",
    },
    resetPassword: {
      title: "Set a new password",
      subtitle: "Your password has been reset. Please set a new password.",
    },
  },
  signUp: {
    start: {
      title: "Create your account",
      subtitle: "Join Treffin — where minds debate",
      actionText: "Already have an account?",
      actionLink: "Sign in",
    },
    emailCode: {
      title: "Verify your email",
      subtitle: "Enter the code sent to {{identifier}}",
      formTitle: "Verification code",
      formSubtitle: "Enter the code sent to your email address",
      resendButton: "Resend code",
    },
    emailLink: {
      title: "Verify your email",
      subtitle: "Click the link sent to {{identifier}}",
      formTitle: "Verification link",
      formSubtitle: "Click the link in the email to verify your account",
      resendButton: "Resend link",
    },
  },
  userProfile: {
    navbar: {
      title: "Account",
      description: "Manage your Treffin account",
    },
  },
};

function AuthLogo() {
  return (
    <div className="flex flex-col items-center gap-2 mb-2">
      <img
        src={`${basePath}treffin-mark.png`}
        alt="Treffin"
        className="h-14 w-auto object-contain mix-blend-screen drop-shadow-[0_0_20px_rgba(139,92,246,0.8)]"
      />
      <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60 font-medium">Where Minds Celebrate.</span>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "radial-gradient(ellipse at top, #0d1830 0%, #060810 60%)" }}>
      <div className="flex flex-col items-center w-full max-w-[440px]">
        <AuthLogo />
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "radial-gradient(ellipse at top, #0d1830 0%, #060810 60%)" }}>
      <div className="flex flex-col items-center w-full max-w-[440px]">
        <AuthLogo />
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function UserSyncer() {
  const { user, isSignedIn } = useUser();
  const syncMutation = useSyncCurrentUser();
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    if (syncedRef.current === user.id) return;
    syncedRef.current = user.id;

    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Member";
    const avatarUrl = user.imageUrl || undefined;

    syncMutation.mutate({
      data: { name, title: "Member", avatarUrl },
    });
  }, [isSignedIn, user?.id]);

  return null;
}

function MathUserSync() {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    if (isSignedIn && user) {
      const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Member";
      syncMathUser(user.id, displayName);
      setGlobalHeaders({ "x-math-user-id": user.id, "x-math-user-name": displayName });
    } else if (isSignedIn === false) {
      clearMathUser();
      setGlobalHeaders({});
    }
  }, [isSignedIn, user?.id]);

  return null;
}

function ClerkAuthTokenSync() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
  }, [isSignedIn, getToken]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  const onboarded = localStorage.getItem("treffin_onboarded");
  if (!onboarded) return <Redirect to="/onboarding" />;
  return (
    <>
      <Show when="signed-in"><Home /></Show>
      <Show when="signed-out"><Home /></Show>
    </>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function ProfileRoute() {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return null;
  return isSignedIn ? <Profile /> : <ProfileGuestView />;
}

function GlobalKeyboardShortcuts() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "d": setLocation("/debates"); break;
        case "a": setLocation("/articles"); break;
        case "c": setLocation("/communities"); break;
        case "p": setLocation("/profile"); break;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setLocation]);

  return null;
}

function GlobalPanels() {
  return (
    <>
      <RepFloater />
      <LevelUpModal />
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/home" component={HomeRedirect} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/about" component={About} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/debates" component={Debates} />
      <Route path="/debates/:id" component={DebateRoom} />
      <Route path="/articles" component={Articles} />
      <Route path="/articles/:id" component={ArticleDetail} />
      <Route path="/profile" component={ProfileRoute} />
      <Route path="/profile/:id" component={Profile} />
      <Route path="/communities" component={Communities} />
      <Route path="/communities/:id" component={CommunityRoom} />
      <Route path="/notifications">
        <RequireAuth><Notifications /></RequireAuth>
      </Route>
      <Route path="/analytics" component={Analytics} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/saved">
        <RequireAuth><Saved /></RequireAuth>
      </Route>
      <Route path="/admin" component={Admin} />
      <Route path="/discover" component={Discover} />
      <Route path="/math">
        <MathLayout><MathHub /></MathLayout>
      </Route>
      <Route path="/math/problem/:id">
        <MathLayout><ProblemDetail /></MathLayout>
      </Route>
      <Route path="/math/post">
        <MathLayout><RequireAuth><PostProblem /></RequireAuth></MathLayout>
      </Route>
      <Route path="/math/potw">
        <MathLayout><ProblemOfWeek /></MathLayout>
      </Route>
      <Route path="/math/leaderboard">
        <MathLayout><MathLeaderboard /></MathLayout>
      </Route>
      <Route path="/math/contests">
        <MathLayout><MathContests /></MathLayout>
      </Route>
      <Route path="/math/contests/:contestId">
        <MathLayout><MathContestDetail /></MathLayout>
      </Route>
      <Route path="/math/bookmarks">
        <MathLayout><MathBookmarks /></MathLayout>
      </Route>
      <Route path="/math/users/:userId">
        <MathLayout><MathUserProfile /></MathLayout>
      </Route>
      <Route path="/math/notifications">
        <MathLayout><MathNotifications /></MathLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={clerkLocalization}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <AppContextProvider>
          <ClerkQueryClientCacheInvalidator />
          <UserSyncer />
          <MathUserSync />
          <ClerkAuthTokenSync />
          <TooltipProvider>
            <GlobalKeyboardShortcuts />
            <Router />
            <GlobalPanels />
            <Toaster />
            <OfflineIndicator />
            <BannerQueue />
            <PushNotificationPrompt />
            <CookieBanner />
          </TooltipProvider>
        </AppContextProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
