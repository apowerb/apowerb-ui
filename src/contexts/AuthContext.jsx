"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authStorage, authApi } from "@/lib/authStorage";
import { getAuthChallenge } from "@/extensions/registry";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Lazy initializers — read storage synchronously to avoid cascading setState in effects
  const [user, setUser] = useState(() => authStorage.getUser());
  const [token, setToken] = useState(() => authStorage.getToken());
  // Always start as loading to avoid SSR/client hydration mismatch.
  // The useEffect below will resolve the actual auth state on the client.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Defi d'authentification en cours — objet OPAQUE fourni par une brique.
  // Le noyau ne sait pas ce qu'il contient ; il le stocke et le passe au
  // composant que la brique a monte dans l'emplacement `auth.challenge`.
  // Sans brique, il reste toujours null.
  const [pendingChallenge, setPendingChallenge] = useState(null);

  // Verify token validity on mount (async — only updates state if needed)
  useEffect(() => {
    const verifyAuth = async () => {
      const storedUser = authStorage.getUser();
      const storedToken = authStorage.getToken();
      console.log("[AuthContext] verifyAuth:", { hasUser: !!storedUser, hasToken: !!storedToken });

      // No stored credentials — show login screen
      if (!storedUser || !storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        // Verify token is still valid and get fresh profile data
        const freshUser = await authApi.getProfile(storedToken);
        authStorage.setUser(freshUser);
        setUser(freshUser);
        setToken(storedToken);
      } catch {
        // Token expired — try to refresh using the HTTP-only refresh cookie
        try {
          const newToken = await authApi.refreshToken();
          const freshUser = await authApi.getProfile(newToken);
          authStorage.setUser(freshUser);
          authStorage.setToken(newToken);
          setUser(freshUser);
          setToken(newToken);
        } catch {
          // Refresh also failed — must re-login
          authStorage.clear();
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    verifyAuth();
  }, []);

  // Proactive token refresh — renew well before the 2h expiration
  useEffect(() => {
    if (!token) return;
    const REFRESH_INTERVAL = 90 * 60 * 1000; // 90 minutes
    const interval = setInterval(async () => {
      try {
        const newToken = await authApi.refreshToken();
        authStorage.setToken(newToken);
        setToken(newToken);
      } catch {
        // Will be handled on next API call
      }
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [token]);

  // Listen for unauthorized events from API
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      authStorage.clear();
      setError("Session expired, please sign in again");
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  // Login
  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authApi.login(email, password);

      // Reste-t-il une etape ? Le noyau ne le sait pas, il demande au registre.
      const defi = getAuthChallenge()?.(result) ?? null;
      if (defi) {
        setPendingChallenge(defi);
        setIsLoading(false);
        return { challengePending: true };
      }

      setUser(result.user);
      setToken(result.token);
      authStorage.setUser(result.user);
      authStorage.setToken(result.token);

      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // OAuth Login
  const oauthLogin = useCallback(async (provider, code, redirectUri) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authApi.oauthLogin(
        provider,
        code,
        redirectUri,
      );
      const defi = getAuthChallenge()?.(result) ?? null;
      if (defi) {
        setPendingChallenge(defi);
        setIsLoading(false);
        return { challengePending: true };
      }

      setUser(result.user);
      setToken(result.token);
      authStorage.setUser(result.user);
      authStorage.setToken(result.token);

      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Register
  const register = useCallback(async (userData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authApi.register(userData);
      if (result?.needsVerification) {
        return { needsVerification: true, email: result.email };
      }
      const { user: newUser, token: authToken } = result;

      setUser(newUser);
      setToken(authToken);
      authStorage.setUser(newUser);
      authStorage.setToken(authToken);

      return newUser;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setToken(null);
      authStorage.clear();
      setIsLoading(false);
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(
    async (updates) => {
      if (!user) throw new Error("Not authenticated");

      setIsLoading(true);
      setError(null);

      try {
        const updatedUser = await authApi.updateProfile(user.id, updates, token);
        const newUser = { ...user, ...updatedUser };

        setUser(newUser);
        authStorage.setUser(newUser);

        return newUser;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user, token],
  );

  // Upload avatar
  const uploadAvatar = useCallback(
    async (file) => {
      if (!user) throw new Error("Not authenticated");

      setIsLoading(true);
      setError(null);

      try {
        const avatarUrl = await authApi.uploadAvatar(user.id, file);
        const newUser = { ...user, avatar: avatarUrl };

        setUser(newUser);
        authStorage.setUser(newUser);

        return avatarUrl;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  // Conclut une connexion — appele par le noyau et par une brique qui vient de
  // resoudre son defi. Generique : le noyau n'a pas a savoir COMMENT le defi a
  // ete releve, seulement que l'utilisateur est authentifie.
  const completeLogin = useCallback((freshUser, authToken) => {
    setUser(freshUser);
    setToken(authToken);
    authStorage.setUser(freshUser);
    authStorage.setToken(authToken);
    setPendingChallenge(null);
    return freshUser;
  }, []);

  // Abandonne le defi en cours (retour a l'ecran de connexion).
  const clearChallenge = useCallback(() => {
    setPendingChallenge(null);
    setError(null);
  }, []);

  // Relit le profil depuis le backend (par ex. apres qu'une brique a change
  // un reglage de securite du compte).
  const refreshProfile = useCallback(async () => {
    if (!token) return;
    try {
      const freshUser = await authApi.getProfile(token);
      setUser(freshUser);
      authStorage.setUser(freshUser);
      return freshUser;
    } catch (err) {
      console.error("[AuthContext] Failed to refresh profile:", err);
    }
  }, [token]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    error,
    pendingChallenge,
    login,
    oauthLogin,
    register,
    logout,
    updateProfile,
    uploadAvatar,
    completeLogin,
    clearChallenge,
    setError,
    refreshProfile,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
