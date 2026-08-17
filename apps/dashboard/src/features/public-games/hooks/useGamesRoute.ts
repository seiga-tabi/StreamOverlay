import { useEffect, useState } from "react";
import { gamesPageFromPath, gamesShareIdFromPath, GAMES_ROUTE_EVENT } from "../utils/routes";

export function useGamesRoute() {
  const [locationRevision, setLocationRevision] = useState(0);

  useEffect(() => {
    const sync = () => setLocationRevision((revision) => revision + 1);
    window.addEventListener("popstate", sync);
    window.addEventListener(GAMES_ROUTE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(GAMES_ROUTE_EVENT, sync);
    };
  }, []);

  return {
    page: gamesPageFromPath(window.location.pathname),
    shareId: gamesShareIdFromPath(window.location.pathname),
    locationRevision,
  };
}
