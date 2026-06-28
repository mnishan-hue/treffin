import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Home, Compass, Plus, Bell, User,
  Pen, MessageSquare, FileText, X,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { getGetNotificationsQueryOptions } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CREATE_ACTIONS = [
  {
    icon: Pen,
    label: "New Post",
    desc: "Share a thought or opinion",
    href: "/",
    color: "bg-violet-500/15 text-violet-400",
  },
  {
    icon: MessageSquare,
    label: "Start Debate",
    desc: "Challenge a topic live",
    href: "/debates",
    color: "bg-blue-500/15 text-blue-400",
  },
  {
    icon: FileText,
    label: "Write Article",
    desc: "Long-form ideas · 500+ words",
    href: "/articles",
    color: "bg-indigo-500/15 text-indigo-400",
  },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  active: boolean;
}) {
  return (
    <Link href={href} className="flex-1">
      <div className="flex flex-col items-center justify-center gap-[3px] py-2 relative">
        {active && (
          <motion.div
            layoutId="bottomNavIndicator"
            className="absolute top-0 w-8 h-[2px] rounded-b-full"
            style={{ background: "linear-gradient(90deg,#6366f1,#3b82f6)" }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <Icon
          size={active ? 22 : 21}
          strokeWidth={active ? 2.2 : 1.7}
          className={cn(
            "transition-all duration-150",
            active ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "text-[10px] leading-none tracking-wide transition-all duration-150",
            active ? "text-primary font-bold" : "text-muted-foreground font-medium",
          )}
        >
          {label}
        </span>
      </div>
    </Link>
  );
}

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { isSignedIn } = useUser();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: notifications } = useQuery({
    ...getGetNotificationsQueryOptions(),
    refetchInterval: 30_000,
    enabled: !!isSignedIn,
  });
  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  const isActive = (href: string) => {
    if (href === "/") return location === "/" || location === "/home";
    return location.startsWith(href);
  };

  const handleCreate = (href: string) => {
    setLocation(href);
    setCreateOpen(false);
  };

  return (
    <>
      <AnimatePresence>
        {createOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setCreateOpen(false)}
            />
            {/* Outer div handles fixed positioning — keeps transform-centering separate from Framer Motion */}
            <div
              className="fixed z-50 md:hidden"
              style={{
                bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
                left: "50%",
                transform: "translateX(-50%)",
                width: "calc(100vw - 48px)",
                maxWidth: 320,
              }}
            >
              <motion.div
                key="create-menu"
                initial={{ opacity: 0, y: 16, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              >
                <div
                  className="rounded-2xl border border-border overflow-hidden shadow-2xl"
                  style={{ background: "var(--color-card)" }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Create</p>
                    <button
                      onClick={() => setCreateOpen(false)}
                      className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                  {CREATE_ACTIONS.map(({ icon: Icon, label, desc, href, color }) => (
                    <button
                      key={label}
                      onClick={() => handleCreate(href)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/60 active:bg-muted transition-colors text-left border-b border-border/40 last:border-0"
                    >
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", color)}>
                        <Icon size={16} strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-none mb-0.5">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div
                  className="w-3 h-3 rotate-45 mx-auto border-b border-r border-border -mt-1.5 relative z-10"
                  style={{ background: "var(--color-card)" }}
                />
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          borderTop: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
          background: "color-mix(in srgb, var(--color-background) 88%, transparent)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <div className="flex items-stretch h-[60px]">
          <NavItem href="/" label="Home" icon={Home} active={isActive("/")} />
          <NavItem href="/discover" label="Explore" icon={Compass} active={isActive("/discover")} />

          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => setCreateOpen((p) => !p)}
              aria-label="Create content"
              className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center -mt-3 transition-all active:scale-95 shadow-lg"
              style={{
                background: createOpen
                  ? "linear-gradient(135deg,#7c3aed,#2563eb)"
                  : "linear-gradient(135deg,#6366f1,#3b82f6)",
                boxShadow: createOpen
                  ? "0 0 0 3px rgba(99,102,241,0.35), 0 8px 24px rgba(99,102,241,0.5)"
                  : "0 4px 20px rgba(99,102,241,0.45)",
              }}
            >
              <motion.div
                animate={{ rotate: createOpen ? 45 : 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 24 }}
              >
                <Plus size={24} strokeWidth={2.8} className="text-white" />
              </motion.div>
            </button>
          </div>

          <div className="flex-1 relative">
            <Link href="/notifications" className="block h-full">
              <div className="flex flex-col items-center justify-center gap-[3px] py-2 h-full relative">
                {isActive("/notifications") && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute top-0 w-8 h-[2px] rounded-b-full"
                    style={{ background: "linear-gradient(90deg,#6366f1,#3b82f6)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="relative">
                  <Bell
                    size={isActive("/notifications") ? 22 : 21}
                    strokeWidth={isActive("/notifications") ? 2.2 : 1.7}
                    className={cn(
                      "transition-all duration-150",
                      isActive("/notifications") ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center px-[3px] border-2 border-background leading-none">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-none tracking-wide transition-all duration-150",
                    isActive("/notifications")
                      ? "text-primary font-bold"
                      : "text-muted-foreground font-medium",
                  )}
                >
                  Alerts
                </span>
              </div>
            </Link>
          </div>

          <NavItem href="/profile" label="Profile" icon={User} active={isActive("/profile")} />
        </div>
      </nav>
    </>
  );
}
