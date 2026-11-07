import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { hashPassword } from "../lib/crypto-passwords";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  return crypto.randomBytes(8).toString("base64url").slice(0, 10);
}

function generateCode(usedCodes: Set<string>): string {
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
// Main Seed Function
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱  Seeding PostgreSQL database for multi-wedding system...");

  // 1. Primary Default Wedding
  const wedding = await prisma.wedding.upsert({
    where: { slug: "arjun-meera" },
    update: {},
    create: {
      slug: "arjun-meera",
      coupleName1: "Arjun",
      coupleName2: "Meera",
      weddingDate: new Date("2027-02-21T10:00:00+05:30"),
      accentColor: "#111111",
    },
  });

  console.log(`✅  Wedding tenant created: ${wedding.coupleName1} & ${wedding.coupleName2} (${wedding.slug})`);

  // 2. Initial Owner from Environment Variables
  const ownerEmail = (process.env.OWNER_EMAIL || "owner@weddings.test").toLowerCase().trim();
  const rawOwnerPassword = process.env.OWNER_PASSWORD || crypto.randomBytes(9).toString("base64url");
  const ownerPasswordHash = hashPassword(rawOwnerPassword);

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      passwordHash: ownerPasswordHash,
      mustChangePassword: true,
      globalRole: "OWNER",
    },
    create: {
      email: ownerEmail,
      name: "Studio Owner",
      passwordHash: ownerPasswordHash,
      globalRole: "OWNER",
      mustChangePassword: true,
      isActive: true,
      weddingAccess: {
        create: {
          weddingId: wedding.id,
          role: "MANAGER",
        },
      },
    },
  });

  console.log(`✅  Owner seeded: ${owner.email}`);
  if (!process.env.OWNER_PASSWORD) {
    console.log(`🔑  Temporary owner password: ${rawOwnerPassword} (forced change on first login)`);
  }

  // 3. Events (scoped to wedding)
  const existingEvents = await prisma.event.findMany({ where: { weddingId: wedding.id } });
  let event1 = existingEvents.find((e) => e.name.includes("Mehendi"));
  let event2 = existingEvents.find((e) => e.name.includes("Sangeet"));
  let event3 = existingEvents.find((e) => e.name.includes("Wedding"));

  if (!event1) {
    event1 = await prisma.event.create({
      data: {
        weddingId: wedding.id,
        name: "Mehendi Ceremony",
        date: new Date("2027-02-19T16:00:00+05:30"),
        startTime: "4:00 PM",
        venue: "The Garden Pavilion",
        address: "123, Bougainvillea Lane, Juhu, Mumbai 400049",
        mapUrl: "https://maps.google.com/?q=Juhu+Beach+Mumbai",
        dressCode: "Colourful / Festive",
        description: "Join us for an afternoon of henna, music and celebration.",
        sortOrder: 1,
      },
    });
  }

  if (!event2) {
    event2 = await prisma.event.create({
      data: {
        weddingId: wedding.id,
        name: "Sangeet Night",
        date: new Date("2027-02-20T19:30:00+05:30"),
        startTime: "7:30 PM",
        venue: "Royal Ballroom, The Grand Hotel",
        address: "456, Marine Drive, Mumbai 400002",
        mapUrl: "https://maps.google.com/?q=Marine+Drive+Mumbai",
        dressCode: "Cocktail / Semi-formal",
        description: "An evening of music, dance performances and celebration.",
        sortOrder: 2,
      },
    });
  }

  if (!event3) {
    event3 = await prisma.event.create({
      data: {
        weddingId: wedding.id,
        name: "Wedding Ceremony & Reception",
        date: new Date("2027-02-21T10:00:00+05:30"),
        startTime: "10:00 AM",
        venue: "Sunrise Lawns, ITC Maratha",
        address: "Sahar Road, Andheri East, Mumbai 400099",
        mapUrl: "https://maps.google.com/?q=ITC+Maratha+Mumbai",
        dressCode: "Formal / Traditional",
        description: "The main wedding ceremony followed by celebration dinner.",
        sortOrder: 3,
      },
    });
  }

  console.log("✅  Events checked");

  // 4. Access Levels (scoped to wedding)
  let ceremonyOnly = await prisma.accessLevel.findFirst({
    where: { weddingId: wedding.id, name: "Ceremony only" },
  });
  if (!ceremonyOnly) {
    ceremonyOnly = await prisma.accessLevel.create({
      data: {
        weddingId: wedding.id,
        name: "Ceremony only",
        events: { create: [{ eventId: event3.id }] },
      },
    });
  }

  let allEvents = await prisma.accessLevel.findFirst({
    where: { weddingId: wedding.id, name: "All events" },
  });
  if (!allEvents) {
    allEvents = await prisma.accessLevel.create({
      data: {
        weddingId: wedding.id,
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
  }

  console.log("✅  Access levels checked");

  // 5. Message Templates (scoped to wedding)
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
      body: "Hi {{1}},\n\nHere is your personal invitation and event schedule for our upcoming wedding! 🙏\n\nView details at the link below, or enter your code {{2}} on our wedding site.",
      buttons: JSON.stringify([
        {
          type: "url",
          text: "View Invitation",
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
    const existingT = await prisma.messageTemplate.findFirst({
      where: { weddingId: wedding.id, key: t.key },
    });
    if (!existingT) {
      await prisma.messageTemplate.create({
        data: {
          weddingId: wedding.id,
          ...t,
        },
      });
    }
  }

  console.log("✅  Message templates checked");

  // 6. Sample Guests (scoped to wedding)
  const usedCodes = new Set<string>();
  const currentGuests = await prisma.guest.findMany({ where: { weddingId: wedding.id } });
  currentGuests.forEach((cg) => usedCodes.add(cg.code));

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
    const existing = await prisma.guest.findFirst({
      where: { weddingId: wedding.id, phone: g.phone },
    });
    if (!existing) {
      const code = generateCode(usedCodes);
      await prisma.guest.create({
        data: {
          weddingId: wedding.id,
          ...g,
          token: generateToken(),
          code,
        },
      });
    }
  }

  console.log("✅  Sample guests checked");

  // 7. Settings (scoped to wedding)
  const defaultSettings = [
    { key: "baseUrl", value: "http://localhost:3000" },
    { key: "activeProvider", value: "mock" },
    { key: "dailySendCap", value: "250" },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { weddingId_key: { weddingId: wedding.id, key: s.key } },
      update: {},
      create: {
        weddingId: wedding.id,
        key: s.key,
        value: s.value,
      },
    });
  }

  console.log("✅  Default settings checked");
  console.log("\n🎉  Postgres seed complete with Users & Roles!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
