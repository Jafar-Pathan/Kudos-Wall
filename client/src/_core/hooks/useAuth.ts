import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useRef, useState } from "react";

const ACCESS_TOKEN_KEY = "kudos_access_token";

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const urlToken = url.searchParams.get("token");
    if (urlToken) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, urlToken);
      url.searchParams.delete("token");
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : "") + url.hash);
      return urlToken;
    }
  } catch {
    // Ignore URL parse error in non-standard environments
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

function isUnauthorized(error: unknown) {
  return error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED";
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/auth" } = options ?? {};
  const utils = trpc.useUtils();
  const [accessToken, setAccessToken] = useState<string | null>(() => getAccessToken());
  const initialAttempted = useRef(false);
  const recoveryAttempted = useRef(false);
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const refreshMutation = trpc.auth.refresh.useMutation({
    onSuccess: (result) => {
      storeAccessToken(result.accessToken);
      setAccessToken(result.accessToken);
      recoveryAttempted.current = false;
      utils.auth.me.setData(undefined, result.user);
      void utils.kudos.invalidate();
      void utils.leaderboard.invalidate();
      void utils.profile.invalidate();
    },
    onError: () => {
      storeAccessToken(null);
      setAccessToken(null);
      utils.auth.me.setData(undefined, null);
    },
  });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      storeAccessToken(null);
      setAccessToken(null);
      utils.auth.me.setData(undefined, null);
      void utils.kudos.invalidate();
      void utils.leaderboard.invalidate();
      void utils.profile.invalidate();
    },
  });
  const refresh = refreshMutation.mutate;

  useEffect(() => {
    if (initialAttempted.current || refreshMutation.isPending) return;
    if (!accessToken) {
      initialAttempted.current = true;
      refresh();
      return;
    }
    if (meQuery.isLoading) return;
    initialAttempted.current = true;
    if (isUnauthorized(meQuery.error)) {
      recoveryAttempted.current = true;
      refresh();
    }
  }, [accessToken, meQuery.error, meQuery.isLoading, refresh, refreshMutation.isPending]);

  useEffect(() => {
    if (!accessToken || !isUnauthorized(meQuery.error) || recoveryAttempted.current || refreshMutation.isPending) return;
    recoveryAttempted.current = true;
    refresh();
  }, [accessToken, meQuery.error, refresh, refreshMutation.isPending]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      storeAccessToken(null);
      setAccessToken(null);
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || refreshMutation.isPending || meQuery.isLoading) return;
    if (meQuery.data) return;
    if (typeof window === "undefined" || window.location.pathname === redirectPath) return;
    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, refreshMutation.isPending, meQuery.data, meQuery.isLoading]);

  return {
    user: meQuery.data ?? null,
    loading: meQuery.isLoading || refreshMutation.isPending || logoutMutation.isPending,
    error: meQuery.error ?? refreshMutation.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
    refresh: () => meQuery.refetch(),
    logout,
    accessToken,
  };
}
