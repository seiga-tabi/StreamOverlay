import { useCallback, useEffect, useState } from "react";
import {
  getAccountSession,
  logoutAccount,
  type YoroAccountIdentity,
  type YoroAuthenticationProvider,
  type YoroAccountSession
} from "./api";

type AuthenticationIdentity = YoroAccountIdentity & {
  provider: YoroAuthenticationProvider;
};

export function authenticatedYoroIdentity(
  session: YoroAccountSession | undefined
): AuthenticationIdentity | undefined {
  if (!session?.authenticated) return undefined;
  const twitchIdentity = session.identities.find(
    (identity): identity is AuthenticationIdentity => identity.provider === "twitch"
  );
  if (twitchIdentity) return twitchIdentity;
  return session.identities.find(
    (identity): identity is AuthenticationIdentity => (
      identity.provider === session.authenticationProvider
    )
  );
}

export function useYoroAccountSession() {
  const [session, setSession] = useState<YoroAccountSession>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setLoading(true);
    try {
      setSession(await getAccountSession(signal));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // 계정 subsystem이 비활성인 배포에서는 기존 공개 Twitch 세션 UI를
      // 그대로 사용합니다.
      setSession(undefined);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const logout = useCallback(async (): Promise<boolean> => {
    if (!session?.authenticated) return false;
    await logoutAccount(session.csrfToken);
    setSession({ authenticated: false });
    return true;
  }, [session]);

  return {
    loading,
    logout,
    refresh,
    session
  } as const;
}
