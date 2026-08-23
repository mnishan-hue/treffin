import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useSession } from "@/lib/auth-client";
import { getGetCurrentUserQueryKey, getGetReputationQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
  levelUpTitle: string | null;
  triggerLevelUp: (title?: string) => void;
  dismissLevelUp: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, user } = useSession();
  const queryClient = useQueryClient();
  const { data: currentUser } = useGetCurrentUser({
    query: {
      enabled: !!isSignedIn,
      queryKey: getGetCurrentUserQueryKey(),
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  });

  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [repEvents, setRepEvents] = useState<RepEvent[]>([]);
  const [sessionRep, setSessionRep] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [savedHydrated, setSavedHydrated] = useState(false);
  const [levelUpTitle, setLevelUpTitle] = useState<string | null>(null);

  const previousProfileRef = useRef<{ userId: string; score: number; title: string } | null>(null);
  const pendingRepLabelRef = useRef("reputation");
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
    }
  }, [savedIds]);

  const isSaved = useCallback((id: number, type: SavedItem["type"]) => savedIds.has(type + ":" + id), [savedIds]);

  const removeSaved = useCallback((id: number, type: SavedItem["type"]) => {
    const savedKey = type + ":" + id;
    setSavedIds(p => { const s = new Set(p); s.delete(savedKey); return s; });
    setSavedItems(p => p.filter(i => i.id !== id || i.type !== type));
  }, []);

  const triggerRep = useCallback((_points: number, label: string) => {
    if (!isSignedIn) return;
    pendingRepLabelRef.current = label;
    void queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetReputationQueryKey() });
    window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetReputationQueryKey() });
    }, 750);
  }, [isSignedIn, queryClient]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      previousProfileRef.current = null;
      setSessionRep(0);
      return;
    }
    if (!currentUser) return;

    const next = { userId, score: currentUser.reputationScore, title: currentUser.title };
    const previous = previousProfileRef.current;
    if (!previous || previous.userId !== userId) {
      previousProfileRef.current = next;
      setSessionRep(0);
      return;
    }

    const gained = next.score - previous.score;
    if (gained > 0) {
      const id = Date.now() + Math.random();
      const x = 40 + Math.random() * 20;
      setRepEvents(events => [...events, { id, points: gained, label: pendingRepLabelRef.current, x }]);
      setSessionRep(total => total + gained);
      window.setTimeout(() => setRepEvents(events => events.filter(event => event.id !== id)), 2200);
    }

    const ranks = ["Novice", "Thinker", "Scholar", "Intellectual", "Elite Thinker"];
    const previousRank = ranks.indexOf(previous.title);
    const nextRank = ranks.indexOf(next.title);
    if (previousRank >= 0 && nextRank > previousRank) {
      setLevelUpTitle(next.title);
      window.setTimeout(() => setShowLevelUp(true), 600);
    }
    previousProfileRef.current = next;
  }, [currentUser, user?.id]);

  const triggerLevelUp = useCallback((title = currentUser?.title ?? "Thinker") => {
    setLevelUpTitle(title);
    setShowLevelUp(true);
  }, [currentUser?.title]);
  const dismissLevelUp = useCallback(() => {
    setShowLevelUp(false);
    setLevelUpTitle(null);
  }, []);

  return (
    <AppContext.Provider value={{
      savedIds, savedItems, toggleSaved, isSaved, removeSaved,
      repEvents, triggerRep, sessionRep,
      showLevelUp, levelUpTitle, triggerLevelUp, dismissLevelUp,
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
