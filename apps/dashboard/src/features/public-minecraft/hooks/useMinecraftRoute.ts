import { useEffect, useState } from "react";
import { minecraftPageFromPath, MINECRAFT_ROUTE_EVENT } from "../utils/routes";

export function useMinecraftRoute() {
  const [locationRevision, setLocationRevision] = useState(0);

  useEffect(() => {
    const sync = () => setLocationRevision((revision) => revision + 1);
    window.addEventListener("popstate", sync);
    window.addEventListener(MINECRAFT_ROUTE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(MINECRAFT_ROUTE_EVENT, sync);
    };
  }, []);

  return {
    page: minecraftPageFromPath(window.location.pathname),
    locationRevision,
  };
}
