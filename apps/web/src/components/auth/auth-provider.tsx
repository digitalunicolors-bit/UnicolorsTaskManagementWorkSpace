'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  AuthUser,
  LoginInput,
} from '@/types/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;

  login: (
    input: LoginInput,
  ) => Promise<AuthUser>;

  logout: () => Promise<void>;

  logoutAll: () => Promise<void>;

  refreshSession: () => Promise<
    string | null
  >;

  authFetch: (
    path: string,
    init?: RequestInit,
  ) => Promise<Response>;

  hasPermission: (
    permission: string,
  ) => boolean;

  hasRole: (
    role: string,
  ) => boolean;
}

const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  );

async function getErrorMessage(
  response: Response,
) {
  try {
    const data = await response.json();

    if (Array.isArray(data?.message)) {
      return data.message.join(', ');
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }
  } catch {
    // Ignore malformed JSON.
  }

  return 'Something went wrong.';
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [accessToken, setAccessToken] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const refreshInFlight =
    useRef<Promise<string | null> | null>(
      null,
    );

  const refreshSession =
    useCallback(async () => {
      if (refreshInFlight.current) {
        return refreshInFlight.current;
      }

      const refreshPromise =
        (async (): Promise<
          string | null
        > => {
          try {
            const response = await fetch(
              `${API_URL}/auth/refresh`,
              {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type':
                    'application/json',
                },
              },
            );

            if (!response.ok) {
              setUser(null);
              setAccessToken(null);
              return null;
            }

            const data =
              await response.json();

            setUser(data.user);
            setAccessToken(
              data.accessToken,
            );

            return data.accessToken;
          } catch {
            setUser(null);
            setAccessToken(null);

            return null;
          }
        })();

      refreshInFlight.current =
        refreshPromise;

      try {
        return await refreshPromise;
      } finally {
        refreshInFlight.current = null;
      }
    }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      await refreshSession();

      if (mounted) {
        setIsLoading(false);
      }
    };

    void initializeAuth();

    return () => {
      mounted = false;
    };
  }, [refreshSession]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(input),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        );
      }

      const data = await response.json();

      setUser(data.user);
      setAccessToken(data.accessToken);

      return data.user as AuthUser;
    },
    [],
  );

  const authFetch = useCallback(
    async (
      path: string,
      init: RequestInit = {},
    ) => {
      const execute = async (
        token: string | null,
      ) => {
        const headers = new Headers(
          init.headers,
        );

        if (token) {
          headers.set(
            'Authorization',
            `Bearer ${token}`,
          );
        }

        return fetch(
          `${API_URL}${path}`,
          {
            ...init,
            headers,
            credentials: 'include',
          },
        );
      };

      let response = await execute(
        accessToken,
      );

      if (response.status === 401) {
        const newToken =
          await refreshSession();

        if (newToken) {
          response =
            await execute(newToken);
        }
      }

      return response;
    },
    [
      accessToken,
      refreshSession,
    ],
  );

  const logout = useCallback(
    async () => {
      try {
        await fetch(
          `${API_URL}/auth/logout`,
          {
            method: 'POST',
            credentials: 'include',
          },
        );
      } finally {
        setUser(null);
        setAccessToken(null);
      }
    },
    [],
  );

  const logoutAll = useCallback(
    async () => {
      try {
        await authFetch(
          '/auth/logout-all',
          {
            method: 'POST',
          },
        );
      } finally {
        setUser(null);
        setAccessToken(null);
      }
    },
    [authFetch],
  );

  const hasPermission =
    useCallback(
      (permission: string) =>
        user?.permissions.includes(
          permission,
        ) ?? false,
      [user],
    );

  const hasRole = useCallback(
    (role: string) =>
      user?.roles.includes(role) ??
      false,
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isLoading,
      login,
      logout,
      logoutAll,
      refreshSession,
      authFetch,
      hasPermission,
      hasRole,
    }),
    [
      user,
      accessToken,
      isLoading,
      login,
      logout,
      logoutAll,
      refreshSession,
      authFetch,
      hasPermission,
      hasRole,
    ],
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.',
    );
  }

  return context;
}