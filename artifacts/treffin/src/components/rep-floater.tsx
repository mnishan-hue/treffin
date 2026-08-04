import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/app-context";
import { Zap } from "lucide-react";

export function RepFloater() {
  const { repEvents } = useAppContext();

  return (
    <div className="fixed bottom-6 right-6 z-[100] pointer-events-none flex flex-col-reverse gap-2">
      <AnimatePresence>
        {repEvents.map(event => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-1.5 bg-primary/90 backdrop-blur-sm text-white font-bold text-sm px-3 py-1.5 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)] border border-primary/50"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            +{event.points} rep
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
