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

/** Quizzes for the last (capstone) lesson of each module. options: string[]; correctIndex: 0-based. */
const LESSON_QUIZZES: { moduleSlug: string; lessonSlug: string; questions: { questionText: string; options: string[]; correctIndex: number }[] }[] = [
  {
    moduleSlug: "foundations",
    lessonSlug: "choosing-a-niche",
    questions: [
      { questionText: "Why is it important to validate a business idea before building?", options: ["To save time and money", "To ensure there is real demand", "Both A and B", "It is not necessary"], correctIndex: 2 },
      { questionText: "What is a customer pain point?", options: ["A problem or need customers have", "A type of product", "A marketing channel", "A pricing strategy"], correctIndex: 0 },
      { questionText: "Market research helps you:", options: ["Guess what customers want", "Understand demand and competition", "Copy competitors only", "Skip validation"], correctIndex: 1 },
      { questionText: "Choosing a niche means:", options: ["Serving everyone", "Focusing on a specific audience", "Ignoring the market", "Only selling one product"], correctIndex: 1 },
    ],
  },
  {
    moduleSlug: "offer-revenue",
    lessonSlug: "sales-basics",
    questions: [
      { questionText: "A strong value proposition should:", options: ["Be vague to appeal to more people", "Clearly state the benefit to the customer", "Focus only on features", "Ignore the competition"], correctIndex: 1 },
      { questionText: "Pricing based on value means:", options: ["Charging the lowest price", "Linking price to the outcome you deliver", "Copying competitor prices", "Always using discounts"], correctIndex: 1 },
      { questionText: "An offer typically includes:", options: ["Only the product", "Product, price, and clear outcome", "Just the price", "Nothing specific"], correctIndex: 1 },
      { questionText: "Ethical sales is about:", options: ["Selling at any cost", "Helping the right customers get the right solution", "Avoiding conversations", "Only selling online"], correctIndex: 1 },
    ],
  },
  {
    moduleSlug: "branding-positioning",
    lessonSlug: "authority-building",
    questions: [
      { questionText: "Brand identity includes:", options: ["Only a logo", "Visual identity, voice, and messaging", "Only colors", "Only the name"], correctIndex: 1 },
      { questionText: "Consistent messaging helps:", options: ["Confuse the audience", "Build recognition and trust", "Reduce marketing need to zero", "Replace the product"], correctIndex: 1 },
      { questionText: "Authority building is about:", options: ["Being the cheapest", "Demonstrating expertise and trustworthiness", "Posting only on one platform", "Ignoring feedback"], correctIndex: 1 },
      { questionText: "A unique value proposition (UVP) should be:", options: ["Long and detailed", "Clear and distinguishable from alternatives", "The same as competitors", "Hidden on the website"], correctIndex: 1 },
    ],
  },
  {
    moduleSlug: "marketing-acquisition",
    lessonSlug: "conversion-strategy",
    questions: [
      { questionText: "A marketing funnel typically moves customers:", options: ["From sale to awareness", "From awareness to purchase", "Only through one step", "Randomly"], correctIndex: 1 },
      { questionText: "Content marketing aims to:", options: ["Sell only", "Provide value and build trust before selling", "Replace all other marketing", "Avoid any call to action"], correctIndex: 1 },
      { questionText: "Ethical sales means:", options: ["No persuasion", "Honest persuasion that serves the customer", "Selling only to friends", "Avoiding conversations"], correctIndex: 1 },
      { questionText: "Conversion strategy focuses on:", options: ["Getting more traffic only", "Turning interested people into customers", "Removing all friction", "Hiding the price"], correctIndex: 1 },
    ],
  },
  {
    moduleSlug: "operations",
    lessonSlug: "financial-tracking",
    questions: [
      { questionText: "SOPs (Standard Operating Procedures) help:", options: ["Make work slower", "Create consistency and scale", "Replace all staff", "Eliminate the need for training"], correctIndex: 1 },
      { questionText: "Client delivery systems are important for:", options: ["Only large companies", "Quality and repeatability", "Avoiding clients", "Cutting costs only"], correctIndex: 1 },
      { questionText: "Financial tracking helps you:", options: ["Ignore profitability", "Understand revenue, costs, and profit", "Only track sales", "Replace an accountant"], correctIndex: 1 },
      { questionText: "Operations focus on:", options: ["Marketing only", "Systems, delivery, and financial health", "Only hiring", "Only product creation"], correctIndex: 1 },
    ],
  },
  {
    moduleSlug: "scaling",
    lessonSlug: "capital-allocation",
    questions: [
      { questionText: "Scaling often requires:", options: ["Doing everything yourself", "Leverage through systems and people", "Lower quality", "Stopping growth"], correctIndex: 1 },
      { questionText: "Capital allocation means:", options: ["Spending all profit", "Deciding where to invest time and money", "Ignoring cash flow", "Only saving"], correctIndex: 1 },
      { questionText: "Leverage can come from:", options: ["Only money", "People, systems, and capital", "Only technology", "Only marketing"], correctIndex: 1 },
      { questionText: "When scaling, it is important to:", options: ["Skip systems", "Maintain quality and systems", "Hire without structure", "Ignore unit economics"], correctIndex: 1 },
    ],
  },
];

