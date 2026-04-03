"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(url: string, pollInterval?: number): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Request failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();

    if (pollInterval && pollInterval > 0) {
      intervalRef.current = setInterval(() => fetchData(true), pollInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, pollInterval]);

  return { data, loading, error, refetch: () => fetchData() };
}
