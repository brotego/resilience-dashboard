import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "@/i18n/translations";
import type { UnifiedSignal } from "@/data/unifiedSignalTypes";
import {
  ensureJapaneseSeedUiMap,
  loadJapaneseSeedUiFromSession,
  type UiJapaneseFields,
} from "@/api/translateJapaneseUi";

type JpUiContextValue = {
  seedJpMap: Record<string, UiJapaneseFields>;
  seedJpLoading: boolean;
  /** Display fields for a signal when JP is active (falls back to English). */
  getSignalDisplay: (signal: UnifiedSignal) => {
    title: string;
    description: string;
    location: string;
    insight?: string;
  };
};

const JpUiContext = createContext<JpUiContextValue | null>(null);

export function JpUiProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const [seedJpMap, setSeedJpMap] = useState<Record<string, UiJapaneseFields>>(() =>
    lang === "jp" ? loadJapaneseSeedUiFromSession() : {},
  );
  const [seedJpLoading, setSeedJpLoading] = useState(false);

  useEffect(() => {
    if (lang !== "jp") {
      setSeedJpMap({});
      setSeedJpLoading(false);
      return;
    }

    const session = loadJapaneseSeedUiFromSession();
    if (Object.keys(session).length > 0) {
      setSeedJpMap(session);
    }

    let cancelled = false;
    setSeedJpLoading(true);
    ensureJapaneseSeedUiMap()
      .then((map) => {
        if (!cancelled) setSeedJpMap(map);
      })
      .finally(() => {
        if (!cancelled) setSeedJpLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const getSignalDisplay = useCallback(
    (signal: UnifiedSignal) => {
      if (lang !== "jp") {
        return {
          title: signal.title,
          description: signal.description,
          location: signal.location,
          ...(signal.insight ? { insight: signal.insight } : {}),
        };
      }
      const o = seedJpMap[signal.id];
      if (!o) {
        return {
          title: signal.title,
          description: signal.description,
          location: signal.location,
          ...(signal.insight ? { insight: signal.insight } : {}),
        };
      }
      return {
        title: o.title || signal.title,
        description: o.description || signal.description,
        location: o.location || signal.location,
        ...(o.insight || signal.insight ? { insight: o.insight || signal.insight } : {}),
      };
    },
    [lang, seedJpMap],
  );

  const value = useMemo(
    () => ({
      seedJpMap,
      seedJpLoading,
      getSignalDisplay,
    }),
    [seedJpMap, seedJpLoading, getSignalDisplay],
  );

  return <JpUiContext.Provider value={value}>{children}</JpUiContext.Provider>;
}

export function useJpUi(): JpUiContextValue {
  const ctx = useContext(JpUiContext);
  if (!ctx) {
    return {
      seedJpMap: {},
      seedJpLoading: false,
      getSignalDisplay: (signal: UnifiedSignal) => ({
        title: signal.title,
        description: signal.description,
        location: signal.location,
        ...(signal.insight ? { insight: signal.insight } : {}),
      }),
    };
  }
  return ctx;
}
