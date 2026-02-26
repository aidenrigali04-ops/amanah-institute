import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const MODULES = [
  {
    slug: "foundations",
    title: "Foundations",
    description: "What is a business and how to find opportunities",
    orderIndex: 0,
    lessons: [
      { slug: "what-is-a-business", title: "What is a Business", durationMinutes: 10, orderIndex: 0 },
      { slug: "finding-pain-points", title: "Finding Pain Points", durationMinutes: 15, orderIndex: 1 },
      { slug: "market-research", title: "Market Research", durationMinutes: 20, orderIndex: 2 },
      { slug: "choosing-a-niche", title: "Choosing a Niche", durationMinutes: 15, orderIndex: 3 },
    ],
  },
  {
    slug: "offer-revenue",
    title: "Offer & Revenue",
    description: "Create offers and price for value",
    orderIndex: 1,
    lessons: [
      { slug: "offer-creation", title: "Offer Creation", durationMinutes: 20, orderIndex: 0 },
      { slug: "pricing-strategy", title: "Pricing Strategy", durationMinutes: 15, orderIndex: 1 },
      { slug: "value-proposition", title: "Value Proposition", durationMinutes: 10, orderIndex: 2 },
      { slug: "sales-basics", title: "Sales Basics", durationMinutes: 25, orderIndex: 3 },
    ],
  },
  {
    slug: "branding-positioning",
    title: "Branding & Positioning",
    description: "Brand identity and messaging",
    orderIndex: 2,
    lessons: [
      { slug: "brand-identity", title: "Brand Identity", durationMinutes: 15, orderIndex: 0 },
      { slug: "messaging", title: "Messaging", durationMinutes: 15, orderIndex: 1 },
      { slug: "unique-value-proposition", title: "Unique Value Proposition", durationMinutes: 10, orderIndex: 2 },
      { slug: "authority-building", title: "Authority Building", durationMinutes: 20, orderIndex: 3 },
    ],
  },
  {
    slug: "marketing-acquisition",
    title: "Marketing & Customer Acquisition",
    description: "Content, funnels, and ethical sales",
    orderIndex: 3,
    lessons: [
      { slug: "content-strategy", title: "Content Strategy", durationMinutes: 20, orderIndex: 0 },
      { slug: "funnel-basics", title: "Funnel Basics", durationMinutes: 25, orderIndex: 1 },
      { slug: "ethical-sales", title: "Ethical Sales", durationMinutes: 15, orderIndex: 2 },
      { slug: "conversion-strategy", title: "Conversion Strategy", durationMinutes: 20, orderIndex: 3 },
    ],
  },
  {
    slug: "operations",
    title: "Operations",
    description: "Systems, delivery, and financial tracking",
    orderIndex: 4,
    lessons: [
      { slug: "systems-sops", title: "Systems & SOPs", durationMinutes: 20, orderIndex: 0 },
      { slug: "client-delivery", title: "Client Delivery", durationMinutes: 15, orderIndex: 1 },
      { slug: "financial-tracking", title: "Financial Tracking", durationMinutes: 20, orderIndex: 2 },
    ],
  },
  {
    slug: "scaling",
    title: "Scaling",
    description: "Hiring, leverage, and capital allocation",
    orderIndex: 5,
    lessons: [
      { slug: "hiring", title: "Hiring", durationMinutes: 25, orderIndex: 0 },
      { slug: "leverage", title: "Leverage", durationMinutes: 15, orderIndex: 1 },
      { slug: "capital-allocation", title: "Capital Allocation", durationMinutes: 20, orderIndex: 2 },
    ],
  },
];

