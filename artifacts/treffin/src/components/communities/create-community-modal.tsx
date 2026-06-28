import { useState } from "react";
import { motion } from "framer-motion";
import { X, Globe, Lock, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateCommunity, Community } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useClerk } from "@clerk/react";

const EMOJI_OPTIONS = ["🤖", "🧠", "🌍", "🚀", "🔬", "👑", "💡", "📚", "🎯", "🏛️", "⚡", "🌱"];
const CATEGORY_OPTIONS = ["Technology", "Philosophy", "Politics", "Startups", "Science", "History", "Economics", "Culture", "Health", "Art", "General"];
const DEFAULT_RULES = [
  "Be respectful and constructive",
  "Back claims with evidence",
  "No personal attacks",
  "Stay on topic",
  "Quality over quantity",
];

interface Props {
  onClose: () => void;
  onCreated: (community: Community) => void;
}

export function CreateCommunityModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [category, setCategory] = useState("General");
  const [isPrivate, setIsPrivate] = useState(false);
  const [rules, setRules] = useState<string[]>([...DEFAULT_RULES]);
  const [showRules, setShowRules] = useState(false);
  const { toast } = useToast();
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const createMutation = useCreateCommunity();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (!isSignedIn) {
      toast({ title: "Sign in required", description: "Please sign in to create a community.", variant: "destructive" });
      onClose();
      openSignIn();
      return;
    }

    const cleanedRules = rules.map((r) => r.trim()).filter(Boolean);

    createMutation.mutate(
      { data: { name: name.trim(), description: description.trim(), emoji, category, isPrivate, rules: cleanedRules } },
      {
        onSuccess: (community) => {
          onCreated(community);
          onClose();
        },
        onError: (err: any) => {
          const status = err?.status ?? err?.response?.status;
          if (status === 401) {
            toast({ title: "Sign in required", description: "Please sign in to create a community.", variant: "destructive" });
            onClose();
            openSignIn();
          } else {
            toast({ title: "Failed to create community", variant: "destructive" });
          }
        },
      }
    );
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 60, scale: 0.97 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border/80 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/50 flex flex-col gap-5 p-6 max-h-[90dvh] overflow-y-auto scrollbar-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Create Community</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Start a new intellectual space</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Emoji picker */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">Icon</label>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition-all",
                    emoji === e
                      ? "border-primary bg-primary/20 scale-110"
                      : "border-border/50 bg-muted/30 hover:border-primary/50 hover:bg-primary/10"
                  )}
                  data-testid={`button-emoji-${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-12 h-12 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-2xl">{emoji}</div>
              <input
                type="text"
                value={emoji}
                onChange={e => setEmoji(e.target.value)}
                placeholder="Or type any emoji"
                className="flex-1 bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                maxLength={2}
              />
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">Name <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Quantum Computing Nerds"
              className="bg-muted/30 border border-border/60 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              required
              data-testid="input-community-name"
              maxLength={60}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this community about? What kind of discussions happen here?"
              className="bg-muted/30 border border-border/60 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors resize-none"
              rows={3}
              data-testid="input-community-description"
              maxLength={300}
            />
            <span className="text-[11px] text-muted-foreground text-right">{description.length}/300</span>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "text-xs font-semibold px-3 py-1.5 rounded-full border transition-all",
                    category === cat
                      ? "treffin-gradient text-white border-transparent"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 bg-muted/30"
                  )}
                  data-testid={`button-category-${cat}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy toggle */}
          <div className="flex items-center justify-between bg-muted/30 border border-border/60 rounded-xl p-4">
            <div className="flex items-center gap-3">
              {isPrivate ? <Lock className="w-4 h-4 text-yellow-400" /> : <Globe className="w-4 h-4 text-emerald-400" />}
              <div>
                <p className="text-sm font-semibold">{isPrivate ? "Private" : "Public"}</p>
                <p className="text-xs text-muted-foreground">{isPrivate ? "Members must apply to join" : "Anyone can join"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(p => !p)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative",
                isPrivate ? "bg-yellow-500" : "bg-muted"
              )}
              data-testid="toggle-community-privacy"
            >
              <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", isPrivate ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>

          {/* Rules section */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowRules(v => !v)}
              className="flex items-center justify-between text-sm font-semibold text-left"
            >
              <span>Community Rules</span>
              <span className="text-xs text-muted-foreground">{showRules ? "Hide" : `${rules.filter(r => r.trim()).length} rules · Edit`}</span>
            </button>

            {showRules && (
              <div className="flex flex-col gap-2 bg-muted/20 border border-border/50 rounded-xl p-3">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <input
                      value={rule}
                      onChange={(e) => setRules(prev => prev.map((r, j) => j === i ? e.target.value : r))}
                      className="flex-1 bg-muted/40 border border-border/60 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary transition-colors"
                      placeholder={`Rule ${i + 1}`}
                      maxLength={120}
                    />
                    <button
                      type="button"
                      onClick={() => setRules(prev => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {rules.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setRules(prev => [...prev, ""])}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors py-1 mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add rule
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!name.trim() || createMutation.isPending}
            className="w-full treffin-gradient text-white font-semibold py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed treffin-glow"
            data-testid="button-submit-create-community"
          >
            {createMutation.isPending ? "Creating..." : "Create Community"}
          </button>
        </form>
      </motion.div>
    </>
  );
}
