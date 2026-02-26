/**
 * Static data for Academy Home dashboard: builder insights, templates, milestone ladder, next-action suggestions.
 * Connects to future UI; labels and links can be adjusted without DB changes.
 */

export const PATHWAY_LABELS: Record<string, string> = {
  starter: "Starter",
  builder: "Builder",
  scaler: "Scaler",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** Income milestone ladder (order matters). */
export const MILESTONE_LADDER = [
  { id: "define_niche", label: "Define niche", stage: "pre_revenue" },
  { id: "create_offer", label: "Create offer", stage: "first_offer" },
  { id: "land_first_client", label: "Land first client", stage: "first_client" },
  { id: "hit_1k", label: "Hit $1k", stage: "revenue_1k" },
  { id: "systemize", label: "Systemize", stage: "systemized" },
] as const;

/** Rotating builder insights (short, sharp, practical). */
export const BUILDER_INSIGHTS = [
  "Most beginners underprice by 30–50%.",
  "Niche specificity increases conversions.",
  "Recurring revenue improves stability.",
  "One clear offer beats three vague ones.",
  "Validate before you build.",
  "Systems scale; effort doesn't.",
  "First client is the hardest; it gets easier.",
  "Price on value, not time.",
  "Document once; reuse forever.",
  "Marketing is promise; delivery is proof.",
];

/** Templates & tools shortcut (high engagement). */
export const TEMPLATES_SHORTCUT = [
  { slug: "offer-builder", name: "Offer Builder Template", url: "/academy/templates/offer-builder" },
  { slug: "pricing-calculator", name: "Pricing Calculator", url: "/academy/tools/pricing-calculator" },
  { slug: "market-research", name: "Market Research Worksheet", url: "/academy/templates/market-research" },
  { slug: "revenue-tracker", name: "Revenue Tracker", url: "/academy/tools/revenue-tracker" },
];

/**
 * Next best action suggestions: label + optional lesson slug or template slug.
 * Backend will resolve lessonId from slug when returning; UI can link to lesson or template.
 */
export const NEXT_ACTION_SUGGESTIONS: { label: string; lessonSlug?: string; moduleSlug?: string; templateSlug?: string }[] = [
  { label: "Refine target market", moduleSlug: "foundations", lessonSlug: "choosing-a-niche" },
  { label: "Finalize pricing", moduleSlug: "offer-revenue", lessonSlug: "pricing-strategy" },
  { label: "Draft offer statement", moduleSlug: "offer-revenue", lessonSlug: "offer-creation" },
  { label: "Complete value proposition", moduleSlug: "offer-revenue", lessonSlug: "value-proposition" },
  { label: "Define your niche", moduleSlug: "foundations", lessonSlug: "choosing-a-niche" },
  { label: "Validate your idea", moduleSlug: "foundations", lessonSlug: "what-is-a-business" },
  { label: "Build your first offer", moduleSlug: "offer-revenue", lessonSlug: "offer-creation" },
  { label: "Set up content strategy", moduleSlug: "marketing-acquisition", lessonSlug: "content-strategy" },
  { label: "Document one process", moduleSlug: "operations", lessonSlug: "systems-sops" },
];

/** Map module slug to display category for dashboard cards. */
export const MODULE_CATEGORY: Record<string, { icon: string; tagline: string }> = {
  foundations: { icon: "🧠", tagline: "Define problem. Validate demand." },
  "offer-revenue": { icon: "💰", tagline: "Build something people pay for." },
  "branding-positioning": { icon: "📢", tagline: "Brand identity and messaging." },
  "marketing-acquisition": { icon: "📢", tagline: "Get attention & convert." },
  operations: { icon: "⚙", tagline: "Build systems that scale." },
  scaling: { icon: "🚀", tagline: "Leverage & expansion." },
};