const CHANNELS = [
  { slug: "business-general", name: "Business", description: "General business discussion", type: "business", level: null, orderIndex: 0 },
  { slug: "business-beginner", name: "Business – Beginner", description: "New to business", type: "business", level: "beginner", orderIndex: 1 },
  { slug: "business-advanced", name: "Business – Advanced", description: "Scaling and operations", type: "business", level: "advanced", orderIndex: 2 },
  { slug: "investing-general", name: "Investing", description: "Halal investing discussion", type: "investing", level: null, orderIndex: 3 },
  { slug: "investing-beginner", name: "Investing – Beginner", description: "Getting started", type: "investing", level: "beginner", orderIndex: 4 },
  { slug: "investing-advanced", name: "Investing – Advanced", description: "Portfolio and strategy", type: "investing", level: "advanced", orderIndex: 5 },
  { slug: "accountability", name: "Weekly Accountability", description: "Weekly check-ins", type: "accountability", level: null, orderIndex: 6 },
  { slug: "announcements", name: "Announcements", description: "Platform updates", type: "announcements", level: null, orderIndex: 7 },
];

const HALAL_SYMBOLS = [
  { symbol: "SPUS", name: "SP Funds S&P 500 Sharia Industry Exclusions ETF", assetType: "etf" },
  { symbol: "HLAL", name: "Wahed FTSE USA Shariah ETF", assetType: "etf" },
  { symbol: "AAPL", name: "Apple Inc", assetType: "stock" },
  { symbol: "MSFT", name: "Microsoft Corporation", assetType: "stock" },
  { symbol: "GOOGL", name: "Alphabet Inc (Google)", assetType: "stock" },
  { symbol: "AMZN", name: "Amazon.com Inc", assetType: "stock" },
];

