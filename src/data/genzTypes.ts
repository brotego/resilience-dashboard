export type GenZCategoryId = "authenticity" | "worklife" | "climate" | "digital" | "belonging";

export interface GenZSignal {
  id: string;
  category: GenZCategoryId;
  title: string;
  description: string;
  location: string;
  coordinates: [number, number];
  intensity: number;
  isJapan: boolean;
  insight: string;
}

export interface GenZCategory {
  id: GenZCategoryId;
  label: string;
  description: string;
  icon: string;
  color: string;
}
