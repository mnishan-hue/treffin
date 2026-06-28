import { AppLayout } from "@/components/layout/app-layout";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "What we collect",
    body: "Account info you provide (name, email, avatar), content you post (debates, articles, comments, votes), and basic technical metadata (device, browser, IP) needed to operate and secure the service.",
  },
  {
    title: "How we use it",
    body: "To run Treffin: authenticate you, display your content, compute reputation and rankings, surface relevant debates and articles, send transactional notifications, and prevent abuse.",
  },
  {
    title: "Third parties",
    body: "We use Clerk for authentication and a managed PostgreSQL provider for storage. These providers process data on our behalf under their own security standards.",
  },
  {
    title: "Cookies",
    body: "We use session cookies for authentication and basic preferences. We do not sell your data to advertisers.",
  },
  {
    title: "Your choices",
    body: "You can edit your profile, delete your content, or request account deletion at any time by contacting contact@thetreffin.com.",
  },
  {
    title: "Security",
    body: "We use encryption in transit (HTTPS) and follow industry-standard practices. No system is perfectly secure. Please use a strong, unique password.",
  },
  {
    title: "Contact",
    body: "Privacy questions? Reach us at contact@thetreffin.com.",
  },
];

export default function Privacy() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated: May 2026</p>
        </div>
        <div className="flex flex-col gap-5">
          {SECTIONS.map((s) => (
            <section key={s.title} className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-sm mb-2">{s.title}</h2>
              <p className="text-sm text-foreground/85 leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
