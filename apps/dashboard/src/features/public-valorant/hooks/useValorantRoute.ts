import { useEffect, useState } from "react";
import { valorantPageFromPath, VALORANT_ROUTE_EVENT } from "../utils/routes";

export function useValorantRoute() {
  const [locationRevision, setLocationRevision] = useState(0);

  useEffect(() => {
    const sync = () => setLocationRevision((revision) => revision + 1);
    window.addEventListener("popstate", sync);
    window.addEventListener(VALORANT_ROUTE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(VALORANT_ROUTE_EVENT, sync);
    };
  }, []);

  return {
    page: valorantPageFromPath(window.location.pathname),
    locationRevision,
  };
}
