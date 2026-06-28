import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useUser } from "@clerk/react";
import { awardRepApi, type RepEventType } from "@/lib/award-rep";

const LABEL_TO_EVENT: Record<string, RepEventType> = {
  vote: "daily_question_voted",
  like: "post_liked",
  comment: "comment_posted",
  challenge: "weekly_challenge_won",
  post: "post_created",
  article: "article_created",
  debate: "debate_joined",
  community: "community_joined",
  save: "content_saved",
  profile: "profile_completed",
  long_comment: "long_comment",
};

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
  savedIds: Set<number>;
  savedItems: SavedItem[];
  toggleSaved: (item: SavedItem) => void;
  isSaved: (id: number) => boolean;
  removeSaved: (id: number) => void;

  repEvents: RepEvent[];
  triggerRep: (points: number, label: string) => void;
  sessionRep: number;

  showLevelUp: boolean;
  triggerLevelUp: () => void;
  dismissLevelUp: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useUser();

  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [repEvents, setRepEvents] = useState<RepEvent[]>([]);
  const [sessionRep, setSessionRep] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const toggleSaved = useCallback((item: SavedItem) => {
    if (savedIds.has(item.id)) {
      setSavedIds(p => { const s = new Set(p); s.delete(item.id); return s; });
      setSavedItems(p => p.filter(i => i.id !== item.id));
    } else {
      setSavedIds(p => new Set([...p, item.id]));
      setSavedItems(p => [{ ...item, time: "Just now" }, ...p]);
      if (isSignedIn) {
        const id = Date.now() + Math.random();
        const x = 40 + Math.random() * 20;
        setRepEvents(p => [...p, { id, points: 1, label: "save", x }]);
        setSessionRep(prev => prev + 1);
        setTimeout(() => setRepEvents(p => p.filter(e => e.id !== id)), 2200);
        awardRepApi("content_saved", "save");
      }
    }
  }, [savedIds, isSignedIn]);

  const isSaved = useCallback((id: number) => savedIds.has(id), [savedIds]);

  const removeSaved = useCallback((id: number) => {
    setSavedIds(p => { const s = new Set(p); s.delete(id); return s; });
    setSavedItems(p => p.filter(i => i.id !== id));
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

    const eventType = LABEL_TO_EVENT[label];
    if (eventType) {
      awardRepApi(eventType, label);
    }
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
