import { CompanyId } from "@/data/companies";
import { JapanFocusData } from "@/data/types";

/** Company-specific Japan Focus overrides keyed by companyId → domainId */
export const COMPANY_JAPAN_FOCUS: Record<string, Partial<JapanFocusData>> = {
  // Kodansha
  "kodansha:selfhood": {
    headline: "Kodansha's Identity Content Strategy",
    ceoInsight: "Kodansha's manga library isn't just entertainment — it's identity infrastructure. Millions of readers worldwide build their sense of self through your characters. That's a moat no competitor can replicate.",
  },
  "kodansha:community": {
    headline: "Kodansha's Community IP Ecosystem",
    ceoInsight: "Fan communities are Kodansha's most underleveraged asset. The shift from passive readership to active community — through events, creator programs, and digital forums — is the next revenue layer.",
  },
  // PERSOL
  "persol:work": {
    headline: "PERSOL's Workforce Transformation Mandate",
    ceoInsight: "PERSOL sits at the center of Japan's biggest structural shift — the end of lifetime employment. Your data on job-switching, reskilling, and work preferences is more valuable than any product you sell.",
  },
  // NTT East
  "ntt_east:community": {
    headline: "NTT East's Digital Community Infrastructure",
    ceoInsight: "NTT East's fiber network is the backbone of rural Japan's survival. The companies that connect depopulating communities — digitally and socially — will define Japan's next chapter.",
  },
  "ntt_east:aging": {
    headline: "NTT East's Elderly Connectivity Mission",
    ceoInsight: "92,000 centenarians need connected care. NTT East's telehealth and monitoring infrastructure isn't a side business — it's the core platform for Japan's aging future.",
  },
  // Kikkoman
  "kikkoman:environment": {
    headline: "Kikkoman's 300-Year Sustainability Story",
    ceoInsight: "Kikkoman has brewed soy sauce for three centuries — that's the ultimate sustainability credential. In an era where Gen Z demands authenticity, your heritage is your strongest marketing asset.",
  },
  "kikkoman:community": {
    headline: "Kikkoman's Food Community Strategy",
    ceoInsight: "Food is the world's most universal community builder. Kikkoman's investment in food community spaces and cooking education programs positions you as a cultural infrastructure company, not just a condiment maker.",
  },
  // Kirin
  "kirin:aging": {
    headline: "Kirin's Health Sciences Longevity Play",
    ceoInsight: "Kirin's pivot from beer to health sciences is visionary. Functional foods targeting cognitive health and longevity tap into the world's fastest-growing consumer segment — and Japan is the proof-of-concept market.",
  },
  "kirin:environment": {
    headline: "Kirin's Carbon-Neutral Brewing Leadership",
    ceoInsight: "Kirin achieving carbon-neutral brewing ahead of schedule proves sustainability and profitability aren't trade-offs. This positions you to export green brewing technology globally.",
  },
  // Nintendo
  "nintendo:selfhood": {
    headline: "Nintendo's Wellness Through Play",
    ceoInsight: "Nintendo's unique position — trusted by every generation — makes you the ideal platform for gamified wellness. Ring Fit Adventure was a proof point. The next step is cognitive health at scale.",
  },
  "nintendo:community": {
    headline: "Nintendo's Community-Through-Play Model",
    ceoInsight: "In the loneliness economy, Nintendo builds connection through shared play experiences. Animal Crossing during COVID proved games can be community infrastructure. That's a $20B opportunity.",
  },
  "nintendo:aging": {
    headline: "Nintendo's Cognitive Health Frontier",
    ceoInsight: "Brain Age was ahead of its time. With 92,000 centenarians in Japan and a global aging boom, Nintendo's gamified cognitive health platform could become the world's largest preventive care tool.",
  },
};
