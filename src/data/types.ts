export type DomainId = "work" | "selfhood" | "community" | "aging" | "environment";
export type MindsetId = "cracks" | "reinvention" | "redefining" | "collective";

export interface ResilienceSignal {
  id: string;
  domain: DomainId;
  title: string;
  description: string;
  location: string;
  coordinates: [number, number]; // [lng, lat]
  intensity: number; // 1-10
  isJapan: boolean;
  mindsetRelevance: Record<MindsetId, string>;
  source?: string;
  year?: number;
}

export interface Domain {
  id: DomainId;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export interface Mindset {
  id: MindsetId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface JapanFocusData {
  domain: DomainId;
  headline: string;
  stats: { label: string; value: string }[];
  trends: string[];
  ceoInsight: string;
}
