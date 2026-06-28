import { AppLayout } from "@/components/layout/app-layout";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an account or using Treffin, you agree to these Terms. If you do not agree, do not use the service.",
  },
  {
    title: "2. Your Account",
    body: "You are responsible for the activity on your account, the accuracy of the information you provide, and the security of your credentials. You must be at least 13 years old to use Treffin.",
  },
  {
    title: "3. Content & Conduct",
    body: "You retain ownership of the content you post. By posting, you grant Treffin a non-exclusive license to display, distribute, and promote your content within the platform. You agree not to post unlawful, harassing, hateful, infringing, or misleading content.",
  },
  {
    title: "4. Moderation",
    body: "We may remove content or suspend accounts that violate these Terms. We aim to be transparent and proportionate, but final moderation decisions rest with Treffin.",
  },
  {
    title: "5. Reputation & Rankings",
    body: "Reputation scores, leaderboards, and rank badges are awarded at Treffin's discretion based on community activity. They confer no monetary value and may be adjusted to combat abuse.",
  },
  {
    title: "6. Termination",
    body: "You may delete your account at any time. We may suspend or terminate accounts that violate these Terms or harm the community.",
  },
  {
    title: "7. Disclaimer",
    body: "Treffin is provided “as is,” without warranties of any kind. We are not liable for user-generated content or for losses arising from your use of the service.",
  },
  {
    title: "8. Changes",
    body: "We may update these Terms from time to time. Continued use of Treffin after changes means you accept the updated Terms.",
  },
];

export default function Terms() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
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
