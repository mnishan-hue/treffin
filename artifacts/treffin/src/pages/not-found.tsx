import { Link } from "wouter";
import { Home, MessageSquare, FileText, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-6"
      style={{ background: "radial-gradient(ellipse at top, #0d1830 0%, #060810 60%)" }}
    >
      <div className="flex flex-col items-center text-center max-w-md gap-8">
        <div className="relative">
          <div className="text-[120px] font-black leading-none text-transparent bg-clip-text"
            style={{ backgroundImage: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)" }}>
            404
          </div>
          <div className="absolute inset-0 blur-3xl opacity-20 text-[120px] font-black leading-none text-blue-500 select-none pointer-events-none">
            404
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold">Page not found</h1>
          <p className="text-muted-foreground leading-relaxed">
            The page you're looking for doesn't exist or may have been moved. Let's get you back to the debate.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <Link href="/">
            <div className="flex flex-col items-center gap-2 bg-card border border-border hover:border-primary/40 rounded-xl p-4 cursor-pointer transition-all hover:bg-primary/5 group">
              <Home className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold">Home Feed</span>
            </div>
          </Link>
          <Link href="/debates">
            <div className="flex flex-col items-center gap-2 bg-card border border-border hover:border-orange-400/40 rounded-xl p-4 cursor-pointer transition-all hover:bg-orange-400/5 group">
              <MessageSquare className="w-5 h-5 text-orange-400" />
              <span className="text-sm font-semibold">Debates</span>
            </div>
          </Link>
          <Link href="/articles">
            <div className="flex flex-col items-center gap-2 bg-card border border-border hover:border-blue-400/40 rounded-xl p-4 cursor-pointer transition-all hover:bg-blue-400/5 group">
              <FileText className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-semibold">Articles</span>
            </div>
          </Link>
          <Link href="/communities">
            <div className="flex flex-col items-center gap-2 bg-card border border-border hover:border-green-400/40 rounded-xl p-4 cursor-pointer transition-all hover:bg-green-400/5 group">
              <Compass className="w-5 h-5 text-green-400" />
              <span className="text-sm font-semibold">Communities</span>
            </div>
          </Link>
        </div>

        <Link href="/">
          <button className="bg-primary text-white font-semibold px-6 py-2.5 rounded-full hover:bg-primary/90 transition-colors text-sm">
            ← Back to Treffin
          </button>
        </Link>
      </div>
    </div>
  );
}
