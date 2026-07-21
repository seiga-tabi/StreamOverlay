import { useEffect, useState } from "react";
import { PALWORLD_ROUTE_EVENT, palworldPageFromPath } from "../utils/routes";

export function usePalworldRoute() {
  const [locationRevision, setLocationRevision] = useState(0);

  useEffect(() => {
    const sync = () => setLocationRevision((revision) => revision + 1);
    window.addEventListener("popstate", sync);
    window.addEventListener(PALWORLD_ROUTE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(PALWORLD_ROUTE_EVENT, sync);
    };
  }, []);

  return {
    page: palworldPageFromPath(window.location.pathname),
    params: new URLSearchParams(window.location.search),
    locationRevision,
  };
}
