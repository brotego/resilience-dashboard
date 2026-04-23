import { supabase } from "@/integrations/supabase/client";

const SIGNAL_TABLE = "signal_bundle_cache";
const AI_TABLE = "ai_output_cache";

function reportSupabaseCacheDebug(event: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const payload = {
    at: new Date().toISOString(),
    ...event,
  };
  (window as unknown as { __rrSupabaseCacheDebug?: Record<string, unknown> }).__rrSupabaseCacheDebug = payload;
  if (import.meta.env.DEV) {
    console.debug("[rr-supabase-cache]", payload);
  }
}

function supabaseReady(): boolean {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  const ok = !!url && !!key;
  if (!ok) {
    reportSupabaseCacheDebug({
      op: "env_check",
      ok: false,
      missingUrl: !url,
      missingKey: !key,
      envUrlPresent: !!url,
      envAnonPresent: !!(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined),
      envPublishablePresent: !!(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined),
    });
  }
  return ok;
}

/** True when URL + anon/publishable key are present (shared signal bundle can be read/written). */
export function isSupabaseSignalBundleCacheConfigured(): boolean {
  return supabaseReady();
}

export type SignalBundleCacheRow<T> = {
  cache_key: string;
  company_id: string;
  mode: "resilience" | "genz";
  payload: T;
  signal_count: number;
  is_final: boolean;
  coverage_country_count: number;
  source_diversity_count: number;
  model_version: string;
  saved_at: string;
  expires_at: string;
};