async function main() {
  for (const mod of MODULES) {
    const { lessons, ...moduleData } = mod;
    const created = await prisma.academyModule.upsert({
      where: { slug: mod.slug },
      create: moduleData,
      update: { title: moduleData.title, description: moduleData.description, orderIndex: moduleData.orderIndex },
    });
    for (const l of lessons) {
      await prisma.academyLesson.upsert({
        where: {
          moduleId_slug: { moduleId: created.id, slug: l.slug },
        },
        create: {
          moduleId: created.id,
          ...l,
          content: `# ${l.title}\n\nContent for this lesson will be added.`,
          description: l.title,
        },
        update: { title: l.title, durationMinutes: l.durationMinutes, orderIndex: l.orderIndex },
      });
    }
  }

  for (const ch of CHANNELS) {
    await prisma.communityChannel.upsert({
      where: { slug: ch.slug },
      create: ch,
      update: ch,
    });
  }

  for (const s of HALAL_SYMBOLS) {
    await prisma.halalSymbol.upsert({
      where: { symbol: s.symbol },
      create: { ...s, lastVerifiedAt: new Date() },
      update: { name: s.name, assetType: s.assetType, lastVerifiedAt: new Date() },
    });
  }

  const BADGES = [
    { slug: "first_lesson", name: "First Steps", description: "Completed your first lesson", icon: "🌱", type: "completion" },
    { slug: "streak_7", name: "Week of Focus", description: "7-day learning streak", icon: "🔥", type: "streak" },
    { slug: "streak_30", name: "Monthly Champion", description: "30-day learning streak", icon: "⭐", type: "streak" },
    { slug: "path_foundations", name: "Business Foundations", description: "Completed Business Foundations path", icon: "📚", type: "milestone" },
    { slug: "action_builder", name: "Action Builder", description: "Completed your first Action Assignment", icon: "✍️", type: "excellence" },
    { slug: "first_offer_created", name: "First Offer Created", description: "Built your first offer", icon: "📦", type: "milestone" },
    { slug: "first_client_closed", name: "First Client Closed", description: "Landed your first client", icon: "🤝", type: "milestone" },
    { slug: "revenue_milestone", name: "Revenue Milestone Hit", description: "Hit your first revenue milestone", icon: "💰", type: "milestone" },
    { slug: "system_built", name: "System Built", description: "Documented and systemized a process", icon: "⚙️", type: "milestone" },
  ];
  for (const b of BADGES) {
    await prisma.badge.upsert({
      where: { slug: b.slug },
      create: b,
      update: { name: b.name, description: b.description, icon: b.icon, type: b.type },
    });
  }

  const foundationsModule = await prisma.academyModule.findUnique({ where: { slug: "foundations" } });
  if (foundationsModule) {
    const lesson1Content = `## Understanding Customer Pain Points

Successful businesses exist to serve others. Before building anything, you need to identify **genuine problems** that your business can solve. This means talking to potential customers, practicing empathy, and validating that the problem is real and worth solving.

## Defining Your Unique Value Proposition

What makes your business different and better than alternatives? Your **Unique Value Proposition (UVP)** should be clear enough that a customer can articulate it in one sentence. It combines your target market, the problem you solve, and why you're the best choice.

## Identifying Target Markets

Rather than trying to serve everyone, define **specific customer segments**. Use demographics, psychographics, and market sizing to focus on the people most likely to benefit from your offer.

## Developing Brand Personality

Create a brand identity that resonates with your target market while reflecting **Islamic values**. Your brand voice, visual identity, and messaging should be consistent and authentic.

## Understanding Revenue Models

Learn how businesses generate income in **halal-compliant** ways: product sales, service fees, subscriptions, and commissions—all evaluated through an Islamic lens. Avoid riba (interest), gharar (excessive uncertainty), and haram products or services.

## Integrating Halal Principles

Ensure your business operates within Islamic guidelines in every decision: from sourcing to pricing to partnerships.`;

    const actionSchema = JSON.stringify([
      { key: "business_sentence", label: "Business Sentence", type: "text", placeholder: "One sentence: what your business does and who it serves" },
      { key: "target_market", label: "Target Market", type: "text", placeholder: "Describe your ideal customer" },
      { key: "pain_point", label: "Pain Point", type: "text", placeholder: "The specific problem your business solves" },
      { key: "uvp", label: "Unique Value Proposition", type: "text", placeholder: "What makes you different from competitors" },
      { key: "revenue_model", label: "Revenue Model", type: "text", placeholder: "How your business will generate halal income" },
    ]);

    await prisma.academyLesson.upsert({
      where: { moduleId_slug: { moduleId: foundationsModule.id, slug: "what-is-a-business" } },
      create: {
        moduleId: foundationsModule.id,
        slug: "what-is-a-business",
        title: "Building a Company With Direction",
        description: "Customer pain points, value proposition, target market, and halal principles",
        content: lesson1Content,
        durationMinutes: 25,
        orderIndex: 0,
        actionAssignmentSchema: actionSchema,
      },
      update: {
        title: "Building a Company With Direction",
        description: "Customer pain points, value proposition, target market, and halal principles",
        content: lesson1Content,
        durationMinutes: 25,
        actionAssignmentSchema: actionSchema,
      },
    });
  }

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  await prisma.academyTopic.createMany({
    data: [
      { title: "Pricing for Value Without Riba", summary: "How to set prices that reflect value while staying within Islamic principles.", path: "business", link: "/academy", publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
      { title: "Shariah Screening in Practice", summary: "A practical look at how stocks are screened for halal compliance.", path: "investing", link: "/academy", publishedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) },
      { title: "Building Your First Sales Funnel", summary: "From lead to customer: ethical funnel design for beginners.", path: "both", link: "/academy", publishedAt: weekAgo },
    ],
    skipDuplicates: false,
  });

  await prisma.toolRelease.createMany({
    data: [
      { name: "Loveable", description: "New AI excelling in generating content and images for your brand.", category: "content", url: "https://loveable.dev", releasedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      { name: "Canva", description: "Design templates for logos and social campaigns.", category: "design", url: "https://canva.com", releasedAt: weekAgo },
    ],
    skipDuplicates: false,
  });

  await prisma.marketFeedItem.createMany({
    data: [
      { symbol: "AAPL", title: "Apple reports strong services growth", summary: "Services segment continues to drive margin expansion.", sentiment: "positive", source: "Market Update", publishedAt: now },
      { symbol: "SPUS", title: "Halal ETF flows remain steady", summary: "Sharia-compliant fund flows reflect sustained interest.", sentiment: "neutral", source: "Amanah Research", publishedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    ],
    skipDuplicates: false,
  });

  console.log("Seed complete: academy modules/lessons, community channels, halal symbols, badges, topics, tools, feed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
