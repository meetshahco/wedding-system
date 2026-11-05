import { prisma } from "./prisma";
import { getSendingMethod, checkDailyCaps, getWeddingDailyCap } from "./sending-settings";

export interface EventHeadcount {
  id: string;
  name: string;
  date: Date;
  startTime: string;
  venue: string;
  address: string;
  sortOrder: number;
  totalGuests: number;
  expectedPax: number;
  openedPax: number;
  openedGuests: number;
}

export interface SenderProgress {
  id: string;
  name: string;
  phone: string | null;
  totalAssigned: number;
  sentCount: number;
  pendingCount: number;
  percentComplete: number;
}

export interface DashboardStats {
  totalGuests: number;
  totalPax: number;
  sentGuests: number;
  sentPax: number;
  openedGuests: number;
  openedPax: number;
  optedOutGuests: number;
  missingPhoneGuests: number;
  unassignedSenderGuests: number;
  eventsHeadcount: EventHeadcount[];
  sendersProgress: SenderProgress[];
  sendingMethod: "mock" | "whatsapp_cloud" | "manual";
  dailyCap: {
    cap: number;
    sentToday: number;
    remaining: number;
  };
}

/**
 * Computes all dashboard statistics for a wedding.
 */
export async function getDashboardStats(weddingId: string): Promise<DashboardStats> {
  const [
    guests,
    events,
    senders,
    sendingMethod,
    dailyCaps,
  ] = await Promise.all([
    prisma.guest.findMany({
      where: { weddingId },
      select: {
        id: true,
        pax: true,
        phone: true,
        optedOut: true,
        openCount: true,
        viewedAt: true,
        inviteStatus: true,
        accessLevelId: true,
        senderId: true,
      },
    }),
    prisma.event.findMany({
      where: { weddingId },
      include: {
        accessLevels: { select: { accessLevelId: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { date: "asc" }],
    }),
    prisma.sender.findMany({
      where: { weddingId, revokedAt: null },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    getSendingMethod(weddingId),
    checkDailyCaps(weddingId),
  ]);

  // Overall totals
  let totalPax = 0;
  let sentGuests = 0;
  let sentPax = 0;
  let openedGuests = 0;
  let openedPax = 0;
  let optedOutGuests = 0;
  let missingPhoneGuests = 0;
  let unassignedSenderGuests = 0;

  for (const g of guests) {
    totalPax += g.pax;
    if (g.optedOut) optedOutGuests++;
    if (!g.phone || !g.phone.trim()) missingPhoneGuests++;
    if (!g.senderId) unassignedSenderGuests++;

    const isSent = g.inviteStatus === "sent" || g.inviteStatus === "delivered" || g.inviteStatus === "read";
    if (isSent) {
      sentGuests++;
      sentPax += g.pax;
    }

    const isOpened = g.openCount > 0 || g.viewedAt !== null;
    if (isOpened) {
      openedGuests++;
      openedPax += g.pax;
    }
  }

  // Calculate headcount per event based on access levels
  const eventsHeadcount: EventHeadcount[] = events.map((event) => {
    const allowedLevelIds = new Set(event.accessLevels.map((al) => al.accessLevelId));
    const hasTierRestriction = allowedLevelIds.size > 0;

    let eventGuests = 0;
    let expectedPax = 0;
    let eventOpenedGuests = 0;
    let openedPax = 0;

    for (const g of guests) {
      // Guest has access if event has no restrictions, or guest's tier is allowed, or guest is unassigned (default all events)
      const hasAccess = !hasTierRestriction || !g.accessLevelId || allowedLevelIds.has(g.accessLevelId);

      if (hasAccess) {
        eventGuests++;
        expectedPax += g.pax;

        if (g.openCount > 0 || g.viewedAt !== null) {
          eventOpenedGuests++;
          openedPax += g.pax;
        }
      }
    }

    return {
      id: event.id,
      name: event.name,
      date: event.date,
      startTime: event.startTime,
      venue: event.venue,
      address: event.address,
      sortOrder: event.sortOrder,
      totalGuests: eventGuests,
      expectedPax,
      openedPax,
      openedGuests: eventOpenedGuests,
    };
  });

  // Calculate progress per sender
  const sendersProgress: SenderProgress[] = senders.map((sender) => {
    const senderGuests = guests.filter((g) => g.senderId === sender.id);
    const totalAssigned = senderGuests.length;
    const sentCount = senderGuests.filter(
      (g) => g.inviteStatus === "sent" || g.inviteStatus === "delivered" || g.inviteStatus === "read"
    ).length;
    const pendingCount = totalAssigned - sentCount;
    const percentComplete = totalAssigned > 0 ? Math.round((sentCount / totalAssigned) * 100) : 0;

    return {
      id: sender.id,
      name: sender.name,
      phone: sender.phone,
      totalAssigned,
      sentCount,
      pendingCount,
      percentComplete,
    };
  });

  return {
    totalGuests: guests.length,
    totalPax,
    sentGuests,
    sentPax,
    openedGuests,
    openedPax,
    optedOutGuests,
    missingPhoneGuests,
    unassignedSenderGuests,
    eventsHeadcount,
    sendersProgress,
    sendingMethod,
    dailyCap: {
      cap: dailyCaps.weddingCap,
      sentToday: dailyCaps.weddingCount,
      remaining: dailyCaps.weddingRemaining,
    },
  };
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status: "pass" | "warn" | "fail";
  actionUrl?: string;
  actionText?: string;
}

export interface GoLiveChecklist {
  overallReady: boolean;
  score: string; // e.g. "4/5"
  items: ChecklistItem[];
}

/**
 * Evaluates the wedding's readiness to go live.
 */
export async function getGoLiveChecklist(weddingId: string): Promise<GoLiveChecklist> {
  const [wedding, guestCount, guestWithPhoneCount, eventsCount, templateCount, sendersCount, unassignedGuests, sendingMethod] =
    await Promise.all([
      prisma.wedding.findUnique({ where: { id: weddingId } }),
      prisma.guest.count({ where: { weddingId } }),
      prisma.guest.count({ where: { weddingId, phone: { not: "" } } }),
      prisma.event.count({ where: { weddingId } }),
      prisma.messageTemplate.count({ where: { weddingId } }),
      prisma.sender.count({ where: { weddingId, revokedAt: null } }),
      prisma.guest.count({ where: { weddingId, senderId: null } }),
      getSendingMethod(weddingId),
    ]);

  const items: ChecklistItem[] = [];

  // 1. Wedding Details
  const hasNames = Boolean(wedding?.coupleName1?.trim() && wedding?.coupleName2?.trim());
  items.push({
    id: "couple_names",
    label: "Couple Names Configured",
    description: hasNames
      ? `${wedding?.coupleName1} & ${wedding?.coupleName2}`
      : "Couple names must be set for invitations to personalize properly.",
    status: hasNames ? "pass" : "fail",
    actionUrl: "/admin/settings",
    actionText: "Edit Names",
  });

  // 2. Events Created
  items.push({
    id: "events",
    label: "Events & Itinerary Configured",
    description:
      eventsCount > 0
        ? `${eventsCount} wedding event(s) scheduled on the itinerary.`
        : "Add at least one event (e.g. Ceremony, Reception) so guests see calendar details.",
    status: eventsCount > 0 ? "pass" : "fail",
    actionUrl: "/admin/events",
    actionText: "Manage Events",
  });

  // 3. Guest List
  const hasGuests = guestCount > 0 && guestWithPhoneCount > 0;
  items.push({
    id: "guests",
    label: "Guests Imported with Phone Numbers",
    description:
      guestCount === 0
        ? "No guests have been imported yet."
        : guestWithPhoneCount === guestCount
        ? `All ${guestCount} guests have valid phone numbers.`
        : `${guestWithPhoneCount} of ${guestCount} guests have valid phone numbers.`,
    status: guestWithPhoneCount === 0 ? "fail" : guestWithPhoneCount < guestCount ? "warn" : "pass",
    actionUrl: "/admin/guests",
    actionText: "View Guests",
  });

  // 4. Message Templates
  items.push({
    id: "templates",
    label: "Invitation Template Present",
    description:
      templateCount > 0
        ? `${templateCount} template(s) ready for sending.`
        : "Invitation message template needs to be created or seeded.",
    status: templateCount > 0 ? "pass" : "fail",
    actionUrl: "/admin/messages",
    actionText: "View Templates",
  });

  // 5. Sending Method & Senders
  if (sendingMethod === "manual") {
    const manualReady = sendersCount > 0 && unassignedGuests === 0;
    items.push({
      id: "senders",
      label: "Manual Mode Sender Assignments",
      description:
        sendersCount === 0
          ? "Manual mode requires at least one active sender."
          : unassignedGuests > 0
          ? `${unassignedGuests} guests are not assigned to any sender.`
          : `All guests distributed across ${sendersCount} active sender(s).`,
      status: sendersCount === 0 ? "fail" : unassignedGuests > 0 ? "warn" : "pass",
      actionUrl: "/admin/senders",
      actionText: "Manage Senders",
    });
  } else {
    items.push({
      id: "api_mode",
      label: "Automated Sending Configured",
      description: `Active sending provider: ${sendingMethod === "whatsapp_cloud" ? "WhatsApp Cloud API" : "Mock Engine"}.`,
      status: "pass",
      actionUrl: "/admin/settings",
      actionText: "Configure Provider",
    });
  }

  const passedCount = items.filter((i) => i.status === "pass").length;
  const overallReady = items.every((i) => i.status !== "fail");

  return {
    overallReady,
    score: `${passedCount}/${items.length}`,
    items,
  };
}

export interface UsageReportOptions {
  rates?: {
    utility?: number;
    marketing?: number;
    currency?: string;
  };
}

export interface UsageReport {
  totalMessages: number;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  breakdownByCategory: {
    category: string;
    count: number;
    rate: number;
    cost: number;
  }[];
  totalEstimatedCost: number;
  currency: string;
  rates: {
    utility: number;
    marketing: number;
  };
}

/**
 * Generates usage breakdown and estimated cost calculator based on configurable message rates.
 */
export async function getUsageReport(
  weddingId: string,
  options: UsageReportOptions = {}
): Promise<UsageReport> {
  const utilityRate = options.rates?.utility ?? 0.35;
  const marketingRate = options.rates?.marketing ?? 0.80;
  const currency = options.rates?.currency ?? "INR";

  const countedStatuses = ["sent", "delivered", "read"];

  const logs = await prisma.messageLog.findMany({
    where: {
      weddingId,
      status: { in: ["sent", "delivered", "read", "failed"] },
    },
    select: {
      id: true,
      status: true,
      templateKey: true,
      kind: true,
    },
  });

  // Query templates for categories
  const templates = await prisma.messageTemplate.findMany({
    where: { weddingId },
    select: { key: true, category: true },
  });

  const categoryMap = new Map<string, string>();
  for (const t of templates) {
    categoryMap.set(t.key, t.category);
  }

  let totalSent = 0;
  let totalDelivered = 0;
  let totalFailed = 0;

  const categoryCounts: Record<string, number> = {
    Utility: 0,
    Marketing: 0,
  };

  for (const l of logs) {
    if (l.status === "sent") totalSent++;
    if (l.status === "delivered" || l.status === "read") totalDelivered++;
    if (l.status === "failed") totalFailed++;

    if (countedStatuses.includes(l.status)) {
      const cat = categoryMap.get(l.templateKey) || "Utility";
      if (cat === "Marketing") {
        categoryCounts.Marketing++;
      } else {
        categoryCounts.Utility++;
      }
    }
  }

  const breakdownByCategory = [
    {
      category: "Utility (Invitations & Updates)",
      count: categoryCounts.Utility,
      rate: utilityRate,
      cost: parseFloat((categoryCounts.Utility * utilityRate).toFixed(2)),
    },
    {
      category: "Marketing (Promotional / Follow-up)",
      count: categoryCounts.Marketing,
      rate: marketingRate,
      cost: parseFloat((categoryCounts.Marketing * marketingRate).toFixed(2)),
    },
  ];

  const totalEstimatedCost = parseFloat(
    (breakdownByCategory[0].cost + breakdownByCategory[1].cost).toFixed(2)
  );

  return {
    totalMessages: logs.length,
    totalSent,
    totalDelivered,
    totalFailed,
    breakdownByCategory,
    totalEstimatedCost,
    currency,
    rates: {
      utility: utilityRate,
      marketing: marketingRate,
    },
  };
}

/**
 * Generates CSV string for message usage logs.
 */
export async function generateUsageCsv(
  weddingId: string,
  options: UsageReportOptions = {}
): Promise<string> {
  const utilityRate = options.rates?.utility ?? 0.35;
  const marketingRate = options.rates?.marketing ?? 0.80;
  const currency = options.rates?.currency ?? "INR";

  const logs = await prisma.messageLog.findMany({
    where: { weddingId },
    include: {
      guest: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const templates = await prisma.messageTemplate.findMany({
    where: { weddingId },
    select: { key: true, category: true },
  });
  const categoryMap = new Map(templates.map((t) => [t.key, t.category]));

  const headers = ["Timestamp", "Guest Name", "Phone", "Template Key", "Category", "Status", `Cost (${currency})`];
  const rows = [headers.join(",")];

  for (const log of logs) {
    const category = categoryMap.get(log.templateKey) || "Utility";
    const isCharged = ["sent", "delivered", "read"].includes(log.status);
    const cost = isCharged ? (category === "Marketing" ? marketingRate : utilityRate) : 0;

    const row = [
      `"${log.sentAt ? log.sentAt.toISOString() : log.createdAt.toISOString()}"`,
      `"${log.guest?.name.replace(/"/g, '""') || ""}"`,
      `"${log.guest?.phone || ""}"`,
      `"${log.templateKey}"`,
      `"${category}"`,
      `"${log.status}"`,
      cost.toFixed(2),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

export interface HealthCheckResult {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  timestamp: string;
  database: {
    status: "ok" | "error";
    latencyMs: number;
  };
  jobQueue: {
    queuedCount: number;
    stalledCount: number;
    failedRecentCount: number;
    status: "ok" | "warning" | "error";
  };
  dailyCap: {
    weddingCap: number;
    sentToday: number;
    remaining: number;
    status: "ok" | "capped";
  };
  details: string[];
}

/**
 * Performs a comprehensive system & wedding health check.
 */
export async function getHealthCheck(weddingId?: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  let dbStatus: "ok" | "error" = "ok";
  let latencyMs = 0;
  const details: string[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    latencyMs = Date.now() - startTime;
  } catch (err) {
    dbStatus = "error";
    details.push(`Database connection error: ${(err as Error).message}`);
  }

  // Job queue health
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const whereQueue: Record<string, unknown> = {};
  if (weddingId) whereQueue.weddingId = weddingId;

  const [queuedCount, stalledCount, failedRecentCount] = await Promise.all([
    prisma.messageLog.count({ where: { ...whereQueue, status: "queued" } }),
    prisma.messageLog.count({
      where: {
        ...whereQueue,
        status: "sending",
        createdAt: { lte: fifteenMinutesAgo },
      },
    }),
    prisma.messageLog.count({
      where: {
        ...whereQueue,
        status: "failed",
        createdAt: { gte: oneDayAgo },
      },
    }),
  ]);

  let queueHealthStatus: "ok" | "warning" | "error" = "ok";
  if (stalledCount > 10 || failedRecentCount > 50) {
    queueHealthStatus = "error";
    details.push(`${stalledCount} stalled queue jobs and ${failedRecentCount} recent failures detected.`);
  } else if (stalledCount > 0 || failedRecentCount > 0) {
    queueHealthStatus = "warning";
    details.push(`${stalledCount} message(s) stalled in sending state; ${failedRecentCount} failed in last 24h.`);
  }

  // Daily cap health
  let weddingCap = 250;
  let sentToday = 0;
  let remaining = 250;
  let capStatus: "ok" | "capped" = "ok";

  if (weddingId) {
    const caps = await checkDailyCaps(weddingId);
    weddingCap = caps.weddingCap;
    sentToday = caps.weddingCount;
    remaining = caps.weddingRemaining;
    if (remaining <= 0) {
      capStatus = "capped";
      details.push("Daily send cap has been fully utilized for today.");
    }
  }

  // Determine overall status
  let overallStatus: "HEALTHY" | "DEGRADED" | "UNHEALTHY" = "HEALTHY";
  if (dbStatus === "error" || queueHealthStatus === "error") {
    overallStatus = "UNHEALTHY";
  } else if (queueHealthStatus === "warning" || capStatus === "capped") {
    overallStatus = "DEGRADED";
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs,
    },
    jobQueue: {
      queuedCount,
      stalledCount,
      failedRecentCount,
      status: queueHealthStatus,
    },
    dailyCap: {
      weddingCap,
      sentToday,
      remaining,
      status: capStatus,
    },
    details,
  };
}
