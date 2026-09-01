import { useEffect, useState } from "react";
import {
  STREAMERS_ROUTE_EVENT,
  streamerPostIdFromPath,
  streamerOfficialProfileFromPath,
  streamerScopeFromSearch,
  streamersPageFromPath,
} from "../utils/routes";

export function useStreamersRoute() {
  const [locationRevision, setLocationRevision] = useState(0);

  useEffect(() => {
    const sync = () => setLocationRevision((revision) => revision + 1);
    window.addEventListener("popstate", sync);
    window.addEventListener(STREAMERS_ROUTE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(STREAMERS_ROUTE_EVENT, sync);
    };
  }, []);

  return {
    page: streamersPageFromPath(window.location.pathname),
    postId: streamerPostIdFromPath(window.location.pathname),
    officialProfile: streamerOfficialProfileFromPath(window.location.pathname),
    scope: streamerScopeFromSearch(window.location.search),
    locationRevision,
  };
}