export async function readSignalBundleCache<T>(params: {
  cacheKey: string;
  minSignals?: number;
  minCoverageCountries?: number;
}): Promise<{ data: T; savedAt: number; signalCount: number; isFinal: boolean } | null> {
  if (!supabaseReady()) return null;
  try {
    const minSignals = Math.max(0, params.minSignals ?? 0);
    const minCoverageCountries = Math.max(0, params.minCoverageCountries ?? 0);
    const nowIso = new Date().toISOString();

    const buildQuery = (requireFreshTtl: boolean) => {
      let q = supabase
        .from(SIGNAL_TABLE)
        .select("cache_key,payload,signal_count,is_final,saved_at,expires_at")
        .eq("cache_key", params.cacheKey)
        .order("is_final", { ascending: false })
        .order("saved_at", { ascending: false })
        .limit(1);
      if (requireFreshTtl) {
        q = q.gt("expires_at", nowIso);
      }
      if (minSignals > 0) {
        q = q.gte("signal_count", minSignals);
      }
      if (minCoverageCountries > 0) {
        q = q.gte("coverage_country_count", minCoverageCountries);
      }
      return q;
    };

    const pickRow = (rows: SignalBundleCacheRow<T>[], staleTtl: boolean) => {
      const row = rows[0];
      if (!row) return null;
      const savedAt = Date.parse(row.saved_at);
      if (!Number.isFinite(savedAt)) return null;
      reportSupabaseCacheDebug({
        op: "read_signal_bundle",
        ok: true,
        cacheKey: params.cacheKey,
        signalCount: row.signal_count || 0,
        isFinal: !!row.is_final,
        staleTtl,
      });
      return { data: row.payload, savedAt, signalCount: row.signal_count || 0, isFinal: !!row.is_final };
    };

    // Avoid maybeSingle(): duplicate cache_key rows (before UNIQUE migration) make PostgREST error and skip cache.
    const { data, error } = await buildQuery(true);
    if (!error) {
      const freshRow = pickRow((data ?? []) as SignalBundleCacheRow<T>[], false);
      if (freshRow) return freshRow;
    } else {
      reportSupabaseCacheDebug({
        op: "read_signal_bundle",
        ok: false,
        cacheKey: params.cacheKey,
        error: error.message,
        phase: "fresh_query",
      });
    }

    // Same cache_key but TTL passed — still hydrate so manual / older rows are usable; refetch can refresh TTL.
    const { data: staleData, error: staleErr } = await buildQuery(false);
    if (staleErr) {
      reportSupabaseCacheDebug({
        op: "read_signal_bundle",
        ok: false,
        cacheKey: params.cacheKey,
        error: staleErr.message,
        phase: "stale_fallback",
      });
      return null;
    }
    const staleRows = (staleData ?? []) as SignalBundleCacheRow<T>[];
    const staleRow = staleRows[0];
    if (!staleRow) {
      reportSupabaseCacheDebug({
        op: "read_signal_bundle",
        ok: false,
        cacheKey: params.cacheKey,
        error: "no_row",
      });
      return null;
    }
    const exp = Date.parse(staleRow.expires_at);
    const staleTtl = !Number.isFinite(exp) || exp <= Date.now();
    return pickRow(staleRows, staleTtl);
  } catch (err) {
    reportSupabaseCacheDebug({
      op: "read_signal_bundle",
      ok: false,
      cacheKey: params.cacheKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function writeSignalBundleCache<T>(params: {
  cacheKey: string;
  companyId: string;
  mode: "resilience" | "genz";
  payload: T;
  signalCount: number;
  isFinal: boolean;
  coverageCountryCount: number;
  sourceDiversityCount: number;
  modelVersion: string;
  ttlHours?: number;
}): Promise<boolean> {
  if (!supabaseReady()) return false;
  try {
    const ttlHours = Math.max(1, params.ttlHours ?? 24);
    const savedAt = new Date();
    const expiresAt = new Date(savedAt.getTime() + ttlHours * 60 * 60 * 1000);
    // Requires UNIQUE(cache_key) on public.signal_bundle_cache — see supabase/migrations/*signal_bundle_cache*.
    const { error } = await supabase.from(SIGNAL_TABLE).upsert(
      {
        cache_key: params.cacheKey,
        company_id: params.companyId,
        mode: params.mode,
        payload: params.payload,
        signal_count: params.signalCount,
        is_final: params.isFinal,
        coverage_country_count: params.coverageCountryCount,
        source_diversity_count: params.sourceDiversityCount,
        model_version: params.modelVersion,
        saved_at: savedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "cache_key", ignoreDuplicates: false },
    );
    if (error) {
      reportSupabaseCacheDebug({
        op: "write_signal_bundle",
        ok: false,
        cacheKey: params.cacheKey,
        companyId: params.companyId,
        mode: params.mode,
        signalCount: params.signalCount,
        isFinal: params.isFinal,
        error: error.message,
      });
      return false;
    }
    reportSupabaseCacheDebug({
      op: "write_signal_bundle",
      ok: true,
      cacheKey: params.cacheKey,
      companyId: params.companyId,
      mode: params.mode,
      signalCount: params.signalCount,
      isFinal: params.isFinal,
    });
    return true;
  } catch (err) {
    reportSupabaseCacheDebug({
      op: "write_signal_bundle",
      ok: false,
      cacheKey: params.cacheKey,
      companyId: params.companyId,
      mode: params.mode,
      signalCount: params.signalCount,
      isFinal: params.isFinal,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function readAiOutputCache<T>(params: {
  cacheKey: string;
}): Promise<{ data: T; savedAt: number } | null> {
  if (!supabaseReady()) return null;
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from(AI_TABLE)
      .select("payload,saved_at,expires_at")
      .eq("cache_key", params.cacheKey)
      .gt("expires_at", nowIso)
      .order("saved_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const savedAt = Date.parse(String((data as { saved_at?: string }).saved_at || ""));
    if (!Number.isFinite(savedAt)) return null;
    return { data: (data as { payload: T }).payload, savedAt };
  } catch {
    return null;
  }
}

export async function writeAiOutputCache<T>(params: {
  cacheKey: string;
  companyId: string;
  mode: "resilience" | "genz";
  artifactType: string;
  locale: string;
  model: string;
  promptHash: string;
  payload: T;
  ttlHours?: number;
}): Promise<boolean> {
  if (!supabaseReady()) return false;
  try {
    const ttlHours = Math.max(1, params.ttlHours ?? 24);
    const savedAt = new Date();
    const expiresAt = new Date(savedAt.getTime() + ttlHours * 60 * 60 * 1000);
    const { error } = await supabase.from(AI_TABLE).upsert(
      {
        cache_key: params.cacheKey,
        company_id: params.companyId,
        mode: params.mode,
        artifact_type: params.artifactType,
        locale: params.locale,
        model: params.model,
        prompt_hash: params.promptHash,
        payload: params.payload,
        saved_at: savedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "cache_key" },
    );
    return !error;
  } catch {
    return false;
  }
}
