import { useState } from "react";
import { Button } from "@/components/ui/button";

const SYMBOL_GROUPS = [
  {
    label: "Greek",
    symbols: [
      { label: "α", latex: "\\alpha" },
      { label: "β", latex: "\\beta" },
      { label: "γ", latex: "\\gamma" },
      { label: "δ", latex: "\\delta" },
      { label: "ε", latex: "\\epsilon" },
      { label: "ζ", latex: "\\zeta" },
      { label: "η", latex: "\\eta" },
      { label: "θ", latex: "\\theta" },
      { label: "λ", latex: "\\lambda" },
      { label: "μ", latex: "\\mu" },
      { label: "π", latex: "\\pi" },
      { label: "ρ", latex: "\\rho" },
      { label: "σ", latex: "\\sigma" },
      { label: "τ", latex: "\\tau" },
      { label: "φ", latex: "\\phi" },
      { label: "χ", latex: "\\chi" },
      { label: "ψ", latex: "\\psi" },
      { label: "ω", latex: "\\omega" },
      { label: "Γ", latex: "\\Gamma" },
      { label: "Δ", latex: "\\Delta" },
      { label: "Θ", latex: "\\Theta" },
      { label: "Λ", latex: "\\Lambda" },
      { label: "Σ", latex: "\\Sigma" },
      { label: "Φ", latex: "\\Phi" },
      { label: "Ψ", latex: "\\Psi" },
      { label: "Ω", latex: "\\Omega" },
    ],
  },
  {
    label: "Operators",
    symbols: [
      { label: "∑", latex: "\\sum_{i=1}^{n}" },
      { label: "∏", latex: "\\prod_{i=1}^{n}" },
      { label: "∫", latex: "\\int_{a}^{b}" },
      { label: "∬", latex: "\\iint" },
      { label: "∮", latex: "\\oint" },
      { label: "lim", latex: "\\lim_{x \\to }" },
      { label: "d/dx", latex: "\\frac{d}{dx}" },
      { label: "∂", latex: "\\partial" },
      { label: "∇", latex: "\\nabla" },
      { label: "√", latex: "\\sqrt{}" },
      { label: "∛", latex: "\\sqrt[3]{}" },
      { label: "⌊⌋", latex: "\\lfloor \\rfloor" },
      { label: "⌈⌉", latex: "\\lceil \\rceil" },
      { label: "|·|", latex: "\\left| \\right|" },
      { label: "‖·‖", latex: "\\|\\|" },
    ],
  },
  {
    label: "Relations",
    symbols: [
      { label: "≤", latex: "\\leq" },
      { label: "≥", latex: "\\geq" },
      { label: "≠", latex: "\\neq" },
      { label: "≈", latex: "\\approx" },
      { label: "≡", latex: "\\equiv" },
      { label: "∼", latex: "\\sim" },
      { label: "∝", latex: "\\propto" },
      { label: "⊂", latex: "\\subset" },
      { label: "⊃", latex: "\\supset" },
      { label: "⊆", latex: "\\subseteq" },
      { label: "∈", latex: "\\in" },
      { label: "∉", latex: "\\notin" },
      { label: "∩", latex: "\\cap" },
      { label: "∪", latex: "\\cup" },
      { label: "⊕", latex: "\\oplus" },
      { label: "⊗", latex: "\\otimes" },
    ],
  },
  {
    label: "Arrows",
    symbols: [
      { label: "→", latex: "\\to" },
      { label: "←", latex: "\\leftarrow" },
      { label: "↔", latex: "\\leftrightarrow" },
      { label: "⇒", latex: "\\Rightarrow" },
      { label: "⇔", latex: "\\Leftrightarrow" },
      { label: "↦", latex: "\\mapsto" },
      { label: "↑", latex: "\\uparrow" },
      { label: "↓", latex: "\\downarrow" },
    ],
  },
  {
    label: "Sets & Logic",
    symbols: [
      { label: "ℝ", latex: "\\mathbb{R}" },
      { label: "ℤ", latex: "\\mathbb{Z}" },
      { label: "ℕ", latex: "\\mathbb{N}" },
      { label: "ℚ", latex: "\\mathbb{Q}" },
      { label: "ℂ", latex: "\\mathbb{C}" },
      { label: "∅", latex: "\\emptyset" },
      { label: "∞", latex: "\\infty" },
      { label: "∀", latex: "\\forall" },
      { label: "∃", latex: "\\exists" },
      { label: "¬", latex: "\\neg" },
      { label: "∧", latex: "\\land" },
      { label: "∨", latex: "\\lor" },
    ],
  },
  {
    label: "Structures",
    symbols: [
      { label: "a/b", latex: "\\frac{a}{b}" },
      { label: "a^n", latex: "^{}" },
      { label: "a_n", latex: "_{}" },
      { label: "C(n,k)", latex: "\\binom{n}{k}" },
      { label: "matrix", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
      { label: "cases", latex: "\\begin{cases} a & \\text{if } \\\\ b & \\text{otherwise} \\end{cases}" },
      { label: "align", latex: "\\begin{align}\n  & \\\\\n  &\n\\end{align}" },
      { label: "vec", latex: "\\vec{}" },
      { label: "hat", latex: "\\hat{}" },
      { label: "bar", latex: "\\bar{}" },
      { label: "dot", latex: "\\dot{}" },
      { label: "tilde", latex: "\\tilde{}" },
    ],
  },
];

interface LatexSymbolPickerProps {
  onInsert: (latex: string, wrapInMath?: boolean) => void;
}

export function LatexSymbolPicker({ onInsert }: LatexSymbolPickerProps) {
  const [activeGroup, setActiveGroup] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1 font-mono text-base leading-none px-2 h-8"
        title="Insert LaTeX symbol"
      >
        Σ <span className="text-xs font-sans">symbols</span>
      </Button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-50 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden" style={{ width: "min(320px, calc(100vw - 32px))" }}>
          <div className="flex overflow-x-auto border-b border-border bg-secondary/30">
            {SYMBOL_GROUPS.map((g, i) => (
              <button
                key={g.label}
                onClick={() => setActiveGroup(i)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeGroup === i ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="p-2 grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
            {SYMBOL_GROUPS[activeGroup].symbols.map((s) => (
              <button
                key={s.latex}
                onClick={() => {
                  onInsert(s.latex, false);
                  setOpen(false);
                }}
                className="h-9 w-full rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-sm font-serif flex items-center justify-center border border-transparent hover:border-primary/20"
                title={`Insert: $${s.latex}$`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground/60 bg-secondary/20">
            Symbols are wrapped in <code className="font-mono text-[10px]">$...$</code> inline math
          </div>
        </div>
      )}
    </div>
  );
}
