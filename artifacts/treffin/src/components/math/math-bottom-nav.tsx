import { useLocation } from "wouter";
import { Link } from "wouter";
import { Calculator, Trophy, BarChart2, Bookmark, Star } from "lucide-react";

const NAV_ITEMS = [
  { href: "/math",             label: "Problems",  Icon: Calculator },
  { href: "/math/potw",        label: "POTW",      Icon: Star       },
  { href: "/math/contests",    label: "Contests",  Icon: Trophy     },
  { href: "/math/leaderboard", label: "Rankings",  Icon: BarChart2  },
  { href: "/math/bookmarks",   label: "Bookmarks", Icon: Bookmark   },
];

export function MathBottomNav() {
  const [location] = useLocation();

  const isActive = (href: string) => {
    if (href === "/math") return location === "/math";
    return location.startsWith(href);
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "var(--color-background)",
        borderTop: "1px solid var(--color-border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  padding: "10px 4px 9px",
                  transition: "color 0.15s",
                  color: active ? "hsl(231 89% 68%)" : "var(--color-muted-foreground)",
                  position: "relative",
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: "20%",
                      right: "20%",
                      height: 2,
                      borderRadius: "0 0 4px 4px",
                      background: "linear-gradient(90deg,#6366f1,#3b82f6)",
                    }}
                  />
                )}
                <Icon
                  size={active ? 20 : 19}
                  strokeWidth={active ? 2.2 : 1.8}
                  style={{ transition: "all 0.15s" }}
                />
                <span
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: active ? 700 : 500,
                    letterSpacing: "0.02em",
                    lineHeight: 1,
                  }}
                >
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
