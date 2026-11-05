import { Metadata } from "next";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Divider,
} from "@mui/material";
import {
  Favorite,
  CalendarMonth,
  Map,
  AccessTime,
  LocationOn,
  CheckCircleOutline,
  SearchOff,
} from "@mui/icons-material";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tokens } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Wedding Invitation",
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  // Global lookup by token
  const guest = await prisma.guest.findUnique({
    where: { token },
    include: {
      wedding: true,
      accessLevel: {
        include: {
          events: {
            include: {
              event: true,
            },
          },
        },
      },
    },
  });

  // Friendly error page that NEVER reveals database specifics or whether a token exists
  if (!guest) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
          bgcolor: tokens.neutral.bg,
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            maxWidth: 440,
            p: 4,
            textAlign: "center",
            borderRadius: 2,
            borderColor: tokens.neutral.border,
          }}
        >
          <SearchOff sx={{ fontSize: 48, color: tokens.neutral.textSecondary, mb: 1.5 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Invitation Not Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            We could not find an invitation matching this link. Please verify your link or contact the wedding hosts.
          </Typography>
          <Button component={Link} href="/" variant="outlined" sx={{ minHeight: 44 }}>
            Go Home
          </Button>
        </Paper>
      </Box>
    );
  }

  // Open Tracking: record first and repeat opens
  const now = new Date();
  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      viewedAt: guest.viewedAt || now,
      lastViewedAt: now,
      openCount: { increment: 1 },
    },
  });

  const { wedding, accessLevel } = guest;
  const accentColor = wedding.accentColor || tokens.primary.main;

  // Filter events strictly to the guest's access level
  const rawEvents = accessLevel?.events?.map((e) => e.event) || [];
  const events = rawEvents.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const formattedWeddingDate = new Date(wedding.weddingDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: tokens.neutral.subtle,
        py: { xs: 4, sm: 6 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Box sx={{ maxWidth: 680, mx: "auto" }}>
        {/* Header Hero */}
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 3, sm: 5 },
            textAlign: "center",
            borderRadius: 2,
            borderColor: tokens.neutral.border,
            bgcolor: tokens.neutral.white,
            mb: 3,
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              bgcolor: tokens.neutral.subtle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <Favorite sx={{ color: accentColor, fontSize: 26 }} />
          </Box>

          <Typography
            variant="overline"
            sx={{
              letterSpacing: "0.2rem",
              fontWeight: 600,
              color: tokens.neutral.textSecondary,
              display: "block",
              mb: 0.5,
            }}
          >
            The Wedding Of
          </Typography>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: tokens.neutral.textPrimary,
              lineHeight: 1.2,
              mb: 1,
            }}
          >
            {wedding.coupleName1} & {wedding.coupleName2}
          </Typography>

          <Typography variant="body1" sx={{ color: tokens.neutral.textSecondary, fontWeight: 500 }}>
            {formattedWeddingDate}
          </Typography>
        </Paper>

        {/* Personalized Welcome Card */}
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 2,
            borderColor: tokens.neutral.border,
            bgcolor: tokens.neutral.white,
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Dear {guest.name},
            </Typography>
            {accessLevel && (
              <Chip
                label={accessLevel.name}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>

          <Typography variant="body1" sx={{ color: tokens.neutral.textSecondary, lineHeight: 1.6, mb: 2 }}>
            {guest.pax > 1
              ? `We joyfully invite you and your family to join us in celebrating our marriage. We have reserved ${guest.pax} seats in your honour.`
              : "We joyfully invite you to celebrate our wedding. We have reserved a seat in your honour."}
          </Typography>

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleOutline fontSize="small" sx={{ color: tokens.status.success }} />
            <Typography variant="caption" sx={{ color: tokens.neutral.textSecondary }}>
              Invitation code: <strong>{guest.code}</strong>
            </Typography>
          </Box>
        </Paper>

        {/* Schedule & Events Section */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              mb: 2,
              px: 0.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            Celebration Itinerary ({events.length} {events.length === 1 ? "Event" : "Events"})
          </Typography>

          {events.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                textAlign: "center",
                borderRadius: 2,
                borderColor: tokens.neutral.border,
                bgcolor: tokens.neutral.white,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Event details are being finalised. Please check back shortly.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              {events.map((ev) => {
                const eventDateFormatted = new Date(ev.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });

                const mapsUrl =
                  ev.mapUrl ||
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${ev.venue}, ${ev.address}`
                  )}`;

                return (
                  <Card
                    key={ev.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      borderColor: tokens.neutral.border,
                      bgcolor: tokens.neutral.white,
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          mb: 1.5,
                          flexWrap: "wrap",
                          gap: 1,
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {ev.name}
                        </Typography>

                        <Chip
                          icon={<AccessTime fontSize="small" />}
                          label={ev.startTime}
                          size="small"
                          sx={{ fontWeight: 600, bgcolor: tokens.neutral.subtle }}
                        />
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                        <CalendarMonth fontSize="small" sx={{ color: tokens.neutral.textSecondary }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {eventDateFormatted}
                        </Typography>
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
                        <LocationOn fontSize="small" sx={{ color: tokens.neutral.textSecondary, mt: 0.2 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {ev.venue}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ev.address}
                          </Typography>
                        </Box>
                      </Box>

                      {ev.dressCode && (
                        <Box
                          sx={{
                            p: 1.25,
                            borderRadius: 1,
                            bgcolor: tokens.neutral.subtle,
                            mb: 1.5,
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
                            Dress Code
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                            {ev.dressCode}
                          </Typography>
                        </Box>
                      )}

                      {ev.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 2, fontSize: "0.9rem", lineHeight: 1.5 }}
                        >
                          {ev.description}
                        </Typography>
                      )}

                      <Divider sx={{ my: 1.5 }} />

                      <CardActions sx={{ p: 0, gap: 1.5, flexWrap: "wrap" }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Map fontSize="small" />}
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ minHeight: 44, flex: { xs: "1 1 100%", sm: "none" } }}
                        >
                          Open in Maps
                        </Button>

                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<CalendarMonth fontSize="small" />}
                          href={`/api/events/${ev.id}/calendar`}
                          download
                          sx={{
                            minHeight: 44,
                            bgcolor: accentColor,
                            flex: { xs: "1 1 100%", sm: "none" },
                            "&:hover": {
                              bgcolor: tokens.primary.dark,
                            },
                          }}
                        >
                          Add to Calendar
                        </Button>
                      </CardActions>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ textAlign: "center", py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            With love, {wedding.coupleName1} & {wedding.coupleName2}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
