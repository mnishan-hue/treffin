import { Link } from "wouter";
import { Mail, MessageSquare } from "lucide-react";

const PLATFORM_LINKS = [
  { label: "Home", href: "/" },
  { label: "Debates", href: "/debates" },
  { label: "Articles", href: "/articles" },
  { label: "Communities", href: "/communities" },
  { label: "Analytics", href: "/analytics" },
];

const COMPANY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
];

const CONTACT_LINKS = [
  { icon: Mail, label: "contact@thetreffin.com", href: "mailto:contact@thetreffin.com" },
  { icon: MessageSquare, label: "WhatsApp", href: "https://wa.me/918310260793" },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background mt-16">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        {/* Main footer grid */}
        <div className="py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand column */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <img
                src={`${import.meta.env.BASE_URL}treffin-mark.png`}
                alt="Treffin"
                className="w-8 h-8 shrink-0"
              />
              <span className="font-black text-lg tracking-tight">Treffin</span>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[220px]">
              The intellectual platform for students, debaters, and thinkers. Where ideas meet their match.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[12px] text-muted-foreground font-medium">Platform is live</span>
            </div>
          </div>

          {/* Platform */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Platform</h4>
            <div className="flex flex-col gap-2">
              {PLATFORM_LINKS.map(({ label, href }) => (
                <Link key={href} href={href}>
                  <span className="text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Company</h4>
            <div className="flex flex-col gap-2">
              {COMPANY_LINKS.map(({ label, href }) => (
                <Link key={href} href={href}>
                  <span className="text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Contact</h4>
            <div className="flex flex-col gap-2">
              {CONTACT_LINKS.map(({ icon: Icon, label, href }) => (
                <a
                  key={href}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 group-hover:text-primary transition-colors" />
                  {label}
                </a>
              ))}
            </div>
            <div className="mt-3 bg-primary/8 border border-primary/20 rounded-xl p-3.5">
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Have feedback or a debate idea?{" "}
                <a href="https://wa.me/918310260793" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                  We read every message.
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/40 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-muted-foreground">
            © {new Date().getFullYear()} Treffin. All rights reserved.
          </p>
          <p className="text-[12px] text-muted-foreground italic">
            Where minds debate.
          </p>
        </div>
      </div>
    </footer>
  );
}
