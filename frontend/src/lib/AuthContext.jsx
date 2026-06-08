import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore, formatApiError } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [error, setError] = useState("");

  const fetchMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      tokenStore.set(data.token);
      setUser(data.user);
      return data.user;
    } catch (e) {
      const msg = formatApiError(e);
      setError(msg);
      throw new Error(msg);
    }
  };

  const register = async (payload) => {
    setError("");
    try {
      const { data } = await api.post("/auth/register", payload);
      tokenStore.set(data.token);
      setUser(data.user);
      return data.user;
    } catch (e) {
      const msg = formatApiError(e);
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (_) {}
    tokenStore.clear();
    setUser(null);
  };

  const refreshUser = fetchMe;

  return (
    <AuthContext.Provider value={{ user, login, register, logout, error, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
