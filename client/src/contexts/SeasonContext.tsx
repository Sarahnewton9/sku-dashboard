import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Season = "SS26" | "W27";

const SEASON_STORAGE_KEY = "sku_dash_active_season";

interface SeasonContextValue {
  season: Season;
  setSeason: (s: Season) => void;
}

const SeasonContext = createContext<SeasonContextValue>({
  season: "SS26",
  setSeason: () => {},
});

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [season, setSeasonState] = useState<Season>(() => {
    const saved = localStorage.getItem(SEASON_STORAGE_KEY);
    return (saved === "W27" ? "W27" : "SS26") as Season;
  });

  const setSeason = useCallback((s: Season) => {
    localStorage.setItem(SEASON_STORAGE_KEY, s);
    setSeasonState(s);
  }, []);

  return (
    <SeasonContext.Provider value={{ season, setSeason }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  return useContext(SeasonContext);
}