async function main() {
  const pathway = await prisma.learningPath.upsert({
    where: { slug: "entrepreneurship" },
    create: { slug: "entrepreneurship", name: "Entrepreneurship", description: "Build real businesses from zero.", orderIndex: 0 },
    update: { name: "Entrepreneurship", description: "Build real businesses from zero.", orderIndex: 0 },
  });
  const course = await prisma.course.upsert({
    where: { pathwayId_slug: { pathwayId: pathway.id, slug: "entrepreneurship-foundations" } },
    create: { pathwayId: pathway.id, slug: "entrepreneurship-foundations", title: "Entrepreneurship Foundations", description: "Teach how businesses actually work.", orderIndex: 0, estimatedMinutes: 120, skillLevel: "beginner" },
    update: { title: "Entrepreneurship Foundations", description: "Teach how businesses actually work.", orderIndex: 0, estimatedMinutes: 120, skillLevel: "beginner" },
  });

  for (const mod of MODULES) {
    const { lessons, ...moduleData } = mod;
    const created = await prisma.academyModule.upsert({
      where: { slug: mod.slug },
      create: { ...moduleData, courseId: course.id },
      update: { title: moduleData.title, description: moduleData.description, orderIndex: moduleData.orderIndex, courseId: course.id },
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

  for (const qz of LESSON_QUIZZES) {
    const mod = await prisma.academyModule.findUnique({ where: { slug: qz.moduleSlug } });
    if (!mod) continue;
    const lesson = await prisma.academyLesson.findUnique({
      where: { moduleId_slug: { moduleId: mod.id, slug: qz.lessonSlug } },
    });
    if (!lesson) continue;
    const quiz = await prisma.lessonQuiz.upsert({
      where: { lessonId: lesson.id },
      create: { lessonId: lesson.id },
      update: {},
    });
    await prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
    for (let i = 0; i < qz.questions.length; i++) {
      const q = qz.questions[i];
      await prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionText: q.questionText,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          orderIndex: i,
        },
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

  const charityCount = await prisma.charityFoundation.count();
  if (charityCount === 0) {
    await prisma.charityFoundation.createMany({
      data: [
        { name: "Islamic Relief USA", description: "Humanitarian relief and development worldwide.", url: "https://irusa.org", acceptsZakat: true, acceptsSadaqah: true, acceptsSadaqahJariyah: true, orderIndex: 0 },
        { name: "Zakat Foundation of America", description: "Zakat and sadaqah distribution to those in need.", url: "https://www.zakatfoundation.org", acceptsZakat: true, acceptsSadaqah: true, acceptsSadaqahJariyah: true, orderIndex: 1 },
        { name: "Penny Appeal USA", description: "Sustainable development and emergency relief.", url: "https://pennyappealusa.org", acceptsZakat: true, acceptsSadaqah: true, acceptsSadaqahJariyah: false, orderIndex: 2 },
        { name: "Hidaya Foundation", description: "Education and community development projects.", url: "https://hidaya.org", acceptsZakat: true, acceptsSadaqah: true, acceptsSadaqahJariyah: true, orderIndex: 3 },
      ],
    });
  }

  const WORKSPACE_TEMPLATES = [
    {
      slug: "branding-board",
      name: "Branding Board",
      description: "Define brand mission, logo concepts, color palette, typography, and brand voice.",
      type: "branding_board",
      orderIndex: 0,
      definition: JSON.stringify({
        sections: ["Brand Mission", "Logo Concepts", "Color Palette", "Typography", "Brand Voice"],
      }),
    },
    {
      slug: "business-model",
      name: "Business Model Canvas",
      description: "Map customer segments, value proposition, channels, revenue streams, and key activities.",
      type: "business_model",
      orderIndex: 1,
      definition: JSON.stringify({
        sections: ["Customer Segments", "Value Proposition", "Channels", "Revenue Streams", "Key Activities", "Key Partners", "Cost Structure"],
      }),
    },
    {
      slug: "marketing-funnel",
      name: "Marketing Funnel",
      description: "Plan traffic sources, lead magnet, email funnel, offer page, and conversion metrics.",
      type: "marketing_funnel",
      orderIndex: 2,
      definition: JSON.stringify({
        sections: ["Traffic Sources", "Lead Magnet", "Email Funnel", "Offer Page", "Conversion Metrics"],
      }),
    },
    {
      slug: "workflow-map",
      name: "Workflow Map",
      description: "Visual automation diagram: trigger → condition → action.",
      type: "workflow_map",
      orderIndex: 3,
      definition: JSON.stringify({
        sections: ["Workflow"],
      }),
    },
  ];
  for (const t of WORKSPACE_TEMPLATES) {
    await prisma.workspaceTemplate.upsert({
      where: { slug: t.slug },
      create: t,
      update: { name: t.name, description: t.description, type: t.type, definition: t.definition, orderIndex: t.orderIndex },
    });
  }

  console.log("Seed complete: academy modules/lessons, community channels, halal symbols, badges, topics, tools, feed, charity foundations, workspace templates.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
