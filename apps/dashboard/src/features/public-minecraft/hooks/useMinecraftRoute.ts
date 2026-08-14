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
    /* SSR(테스트 renderToStaticMarkup 포함)에는 location 이 없으므로 홈으로 간주합니다. */
    page: typeof window === "undefined" ? "home" : minecraftPageFromPath(window.location.pathname),
    locationRevision,
  };
}
