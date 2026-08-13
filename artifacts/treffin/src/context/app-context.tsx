import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useSession } from "@/lib/auth-client";
export type SavedItem = {
  id: number;
  type: "post" | "article" | "debate";
  title: string;
  excerpt: string;
  author: string;
  time: string;
  href: string;
};

export type RepEvent = { id: number; points: number; label: string; x: number };

interface AppContextType {
  savedIds: Set<string>;
  savedItems: SavedItem[];
  toggleSaved: (item: SavedItem) => void;
  isSaved: (id: number, type: SavedItem["type"]) => boolean;
  removeSaved: (id: number, type: SavedItem["type"]) => void;

  repEvents: RepEvent[];
  triggerRep: (points: number, label: string) => void;
  sessionRep: number;

  showLevelUp: boolean;
  triggerLevelUp: () => void;
  dismissLevelUp: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, user } = useSession();

  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [repEvents, setRepEvents] = useState<RepEvent[]>([]);
  const [sessionRep, setSessionRep] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [savedHydrated, setSavedHydrated] = useState(false);

  const savedStorageKey = user?.id ? "treffin_saved_items_" + user.id : null;

  useEffect(() => {
    setSavedHydrated(false);
    if (!savedStorageKey) {
      setSavedItems([]);
      setSavedIds(new Set());
      setSavedHydrated(true);
      return;
    }
    try {
      const parsed = JSON.parse(localStorage.getItem(savedStorageKey) ?? "[]") as SavedItem[];
      const valid = Array.isArray(parsed) ? parsed.filter((item) => item && Number.isInteger(item.id) && ["post", "article", "debate"].includes(item.type)) : [];
      setSavedItems(valid);
      setSavedIds(new Set(valid.map((item) => item.type + ":" + item.id)));
    } catch {
      setSavedItems([]);
      setSavedIds(new Set());
    }
    setSavedHydrated(true);
  }, [savedStorageKey]);

  useEffect(() => {
    if (savedHydrated && savedStorageKey) localStorage.setItem(savedStorageKey, JSON.stringify(savedItems));
  }, [savedHydrated, savedItems, savedStorageKey]);

  const toggleSaved = useCallback((item: SavedItem) => {
    const savedKey = item.type + ":" + item.id;
    if (savedIds.has(savedKey)) {
      setSavedIds(p => { const s = new Set(p); s.delete(savedKey); return s; });
      setSavedItems(p => p.filter(i => i.id !== item.id || i.type !== item.type));
    } else {
      setSavedIds(p => new Set([...p, savedKey]));
      setSavedItems(p => [{ ...item, time: "Just now" }, ...p]);
      if (isSignedIn) {
        const id = Date.now() + Math.random();
        const x = 40 + Math.random() * 20;
        setRepEvents(p => [...p, { id, points: 1, label: "save", x }]);
        setSessionRep(prev => prev + 1);
        setTimeout(() => setRepEvents(p => p.filter(e => e.id !== id)), 2200);
      }
    }
  }, [savedIds, isSignedIn]);

  const isSaved = useCallback((id: number, type: SavedItem["type"]) => savedIds.has(type + ":" + id), [savedIds]);

  const removeSaved = useCallback((id: number, type: SavedItem["type"]) => {
    const savedKey = type + ":" + id;
    setSavedIds(p => { const s = new Set(p); s.delete(savedKey); return s; });
    setSavedItems(p => p.filter(i => i.id !== id || i.type !== type));
  }, []);

  const triggerRep = useCallback((points: number, label: string) => {
    if (!isSignedIn) return;

    const id = Date.now() + Math.random();
    const x = 40 + Math.random() * 20;
    setRepEvents(p => [...p, { id, points, label, x }]);
    setSessionRep(prev => {
      const next = prev + points;
      if (prev < 150 && next >= 150) {
        setTimeout(() => setShowLevelUp(true), 600);
      }
      return next;
    });
    setTimeout(() => setRepEvents(p => p.filter(e => e.id !== id)), 2200);

  }, [isSignedIn]);

  const triggerLevelUp = useCallback(() => setShowLevelUp(true), []);
  const dismissLevelUp = useCallback(() => setShowLevelUp(false), []);

  return (
    <AppContext.Provider value={{
      savedIds, savedItems, toggleSaved, isSaved, removeSaved,
      repEvents, triggerRep, sessionRep,
      showLevelUp, triggerLevelUp, dismissLevelUp,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppContextProvider");
  return ctx;
}
