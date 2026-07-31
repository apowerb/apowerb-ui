"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Module-level cache shared across all consumers — one fetch serves the whole app.
const _cache = {
  data: null,
  lastFetch: 0,
  inFlight: null,
  subscribers: new Set(),
};

const STALE_MS = 30_000;

function _notify() {
  _cache.subscribers.forEach((cb) => cb());
}

async function _doFetch() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("th2_auth_token")
      : null;
  const res = await fetch("/api/integrations/", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return _cache.data || [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function _fetchIntegrations(force = false) {
  if (!force && _cache.data && Date.now() - _cache.lastFetch < STALE_MS) {
    return _cache.data;
  }
  if (_cache.inFlight) return _cache.inFlight;
  _cache.inFlight = _doFetch()
    .then((data) => {
      _cache.data = data;
      _cache.lastFetch = Date.now();
      _notify();
      return data;
    })
    .finally(() => {
      _cache.inFlight = null;
    });
  return _cache.inFlight;
}

export function useIntegrations({ pollMs = 60_000 } = {}) {
  const [integrations, setIntegrations] = useState(_cache.data || []);
  const [loading, setLoading] = useState(_cache.data === null);

  useEffect(() => {
    let mounted = true;
    const update = () => {
      if (mounted) setIntegrations(_cache.data || []);
    };
    _cache.subscribers.add(update);

    _fetchIntegrations().finally(() => {
      if (mounted) setLoading(false);
    });

    const interval = pollMs
      ? setInterval(() => _fetchIntegrations(true), pollMs)
      : null;

    return () => {
      mounted = false;
      _cache.subscribers.delete(update);
      if (interval) clearInterval(interval);
    };
  }, [pollMs]);

  const byProvider = useMemo(() => {
    const map = {};
    integrations.forEach((i) => {
      map[i.provider] = i;
    });
    return map;
  }, [integrations]);

  const refetch = useCallback(() => _fetchIntegrations(true), []);

  return { integrations, byProvider, loading, refetch };
}
