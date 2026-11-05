import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  return crypto.randomBytes(8).toString("base64url").slice(0, 10);
}

async function generateUniqueCode(usedCodes: Set<string>): Promise<string> {
  let code: string;
  let attempts = 0;
  do {
    code = String(Math.floor(Math.random() * 9000) + 1000);
    attempts++;
    if (attempts > 1000) throw new Error("Could not generate unique code");
  } while (usedCodes.has(code));
  usedCodes.add(code);
  return code;
}

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱  Seeding database...");

  // Enable WAL mode for safe concurrent access
  // journal_mode returns a result row, so use $queryRawUnsafe
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;");

  // --- Events ---
  const event1 = await prisma.event.upsert({
    where: { id: "event-mehendi" },
    update: {},
    create: {
      id: "event-mehendi",
      name: "Mehendi Ceremony",
      date: new Date("2027-02-19T16:00:00+05:30"),
      startTime: "4:00 PM",
      venue: "The Garden Pavilion",
      address: "123, Bougainvillea Lane, Juhu, Mumbai 400049",
      mapUrl: "https://maps.google.com/?q=Juhu+Beach+Mumbai",
      dressCode: "Colourful / Festive",
      description:
        "Join us for an evening of henna, music and celebration as we kick off the wedding festivities.",
      sortOrder: 1,
    },
  });

  const event2 = await prisma.event.upsert({
    where: { id: "event-sangeet" },
    update: {},
    create: {
      id: "event-sangeet",
      name: "Sangeet Night",
      date: new Date("2027-02-20T19:30:00+05:30"),
      startTime: "7:30 PM",
      venue: "Royal Ballroom, The Grand Hotel",
      address: "456, Marine Drive, Mumbai 400002",
      mapUrl: "https://maps.google.com/?q=Marine+Drive+Mumbai",
      dressCode: "Cocktail / Semi-formal",
      description:
        "An evening of music, dance performances and unforgettable memories.",
      sortOrder: 2,
    },
  });

  const event3 = await prisma.event.upsert({
    where: { id: "event-wedding" },
    update: {},
    create: {
      id: "event-wedding",
      name: "Wedding Ceremony & Reception",
      date: new Date("2027-02-21T10:00:00+05:30"),
      startTime: "10:00 AM",
      venue: "Sunrise Lawns, ITC Maratha",
      address: "Sahar Road, Andheri East, Mumbai 400099",
      mapUrl: "https://maps.google.com/?q=ITC+Maratha+Mumbai",
      dressCode: "Formal / Traditional",
      description:
        "The main wedding ceremony followed by a lavish reception dinner.",
      sortOrder: 3,
    },
  });

  console.log("✅  Events created");

  // --- Access Levels ---
  const ceremonyOnly = await prisma.accessLevel.upsert({
    where: { name: "Ceremony only" },
    update: {},
    create: {
      name: "Ceremony only",
      events: { create: [{ eventId: event3.id }] },
    },
  });

  const allEvents = await prisma.accessLevel.upsert({
    where: { name: "All events" },
    update: {},
    create: {
      name: "All events",
      events: {
        create: [
          { eventId: event1.id },
          { eventId: event2.id },
          { eventId: event3.id },
        ],
      },
    },
  });

  console.log("✅  Access levels created");

  // --- Message Templates ---
  const templates = [
    {
      key: "wedding_invite",
      category: "Marketing",
      body: "Dear {{1}},\n\nWe joyfully invite you to celebrate our wedding! 🎉\n\nYour personal invitation awaits at the link below. If the link doesn't open, visit our wedding site and enter your 4-digit code: {{2}}\n\nWe can't wait to celebrate with you! 💕",
      buttons: JSON.stringify([
        {
          type: "url",
          text: "Open My Invitation",
          url: "{{BASE_URL}}/i/{{3}}",
        },
        { type: "quick_reply", text: "Attending" },
        { type: "quick_reply", text: "Can't make it" },
      ]),
      sampleValues: JSON.stringify(["Priya Sharma", "4521", "abc123def4"]),
    },
    {
      key: "rsvp_reminder",
      category: "Utility",
      body: "Hi {{1}},\n\nWe noticed you haven't RSVPd yet — we'd love to know if you can make it! 🙏\n\nPlease let us know at the link below, or enter your code {{2}} on our wedding site.",
      buttons: JSON.stringify([
        {
          type: "url",
          text: "RSVP Now",
          url: "{{BASE_URL}}/i/{{3}}",
        },
      ]),
      sampleValues: JSON.stringify(["Rahul Mehta", "7832", "xyz987abc1"]),
    },
    {
      key: "event_logistics",
      category: "Utility",
      body: "Hi {{1}}, we're counting down the days! 🎊\n\nHere are your event details:\n\nVenue: {{2}}\nDate & Time: {{3}}\nDress Code: {{4}}\n\nSee you there! 💍",
      buttons: JSON.stringify([
        {
          type: "url",
          text: "View Full Details",
          url: "{{BASE_URL}}/i/{{5}}",
        },
      ]),
      sampleValues: JSON.stringify([
        "Ananya Kapoor",
        "Sunrise Lawns, ITC Maratha",
        "21 Feb 2027, 10:00 AM",
        "Formal / Traditional",
        "tok1234567",
      ]),
    },
    {
      key: "thank_you",
      category: "Marketing",
      body: "Dear {{1}},\n\nThank you so much for being part of our special day! Your presence made it truly magical. 🌸\n\nWe've put together a photo album just for you — cherish the memories! 📸",
      buttons: JSON.stringify([
        {
          type: "url",
          text: "View Photo Album",
          url: "{{1}}",
        },
      ]),
      sampleValues: JSON.stringify([
        "Vikram Singh",
        "https://photos.example.com/album123",
      ]),
    },
  ];

  for (const t of templates) {
    await prisma.messageTemplate.upsert({
      where: { key: t.key },
      update: {},
      create: { ...t },
    });
  }

  console.log("✅  Message templates created");

  // --- Sample Guests ---
  const usedCodes = new Set<string>();
  // Load existing codes to avoid conflicts on re-seed
  const existingCodes = await prisma.guest.findMany({ select: { code: true } });
  existingCodes.forEach((g) => usedCodes.add(g.code));

  const sampleGuests = [
    {
      name: "Priya Sharma",
      phone: "+919876543210",
      city: "Mumbai",
      pax: 2,
      accessLevelId: allEvents.id,
    },
    {
      name: "Rahul Mehta",
      phone: "+919876543211",
      city: "Delhi",
      pax: 4,
      accessLevelId: allEvents.id,
    },
    {
      name: "Ananya Kapoor",
      phone: "+919876543212",
      city: "Mumbai",
      pax: 1,
      accessLevelId: ceremonyOnly.id,
    },
    {
      name: "Vikram Singh",
      phone: "+919876543213",
      city: "Bangalore",
      pax: 2,
      accessLevelId: ceremonyOnly.id,
    },
    {
      name: "Sneha Patel",
      phone: "+919876543214",
      city: "Ahmedabad",
      pax: 3,
      accessLevelId: null,
    },
  ];

  for (const g of sampleGuests) {
    const existing = await prisma.guest.findUnique({
      where: { phone: g.phone },
    });
    if (!existing) {
      const code = await generateUniqueCode(usedCodes);
      await prisma.guest.create({
        data: {
          ...g,
          token: generateToken(),
          code,
        },
      });
    }
  }

  console.log("✅  Sample guests created");

  // --- Default Settings ---
  const defaultSettings = [
    { key: "coupleName1", value: "Arjun" },
    { key: "coupleName2", value: "Meera" },
    { key: "weddingDate", value: "2027-02-21" },
    { key: "baseUrl", value: "http://localhost:3000" },
    { key: "activeProvider", value: "mock" },
    { key: "dailySendCap", value: "250" },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log("✅  Default settings created");
  console.log("\n🎉  Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
