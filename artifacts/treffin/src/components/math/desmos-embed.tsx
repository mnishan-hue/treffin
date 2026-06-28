import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3, X, ExternalLink } from "lucide-react";

interface DesmosEmbedProps {
  expression?: string;
  className?: string;
}

export function DesmosEmbed({ expression = "", className = "" }: DesmosEmbedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expr, setExpr] = useState(expression);

  const encodedExpr = encodeURIComponent(expr || "y=x^2");
  const desmosUrl = `https://www.desmos.com/calculator?embed`;

  return (
    <div className={className}>
      {!isOpen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-2 text-xs h-8 border-dashed border-primary/30 text-primary hover:bg-primary/10"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Open Desmos Visualizer
        </Button>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 border-b border-border">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Desmos Graphing Calculator</span>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href="https://www.desmos.com/calculator"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Open in Desmos"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3 border-b border-border bg-secondary/10">
            <label className="block text-xs text-muted-foreground mb-1">Expression (type to graph)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                placeholder="e.g. y=x^2+1, y=sin(x)"
                className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/60"
              />
              <a
                href={`https://www.desmos.com/calculator#${encodedExpr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-lg text-xs font-medium transition-colors"
              >
                Graph
              </a>
            </div>
          </div>

          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={desmosUrl}
              className="absolute inset-0 w-full h-full"
              allow="fullscreen"
              title="Desmos Graphing Calculator"
            />
          </div>

          <div className="px-3 py-2 text-[10px] text-muted-foreground/60 text-center bg-secondary/20">
            Powered by{" "}
            <a href="https://www.desmos.com" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground underline">
              Desmos
            </a>{" "}
            — enter expressions above and click Graph to load
          </div>
        </div>
      )}
    </div>
  );
}
