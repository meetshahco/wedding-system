"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
  Divider,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  Refresh,
  People,
  Send,
  Visibility,
  Event as EventIcon,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  ArrowForward,
  ContactPhone,
  Speed,
} from "@mui/icons-material";
import { tokens } from "@/lib/theme";
import { DashboardStats, GoLiveChecklist } from "@/lib/dashboard-service";

interface WeddingMeta {
  id: string;
  slug: string;
  coupleName1: string;
  coupleName2: string;
  weddingDate: string;
  accentColor: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [checklist, setChecklist] = useState<GoLiveChecklist | null>(null);
  const [wedding, setWedding] = useState<WeddingMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const data = await res.json();
      setStats(data.stats);
      setChecklist(data.checklist);
      setWedding(data.wedding);
    } catch {
      setError("Failed to load dashboard. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: tokens.primary.main }} />
      </Box>
    );
  }

  if (error || !stats) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || "Unable to display dashboard"}
        </Alert>
        <Button variant="outlined" onClick={fetchDashboard} startIcon={<Refresh />}>
          Retry
        </Button>
      </Box>
    );
  }

  const sentPercent = stats.totalGuests > 0 ? Math.round((stats.sentGuests / stats.totalGuests) * 100) : 0;
  const openedPercent = stats.sentGuests > 0 ? Math.round((stats.openedGuests / stats.sentGuests) * 100) : 0;

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
              {wedding ? `${wedding.coupleName1} & ${wedding.coupleName2}` : "Wedding Dashboard"}
            </Typography>
            {checklist && (
              <Chip
                label={checklist.overallReady ? "READY TO GO LIVE" : `${checklist.score} CHECKS PASSED`}
                size="small"
                sx={{
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  bgcolor: checklist.overallReady ? tokens.status.successBg : tokens.status.warningBg,
                  color: checklist.overallReady ? tokens.status.success : tokens.status.warning,
                  border: `1px solid ${checklist.overallReady ? tokens.status.successBorder : tokens.status.warningBorder}`,
                }}
              />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {wedding?.weddingDate
              ? `Wedding Date: ${new Date(wedding.weddingDate).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}`
              : "Overview of invitations, guest opens, expected event headcounts, and sender progress."}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", width: { xs: "100%", sm: "auto" } }}>
          <Button
            variant="outlined"
            onClick={fetchDashboard}
            startIcon={<Refresh />}
            sx={{ minHeight: 44, borderColor: tokens.neutral.border, color: tokens.neutral.textPrimary }}
          >
            Refresh
          </Button>
          <Button
            component={Link}
            href="/admin/invitations"
            variant="contained"
            endIcon={<ArrowForward />}
            sx={{
              minHeight: 44,
              bgcolor: tokens.primary.main,
              color: tokens.neutral.white,
              "&:hover": { bgcolor: tokens.primary.dark },
            }}
          >
            Dispatch Invitations
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {/* Total Guests & Expected PAX */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                  Total Invited
                </Typography>
                <People sx={{ color: tokens.neutral.textSecondary, fontSize: 20 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {stats.totalGuests}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                <strong>{stats.totalPax}</strong> total expected PAX
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Invitations Sent */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                  Invitations Sent
                </Typography>
                <Send sx={{ color: tokens.status.success, fontSize: 20 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: tokens.status.success }}>
                {stats.sentGuests}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {sentPercent}% dispatched ({stats.sentPax} PAX)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Invitations Opened */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                  Invitations Opened
                </Typography>
                <Visibility sx={{ color: tokens.neutral.textPrimary, fontSize: 20 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {stats.openedGuests}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {openedPercent}% open rate ({stats.openedPax} PAX confirmed seen)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Daily Send Cap */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                  Daily Cap (Rolling 24h)
                </Typography>
                <Speed sx={{ color: tokens.neutral.textSecondary, fontSize: 20 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {stats.dailyCap.remaining}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {stats.dailyCap.sentToday} of {stats.dailyCap.cap} messages sent today
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Grid: Expected Event Headcounts & Sender Progress */}
      <Grid container spacing={3}>
        {/* Left Column: Expected Headcounts Per Event */}
        <Grid item xs={12} lg={7}>
          <Paper elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, p: 3, height: "100%" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <EventIcon sx={{ color: tokens.neutral.textPrimary }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Expected Headcount per Event
                </Typography>
              </Box>
              <Button component={Link} href="/admin/events" size="small" sx={{ color: tokens.neutral.textSecondary }}>
                Manage Events
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Headcount is calculated automatically based on each guest&apos;s access tier. No manual RSVP required.
            </Typography>

            {stats.eventsHeadcount.length === 0 ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  No events created yet. Add your ceremony and reception in Events & Access Levels.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {stats.eventsHeadcount.map((evt) => {
                  const viewRate = evt.expectedPax > 0 ? Math.round((evt.openedPax / evt.expectedPax) * 100) : 0;
                  return (
                    <Paper
                      key={evt.id}
                      elevation={0}
                      sx={{
                        p: 2,
                        border: `1px solid ${tokens.neutral.border}`,
                        borderRadius: 1.5,
                        bgcolor: tokens.neutral.subtle,
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {evt.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(evt.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} •{" "}
                            {evt.startTime} {evt.venue ? `• ${evt.venue}` : ""}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {evt.expectedPax} PAX
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {evt.totalGuests} guest units
                          </Typography>
                        </Box>
                      </Box>

                      {/* Progress bar of opened vs expected */}
                      <Box sx={{ mt: 1.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Opened & Seen: <strong>{evt.openedPax} PAX</strong> ({evt.openedGuests} units)
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {viewRate}% seen
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={viewRate}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: tokens.neutral.subtleHover,
                            "& .MuiLinearProgress-bar": { bgcolor: tokens.primary.main },
                          }}
                        />
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Column: Per-Sender Progress & Go-Live Readiness */}
        <Grid item xs={12} lg={5}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, height: "100%" }}>
            {/* Sender Progress Card */}
            <Paper elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <ContactPhone sx={{ color: tokens.neutral.textPrimary }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Per-Sender Dispatch
                  </Typography>
                </Box>
                <Button component={Link} href="/admin/senders" size="small" sx={{ color: tokens.neutral.textSecondary }}>
                  View Senders
                </Button>
              </Box>

              {stats.sendersProgress.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No senders configured. Add senders to enable manual WhatsApp links.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {stats.sendersProgress.map((sender) => (
                    <Box key={sender.id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {sender.name}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {sender.sentCount} / {sender.totalAssigned} sent ({sender.percentComplete}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={sender.percentComplete}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: tokens.neutral.subtleHover,
                          "& .MuiLinearProgress-bar": { bgcolor: tokens.primary.main },
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}

              {stats.unassignedSenderGuests > 0 && (
                <Alert severity="info" sx={{ mt: 2.5, borderRadius: 1.5, fontSize: "0.82rem" }}>
                  {stats.unassignedSenderGuests} guest(s) are currently unassigned to any sender.
                </Alert>
              )}
            </Paper>

            {/* Go-Live Readiness Checklist Preview */}
            {checklist && (
              <Paper elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, p: 3, flex: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Go-Live Checklist
                  </Typography>
                  <Button component={Link} href="/admin/settings" size="small" sx={{ color: tokens.neutral.textSecondary }}>
                    All Settings
                  </Button>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {checklist.items.map((item) => (
                    <Box key={item.id} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      {item.status === "pass" ? (
                        <CheckCircle sx={{ color: tokens.status.success, fontSize: 18, mt: 0.25 }} />
                      ) : item.status === "warn" ? (
                        <Warning sx={{ color: tokens.status.warning, fontSize: 18, mt: 0.25 }} />
                      ) : (
                        <ErrorIcon sx={{ color: tokens.status.error, fontSize: 18, mt: 0.25 }} />
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.description}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
