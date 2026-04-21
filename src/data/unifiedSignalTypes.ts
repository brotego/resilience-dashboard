import { DomainId, MindsetId } from "./types";
import { GenZCategoryId } from "./genzTypes";

/**
 * A single unified signal type that replaces the separate
 * ResilienceSignal, GenZSignal, and NewsDot types.
 */
export interface UnifiedSignal {
  id: string;
  title: string;
  description: string;
  location: string;
  coordinates: [number, number];

  /** Source layer for visual differentiation */
  layer: "resilience" | "genz" | "live-news";

  /** Domain (for resilience signals) */
  domain?: DomainId;
  /** Category (for gen z signals) */
  category?: GenZCategoryId;

  /** Dynamic resilience exposure score (1-10) */
  resilienceScore: number;
  /** Derived urgency */
  urgency: "critical" | "high" | "medium" | "low";

  /** News source name */
  source?: string;
  /** Article author(s) when known (e.g. from NewsAPI.ai) */
  author?: string;
  /** Original article URL when available */
  articleUrl?: string;
  /** Full/partial article text from feed when available */
  articleContent?: string;
  /** ISO date string */
  date?: string;

  isJapan: boolean;

  /** Original mindset relevance (seed signals only) */
  mindsetRelevance?: Record<MindsetId, string>;
  /** Original insight text (genz seed signals only) */
  insight?: string;
}
