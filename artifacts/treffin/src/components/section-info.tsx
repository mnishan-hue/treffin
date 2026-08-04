import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, X } from "lucide-react";

interface SectionInfoProps {
  title: string;
  description: string;
  icon?: string;            // emoji
  accent?: string;          // tailwind gradient classes
}

export function SectionInfo({ title, description, icon, accent = "from-indigo-500 to-violet-600" }: SectionInfoProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`About ${title}`}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60 transition-all"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="si-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-6"
            style={{ background: "rgba(5,8,18,0.6)", backdropFilter: "blur(10px)" }}
            onClick={close}
          >
            <motion.div
              key="si-card"
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 6 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="relative w-full max-w-xs rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(150deg, hsl(220 52% 10%), hsl(220 52% 8%))",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Soft gradient glow */}
              <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${accent} blur-[56px] opacity-20 pointer-events-none`} />

              <div className="relative p-5">
                {/* Close */}
                <button
                  onClick={close}
                  className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/8 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Icon + title */}
                <div className="flex items-center gap-2.5 mb-3 pr-6">
                  {icon && (
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-base shrink-0 shadow-md`}>
                      {icon}
                    </div>
                  )}
                  <p className="font-bold text-[15px] text-white/90 leading-snug">{title}</p>
                </div>

                {/* Description */}
                <p className="text-[13px] leading-relaxed text-white/55">{description}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
