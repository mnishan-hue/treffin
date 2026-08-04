import { useState } from "react";
import { useCreateMathProblem, useListMathCategories, getListMathCategoriesQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { MathText } from "@/components/math/math-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getMathUserId } from "@/lib/math-auth";
import { LatexSymbolPicker } from "@/components/math/latex-symbol-picker";
import { Plus, X, Lightbulb } from "lucide-react";

export default function PostProblem() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProblem = useCreateMathProblem();

  const { data: categories } = useListMathCategories({ query: { queryKey: getListMathCategoriesQueryKey() } });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [hints, setHints] = useState<string[]>([]);
  const [hintInput, setHintInput] = useState("");

  const addHint = () => {
    const trimmed = hintInput.trim();
    if (!trimmed) return;
    setHints((prev) => [...prev, trimmed]);
    setHintInput("");
  };

  const removeHint = (idx: number) => {
    setHints((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !categoryId) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const userId = getMathUserId();
    if (!userId) {
      toast({ title: "Sign in required", description: "Please sign in to post a problem.", variant: "destructive" });
      return;
    }

    const hintsPayload = hints.length > 0 ? JSON.stringify(hints) : undefined;

    createProblem.mutate(
      { data: { title, body, categoryId: Number(categoryId), difficulty: difficulty as "beginner" | "intermediate" | "advanced" | "olympiad" | "research", hints: hintsPayload } },
      {
        onSuccess: (data) => {
          toast({ title: "Problem Posted", description: "Your problem has been published successfully." });
          queryClient.invalidateQueries();
          setLocation(`/math/problem/${data.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to post problem.", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-12 max-w-3xl">
      <div className="mb-10">
        <h1 className="text-2xl sm:text-4xl font-serif font-bold text-foreground mb-4">Post a Problem</h1>
        <p className="text-muted-foreground">Share an interesting mathematical problem with the community.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-card border border-border p-4 sm:p-8 rounded-xl shadow-sm">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Prove that $\sqrt{2}$ is irrational"
            className="bg-background text-lg py-6"
            required
          />
          {title && (
            <div className="pt-2 px-2 text-muted-foreground text-sm font-serif">
              Preview: <MathText text={title} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Category</label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select area of mathematics" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>{cat.icon} {cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Difficulty</label>
            <Select value={difficulty} onValueChange={setDifficulty} required>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="olympiad">Olympiad</SelectItem>
                <SelectItem value="research">Research</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="block text-sm font-medium">Problem Statement (LaTeX supported)</label>
            <LatexSymbolPicker onInsert={(latex) => setBody((prev) => prev + (prev && !prev.endsWith(" ") ? " " : "") + "$" + latex + "$")} />
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Use $$...$$ for display math and $...$ for inline math."
            className="min-h-[250px] bg-background font-mono text-sm leading-relaxed"
            required
          />
        </div>

        {body && (
          <div className="p-6 bg-background border border-border rounded-lg">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Live Preview</h4>
            <div className="font-serif prose prose-invert max-w-none text-foreground">
              <MathText text={body} />
            </div>
          </div>
        )}

        {/* Hints */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <label className="block text-sm font-medium">Hints <span className="text-muted-foreground font-normal">(optional — guide solvers without spoiling)</span></label>
          </div>

          {hints.length > 0 && (
            <div className="space-y-2">
              {hints.map((h, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold text-amber-500 mt-0.5 shrink-0">H{i + 1}</span>
                  <span className="text-sm flex-1 text-foreground">{h}</span>
                  <button
                    type="button"
                    onClick={() => removeHint(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={hintInput}
              onChange={(e) => setHintInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHint(); } }}
              placeholder="Add a hint (LaTeX supported)"
              className="bg-background text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={addHint} disabled={!hintInput.trim()}>
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
          {hints.length === 0 && (
            <p className="text-xs text-muted-foreground">Hints are revealed progressively to solvers who request them. Good hints nudge without giving away the answer.</p>
          )}
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <Button type="submit" size="lg" disabled={createProblem.isPending} className="px-8">
            {createProblem.isPending ? "Publishing..." : "Publish Problem"}
          </Button>
        </div>
      </form>
    </div>
  );
}
