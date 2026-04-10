import { Domain, Mindset } from "./types";

export const DOMAINS: Domain[] = [
  { id: "work", label: "Work", description: "Workforce transformation, remote adoption, labor market shifts", icon: "Briefcase", color: "hsl(38, 90%, 55%)" },
  { id: "selfhood", label: "Selfhood", description: "Mental health, identity, personal development trends", icon: "User", color: "hsl(280, 75%, 62%)" },
  { id: "community", label: "Community", description: "Community rebuilding, social infrastructure, mutual aid", icon: "Users", color: "hsl(170, 70%, 48%)" },
  { id: "aging", label: "Aging", description: "Aging population, eldercare innovation, longevity economy", icon: "Heart", color: "hsl(14, 70%, 52%)" },
  { id: "environment", label: "Environment", description: "Climate adaptation, renewable energy, urban sustainability", icon: "Leaf", color: "hsl(140, 65%, 48%)" },
];

export const MINDSETS: Mindset[] = [
  { id: "cracks", label: "Finding Advantage in Cracks", shortLabel: "Cracks", description: "Spotting opportunity where systems break down" },
  { id: "reinvention", label: "Existential Reinvention", shortLabel: "Reinvention", description: "Transforming identity and purpose under pressure" },
  { id: "redefining", label: "Redefining Normal", shortLabel: "Redefine", description: "Challenging established norms to create new standards" },
  { id: "collective", label: "Enabling Collective Growth", shortLabel: "Collective", description: "Building shared resilience through cooperation" },
];
