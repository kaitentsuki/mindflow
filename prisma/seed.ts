import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create a seed user
  const user = await prisma.user.upsert({
    where: { email: "demo@mindflow.app" },
    update: {},
    create: {
      email: "demo@mindflow.app",
      name: "Demo User",
      preferences: {
        language: "cs",
        notification_hours: [8, 22],
        categories: [],
      },
    },
  });

  console.log(`Seeded user: ${user.email} (${user.id})`);

  // Create sample thoughts
  const thoughts = [
    {
      rawTranscript:
        "Musím zavolat Petrovi ohledně toho projektu, deadline je příští pátek",
      cleanedText:
        "Musím zavolat Petrovi ohledně projektu. Deadline je příští pátek.",
      summary: "Zavolat Petrovi — deadline projektu příští pátek",
      type: "task" as const,
      priority: 4,
      categories: ["práce", "projekt-X"],
      sentiment: -0.1,
      entities: {
        people: ["Petr"],
        places: [],
        projects: ["projekt-X"],
      },
      actionItems: ["Zavolat Petrovi", "Ověřit stav projektu"],
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
      language: "cs",
      source: "voice",
    },
    {
      rawTranscript:
        "Mám nápad na novou feature do aplikace, mohli bychom přidat voice commands pro rychlé akce",
      cleanedText:
        "Nápad na novou feature: voice commands pro rychlé akce v aplikaci.",
      summary: "Voice commands pro rychlé akce v aplikaci",
      type: "idea" as const,
      priority: 3,
      categories: ["produkt", "UX"],
      sentiment: 0.7,
      entities: { people: [], places: [], projects: ["MindFlow"] },
      actionItems: ["Navrhnout seznam voice commands", "Prototyp"],
      language: "cs",
      source: "voice",
    },
    {
      rawTranscript:
        "Meeting s týmem prošel dobře, dohodli jsme se na sprintu do konce měsíce",
      cleanedText:
        "Meeting s týmem prošel dobře. Dohodli jsme se na sprintu do konce měsíce.",
      summary: "Meeting s týmem — sprint do konce měsíce",
      type: "note" as const,
      priority: 2,
      categories: ["práce", "meeting"],
      sentiment: 0.5,
      entities: { people: [], places: [], projects: [] },
      actionItems: [],
      language: "cs",
      source: "voice",
    },
    {
      rawTranscript: "Připomenout si koupit lístky na koncert v sobotu",
      cleanedText: "Připomenout: koupit lístky na koncert v sobotu.",
      summary: "Koupit lístky na koncert v sobotu",
      type: "reminder" as const,
      priority: 3,
      categories: ["osobní", "volný čas"],
      sentiment: 0.3,
      entities: { people: [], places: [], projects: [] },
      actionItems: ["Koupit lístky na koncert"],
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // +3 days
      language: "cs",
      source: "voice",
    },
    {
      rawTranscript:
        "Dneska jsem měl produktivní den, dokončil jsem dva velké tasky a měl dobrý oběd s Martinem",
      cleanedText:
        "Produktivní den. Dokončil jsem dva velké tasky a měl dobrý oběd s Martinem.",
      summary: "Produktivní den — 2 velké tasky hotové, oběd s Martinem",
      type: "journal" as const,
      priority: 1,
      categories: ["osobní", "reflexe"],
      sentiment: 0.8,
      entities: {
        people: ["Martin"],
        places: [],
        projects: [],
      },
      actionItems: [],
      language: "cs",
      source: "voice",
    },
    {
      rawTranscript:
        "Need to prepare presentation for the client meeting next Wednesday",
      cleanedText:
        "Prepare presentation for client meeting next Wednesday.",
      summary: "Client presentation — next Wednesday",
      type: "task" as const,
      priority: 5,
      categories: ["work", "client"],
      sentiment: -0.2,
      entities: { people: [], places: [], projects: [] },
      actionItems: [
        "Draft presentation slides",
        "Collect metrics data",
        "Review with team",
      ],
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // +5 days
      language: "en",
      source: "voice",
    },
    {
      rawTranscript:
        "Co kdybychom integrovali MindFlow s Google Calendar pro automatické vytváření eventů z deadlinů",
      cleanedText:
        "Integrace MindFlow s Google Calendar — automatické vytváření eventů z deadlinů.",
      summary: "Integrace s Google Calendar pro automatické eventy",
      type: "idea" as const,
      priority: 2,
      categories: ["produkt", "integrace"],
      sentiment: 0.6,
      entities: {
        people: [],
        places: [],
        projects: ["MindFlow", "Google Calendar"],
      },
      actionItems: ["Research Google Calendar API", "Design integration flow"],
      language: "cs",
      source: "voice",
    },
    {
      rawTranscript:
        "Dokončit code review pro Tomášův pull request do zítřka",
      cleanedText: "Dokončit code review pro Tomášův pull request do zítřka.",
      summary: "Code review — Tomášův PR do zítřka",
      type: "task" as const,
      priority: 4,
      categories: ["práce", "code review"],
      sentiment: 0.0,
      entities: { people: ["Tomáš"], places: [], projects: [] },
      actionItems: ["Review PR", "Leave comments", "Approve or request changes"],
      deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // +1 day
      language: "cs",
      source: "voice",
    },
  ];

  for (const thought of thoughts) {
    await prisma.thought.create({
      data: {
        userId: user.id,
        ...thought,
      },
    });
  }

  console.log(`Seeded ${thoughts.length} thoughts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
