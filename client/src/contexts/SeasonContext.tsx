import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Season = "SS26" | "W27";

interface SeasonContextValue {
  season: Season;
  setSeason: (s: Season) => void;
}

const SeasonContext = createContext<SeasonContextValue>({
  season: "W27",
  setSeason: () => {},
});

export function SeasonProvider({ children }: { children: ReactNode }) {
  // W27 is the current planning season and should be the landing view each
  // time SKU Dash opens. The switcher remains available for SS26 comparison
  // during the current visit.
  const [season, setSeasonState] = useState<Season>("W27");

  const setSeason = useCallback((s: Season) => {
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
