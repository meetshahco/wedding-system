"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Chip,
  TextField,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
} from "@mui/material";
import {
  Send,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  People,
  PersonAdd,
  Layers,
  ArrowForward,
  Close,
  Search,
} from "@mui/icons-material";
import { tokens } from "@/lib/theme";

interface GuestItem {
  id: string;
  name: string;
  phone: string;
  city: string;
  group: string;
  pax: number;
  language: string;
  code: string;
  token: string;
  inviteStatus: string;
  optedOut: boolean;
  viewedAt: string | null;
  openCount: number;
  accessLevel: { id: string; name: string } | null;
  sender: { id: string; name: string; phone: string | null } | null;
  latestLog: {
    id: string;
    status: string;
    sentAt: string | null;
    errorMessage: string | null;
    attempts: number;
  } | null;
}

interface SummaryData {
  stats: {
    totalGuests: number;
    eligible: number;
    queued: number;
    sending: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    optedOut: number;
    unassignedSender: number;
  };
  caps: {
    dailyCap: number;
    sentToday: number;
    remainingToday: number;
    globalRemaining: number;
    allowed: boolean;
  };
  sendingMethod: "mock" | "whatsapp_cloud" | "manual";
}

interface ProgressData {
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  total: number;
  isFinished: boolean;
}

export default function InvitationsPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; severity: "success" | "error" | "info" } | null>(null);

  // Data states
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [accessLevels, setAccessLevels] = useState<{ id: string; name: string }[]>([]);
  const [senders, setSenders] = useState<{ id: string; name: string; _count: { guests: number } }[]>([]);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter & Pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accessLevelFilter, setAccessLevelFilter] = useState("");
  const [senderFilter, setSenderFilter] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Live progress
  const [liveProgress, setLiveProgress] = useState<ProgressData | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);

  // Dialog states
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [sendTargetType, setSendTargetType] = useState<"all_eligible" | "selected">("all_eligible");
  const [confirmRetryOpen, setConfirmRetryOpen] = useState(false);
  const [bulkAccessLevelOpen, setBulkAccessLevelOpen] = useState(false);
  const [selectedAccessLevelId, setSelectedAccessLevelId] = useState("");
  const [bulkSenderOpen, setBulkSenderOpen] = useState(false);
  const [selectedSenderId, setSelectedSenderId] = useState("");
  const [autoSplitOpen, setAutoSplitOpen] = useState(false);

  const fetchInvitations = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
        status: statusFilter,
      });

      if (search.trim()) params.set("search", search.trim());
      if (accessLevelFilter) params.set("accessLevelId", accessLevelFilter);
      if (senderFilter) params.set("senderId", senderFilter);

      const res = await fetch(`/api/admin/invitations?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load invitations data");

      const data = await res.json();
      setSummary(data.summary);
      setGuests(data.guests);
      setTotalCount(data.pagination.total);
      setAccessLevels(data.accessLevels);
      setSenders(data.senders);

      // Check if there are queued or sending messages to activate live progress
      if (data.summary.stats.queued > 0 || data.summary.stats.sending > 0) {
        setIsLiveActive(true);
      }
    } catch {
      setFeedback({ message: "Failed to load invitations.", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter, search, accessLevelFilter, senderFilter]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // Live polling effect when sending is active
  useEffect(() => {
    if (!isLiveActive) return;

    let timer: NodeJS.Timeout;

    const pollProgress = async () => {
      try {
        const res = await fetch("/api/admin/invitations/progress");
        if (res.ok) {
          const { progress } = await res.json();
          setLiveProgress(progress);
          if (progress.isFinished) {
            setIsLiveActive(false);
            fetchInvitations();
          }
        }
      } catch {
        // silent polling error
      }
    };

    pollProgress();
    timer = setInterval(pollProgress, 2500);

    return () => clearInterval(timer);
  }, [isLiveActive, fetchInvitations]);

  // Selection handlers
  const handleSelectAllOnPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pageIds = guests.map((g) => g.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = new Set(guests.map((g) => g.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isAllPageSelected = useMemo(() => {
    if (guests.length === 0) return false;
    return guests.every((g) => selectedIds.includes(g.id));
  }, [guests, selectedIds]);

  // Bulk actions
  const handleBulkAssignAccessLevel = async () => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/invitations/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestIds: selectedIds,
          accessLevelId: selectedAccessLevelId === "none" ? null : selectedAccessLevelId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign access level");

      setFeedback({
        message: `Successfully assigned access level to ${data.updatedCount} guests.`,
        severity: "success",
      });
      setBulkAccessLevelOpen(false);
      setSelectedIds([]);
      fetchInvitations();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAssignSender = async () => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/invitations/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestIds: selectedIds,
          senderId: selectedSenderId === "none" ? null : selectedSenderId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign sender");

      setFeedback({
        message: `Successfully assigned sender to ${data.updatedCount} guests.`,
        severity: "success",
      });
      setBulkSenderOpen(false);
      setSelectedIds([]);
      fetchInvitations();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendInvitations = async () => {
    setActionLoading(true);
    try {
      const payload: { guestIds?: string[] } = {};
      if (sendTargetType === "selected" && selectedIds.length > 0) {
        payload.guestIds = selectedIds;
      }

      const res = await fetch("/api/admin/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invitations");

      setFeedback({
        message: `Queued ${data.queuedCount} invitations. Live sending in progress.`,
        severity: "success",
      });
      setConfirmSendOpen(false);
      setSelectedIds([]);
      setIsLiveActive(true);
      fetchInvitations();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/invitations/retry-failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retry invitations");

      setFeedback({
        message: `Re-queued ${data.retriedCount} failed invitations for delivery.`,
        severity: "success",
      });
      setConfirmRetryOpen(false);
      setIsLiveActive(true);
      fetchInvitations();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAutoSplit = async () => {
    setActionLoading(true);
    try {
      const activeSenderIds = senders.map((s) => s.id);
      if (activeSenderIds.length === 0) {
        throw new Error("No senders exist. Please create senders first.");
      }

      const res = await fetch("/api/admin/senders/auto-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderIds: activeSenderIds,
          unassignedOnly: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to auto-split guests");

      setFeedback({
        message: `Evenly split ${data.splitCount} unassigned guests across ${activeSenderIds.length} senders.`,
        severity: "success",
      });
      setAutoSplitOpen(false);
      fetchInvitations();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const isManualMode = summary?.sendingMethod === "manual";
  const eligibleToSendCount = sendTargetType === "selected" ? selectedIds.length : (summary?.stats.eligible ?? 0);
  const remainingCap = summary?.caps.remainingToday ?? 0;
  const isCapExceeded = eligibleToSendCount > remainingCap;

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Top Header */}
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
              Invitations
            </Typography>
            {summary && (
              <Chip
                label={
                  isManualMode
                    ? "MANUAL SENDER MODE"
                    : summary.sendingMethod === "whatsapp_cloud"
                    ? "WHATSAPP CLOUD API"
                    : "MOCK PROVIDER"
                }
                size="small"
                sx={{
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  bgcolor: tokens.neutral.subtleHover,
                  color: tokens.neutral.textPrimary,
                  border: `1px solid ${tokens.neutral.border}`,
                }}
              />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Dispatch wedding invitations, assign access tiers, and manage delivery progress.
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", width: { xs: "100%", sm: "auto" } }}>
          <Button
            variant="outlined"
            onClick={fetchInvitations}
            startIcon={<Refresh />}
            sx={{ minHeight: 44, borderColor: tokens.neutral.border, color: tokens.neutral.textPrimary }}
          >
            Refresh
          </Button>

          {isManualMode ? (
            <>
              <Button
                variant="outlined"
                onClick={() => setAutoSplitOpen(true)}
                startIcon={<People />}
                sx={{ minHeight: 44, borderColor: tokens.neutral.border, color: tokens.neutral.textPrimary }}
              >
                Auto-Split Unassigned
              </Button>
              <Button
                component={Link}
                href="/admin/senders"
                variant="contained"
                endIcon={<ArrowForward />}
                sx={{
                  minHeight: 44,
                  bgcolor: tokens.primary.main,
                  "&:hover": { bgcolor: tokens.primary.dark },
                }}
              >
                Go to Senders
              </Button>
            </>
          ) : (
            <>
              {summary && summary.stats.failed > 0 && (
                <Button
                  variant="outlined"
                  onClick={() => setConfirmRetryOpen(true)}
                  startIcon={<ErrorIcon />}
                  sx={{
                    minHeight: 44,
                    borderColor: tokens.status.errorBorder,
                    color: tokens.status.error,
                    "&:hover": { bgcolor: tokens.status.errorBg },
                  }}
                >
                  Retry Failed ({summary.stats.failed})
                </Button>
              )}
              <Button
                variant="contained"
                onClick={() => {
                  setSendTargetType("all_eligible");
                  setConfirmSendOpen(true);
                }}
                disabled={summary?.stats.eligible === 0 || remainingCap <= 0}
                startIcon={<Send />}
                sx={{
                  minHeight: 44,
                  bgcolor: tokens.primary.main,
                  color: tokens.neutral.white,
                  "&:hover": { bgcolor: tokens.primary.dark },
                }}
              >
                Send Invitations ({summary?.stats.eligible ?? 0})
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Feedback Alert */}
      {feedback && (
        <Alert
          severity={feedback.severity}
          onClose={() => setFeedback(null)}
          sx={{ mb: 3, borderRadius: 2 }}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Manual Mode Banner */}
      {isManualMode && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 3,
            border: `1px solid ${tokens.neutral.border}`,
            bgcolor: tokens.neutral.subtle,
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
            <People sx={{ color: tokens.neutral.textPrimary, mt: 0.25 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Manual WhatsApp Link Mode Active
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Invitations are dispatched by your assigned senders via direct WhatsApp links from their personal portal.
                Assign guests to senders below or use Auto-Split to divide them evenly.
              </Typography>
              {summary && summary.stats.unassignedSender > 0 && (
                <Typography variant="caption" sx={{ display: "block", mt: 1, fontWeight: 600, color: tokens.status.warning }}>
                  ⚠️ {summary.stats.unassignedSender} guests currently have no sender assigned.
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {/* Live Sending Progress Card (Active during delivery) */}
      {isLiveActive && liveProgress && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            border: `1px solid ${tokens.neutral.border}`,
            bgcolor: tokens.neutral.white,
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <CircularProgress size={18} thickness={5} sx={{ color: tokens.primary.main }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Sending Invitations in Progress...
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                {liveProgress.sent + liveProgress.delivered + liveProgress.read} / {liveProgress.total} completed
              </Typography>
              <Tooltip title="Automated queue processing via WhatsApp API is coming soon. In v1, send invitations via family senders using WhatsApp links.">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled
                    sx={{ borderColor: tokens.neutral.border, color: tokens.neutral.textSecondary, textTransform: "none", minHeight: 30 }}
                  >
                    Process now
                  </Button>
                </span>
              </Tooltip>
              <Chip
                label="Coming soon"
                size="small"
                variant="outlined"
                sx={{
                  color: tokens.neutral.textSecondary,
                  borderColor: tokens.neutral.border,
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  height: 22,
                }}
              />
            </Box>
          </Box>

          <LinearProgress
            variant="determinate"
            value={
              liveProgress.total > 0
                ? Math.round(((liveProgress.sent + liveProgress.delivered + liveProgress.read) / liveProgress.total) * 100)
                : 0
            }
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: tokens.neutral.subtleHover,
              "& .MuiLinearProgress-bar": { bgcolor: tokens.primary.main },
              mb: 2,
            }}
          />

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Chip size="small" label={`Queued: ${liveProgress.queued}`} sx={{ bgcolor: tokens.neutral.subtle }} />
            <Chip size="small" label={`Sending: ${liveProgress.sending}`} sx={{ bgcolor: tokens.neutral.subtleHover }} />
            <Chip
              size="small"
              label={`Sent: ${liveProgress.sent + liveProgress.delivered + liveProgress.read}`}
              sx={{ bgcolor: tokens.status.successBg, color: tokens.status.success, border: `1px solid ${tokens.status.successBorder}` }}
            />
            {liveProgress.failed > 0 && (
              <Chip
                size="small"
                label={`Failed: ${liveProgress.failed}`}
                sx={{ bgcolor: tokens.status.errorBg, color: tokens.status.error, border: `1px solid ${tokens.status.errorBorder}` }}
              />
            )}
          </Box>
        </Paper>
      )}

      {/* Summary KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2.4}>
          <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                Total Guests
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {summary ? summary.stats.totalGuests : "-"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2.4}>
          <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                Delivered / Sent
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: tokens.status.success }}>
                {summary ? summary.stats.sent + summary.stats.delivered + summary.stats.read : "-"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2.4}>
          <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                Unsent / Eligible
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {summary ? summary.stats.eligible : "-"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2.4}>
          <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                Failed Sends
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  mt: 0.5,
                  color: summary && summary.stats.failed > 0 ? tokens.status.error : tokens.neutral.textPrimary,
                }}
              >
                {summary ? summary.stats.failed : "-"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={8} md={2.4}>
          <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                  Daily Send Cap
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {summary ? `${summary.caps.sentToday} / ${summary.caps.dailyCap}` : "-"}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {summary ? `${summary.caps.remainingToday} left` : "-"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bulk Action Bar (Visible when guests are selected) */}
      {selectedIds.length > 0 && (
        <Paper
          elevation={1}
          sx={{
            p: 2,
            mb: 3,
            bgcolor: tokens.neutral.subtle,
            border: `1px solid ${tokens.neutral.border}`,
            borderRadius: 2,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Chip
              label={`${selectedIds.length} selected`}
              size="small"
              sx={{ fontWeight: 700, bgcolor: tokens.primary.main, color: tokens.neutral.white }}
            />
            <Button size="small" onClick={() => setSelectedIds([])} sx={{ color: tokens.neutral.textSecondary }}>
              Deselect All
            </Button>
          </Box>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", width: { xs: "100%", sm: "auto" } }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Layers />}
              onClick={() => setBulkAccessLevelOpen(true)}
              sx={{ minHeight: 38, borderColor: tokens.neutral.border, color: tokens.neutral.textPrimary }}
            >
              Assign Access Tier
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PersonAdd />}
              onClick={() => setBulkSenderOpen(true)}
              sx={{ minHeight: 38, borderColor: tokens.neutral.border, color: tokens.neutral.textPrimary }}
            >
              Assign Sender
            </Button>
            {!isManualMode && (
              <Button
                variant="contained"
                size="small"
                startIcon={<Send />}
                onClick={() => {
                  setSendTargetType("selected");
                  setConfirmSendOpen(true);
                }}
                disabled={remainingCap <= 0}
                sx={{
                  minHeight: 38,
                  bgcolor: tokens.primary.main,
                  color: tokens.neutral.white,
                  "&:hover": { bgcolor: tokens.primary.dark },
                }}
              >
                Send to Selected ({selectedIds.length})
              </Button>
            )}
          </Box>
        </Paper>
      )}

      {/* Filter and Search Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          border: `1px solid ${tokens.neutral.border}`,
          borderRadius: 2,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          alignItems: "center",
        }}
      >
        <TextField
          placeholder="Search guest name, phone, city, or group..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          size="small"
          fullWidth
          InputProps={{
            startAdornment: <Search sx={{ color: tokens.neutral.textSecondary, mr: 1, fontSize: 20 }} />,
          }}
          sx={{ maxWidth: { md: 360 } }}
        />

        <Box sx={{ display: "flex", gap: 1.5, flex: 1, width: "100%", flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="not_invited">Not Sent</MenuItem>
              <MenuItem value="queued">Queued</MenuItem>
              <MenuItem value="sent">Sent / Delivered</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              {isManualMode && <MenuItem value="unassigned_sender">Unassigned Sender</MenuItem>}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Access Tier</InputLabel>
            <Select
              value={accessLevelFilter}
              label="Access Tier"
              onChange={(e) => {
                setAccessLevelFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">All Access Tiers</MenuItem>
              <MenuItem value="none">No Tier Assigned</MenuItem>
              {accessLevels.map((lvl) => (
                <MenuItem key={lvl.id} value={lvl.id}>
                  {lvl.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Sender</InputLabel>
            <Select
              value={senderFilter}
              label="Sender"
              onChange={(e) => {
                setSenderFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">All Senders</MenuItem>
              <MenuItem value="none">Unassigned</MenuItem>
              {senders.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s._count.guests})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Guest Table Container */}
      <Paper elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress sx={{ color: tokens.primary.main }} />
          </Box>
        ) : guests.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, px: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              No guests found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Try adjusting your search criteria or add new guests in the Guests section.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table sx={{ minWidth: 800 }}>
                <TableHead sx={{ bgcolor: tokens.neutral.subtle }}>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isAllPageSelected}
                        indeterminate={selectedIds.length > 0 && !isAllPageSelected && guests.some((g) => selectedIds.includes(g.id))}
                        onChange={handleSelectAllOnPage}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Guest</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Group</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Access Tier</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Sender</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">
                      Delivery
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {guests.map((guest) => {
                    const isSelected = selectedIds.includes(guest.id);
                    return (
                      <TableRow
                        key={guest.id}
                        hover
                        selected={isSelected}
                        sx={{
                          "&.Mui-selected": { bgcolor: tokens.neutral.subtleHover },
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={isSelected} onChange={() => handleToggleSelectOne(guest.id)} />
                        </TableCell>

                        {/* Guest info */}
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {guest.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Pax: {guest.pax} {guest.city ? `• ${guest.city}` : ""}
                          </Typography>
                        </TableCell>

                        {/* Phone */}
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                            {guest.phone || "—"}
                          </Typography>
                        </TableCell>

                        {/* Group */}
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {guest.group || "—"}
                          </Typography>
                        </TableCell>

                        {/* Access Tier */}
                        <TableCell>
                          {guest.accessLevel ? (
                            <Chip
                              label={guest.accessLevel.name}
                              size="small"
                              sx={{
                                bgcolor: tokens.neutral.subtleHover,
                                color: tokens.neutral.textPrimary,
                                fontWeight: 500,
                              }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              All Events (Default)
                            </Typography>
                          )}
                        </TableCell>

                        {/* Sender */}
                        <TableCell>
                          {guest.sender ? (
                            <Chip
                              label={guest.sender.name}
                              size="small"
                              sx={{
                                bgcolor: tokens.neutral.subtleHover,
                                color: tokens.neutral.textPrimary,
                                fontWeight: 500,
                              }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              Unassigned
                            </Typography>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {guest.inviteStatus === "sent" || guest.inviteStatus === "delivered" || guest.inviteStatus === "read" ? (
                            <Chip
                              label={guest.inviteStatus.toUpperCase()}
                              size="small"
                              sx={{
                                bgcolor: tokens.status.successBg,
                                color: tokens.status.success,
                                border: `1px solid ${tokens.status.successBorder}`,
                                fontWeight: 600,
                                fontSize: "0.7rem",
                              }}
                            />
                          ) : guest.inviteStatus === "queued" ? (
                            <Chip
                              icon={<Schedule sx={{ fontSize: 14 }} />}
                              label="QUEUED"
                              size="small"
                              sx={{
                                bgcolor: tokens.neutral.subtleHover,
                                color: tokens.neutral.textPrimary,
                                fontWeight: 600,
                                fontSize: "0.7rem",
                              }}
                            />
                          ) : guest.inviteStatus === "failed" ? (
                            <Tooltip title={guest.latestLog?.errorMessage || "Delivery failed"}>
                              <Chip
                                label="FAILED"
                                size="small"
                                sx={{
                                  bgcolor: tokens.status.errorBg,
                                  color: tokens.status.error,
                                  border: `1px solid ${tokens.status.errorBorder}`,
                                  fontWeight: 600,
                                  fontSize: "0.7rem",
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Chip
                              label="NOT SENT"
                              size="small"
                              sx={{
                                bgcolor: tokens.neutral.subtle,
                                color: tokens.neutral.textSecondary,
                                fontWeight: 500,
                                fontSize: "0.7rem",
                              }}
                            />
                          )}
                        </TableCell>

                        {/* Delivery Timestamp / Actions */}
                        <TableCell align="right">
                          <Typography variant="caption" color="text.secondary">
                            {guest.latestLog?.sentAt
                              ? new Date(guest.latestLog.sentAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </Paper>

      {/* Confirmation Dialog: Send Invitations */}
      <Dialog
        open={confirmSendOpen}
        onClose={() => !actionLoading && setConfirmSendOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {sendTargetType === "selected"
            ? `Send Invitations to ${selectedIds.length} Guests?`
            : `Send Invitations to All Eligible Guests?`}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              This will queue wedding invitation messages to be dispatched via{" "}
              <strong>
                {summary?.sendingMethod === "whatsapp_cloud" ? "WhatsApp Cloud API" : "Mock Provider"}
              </strong>
              .
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: tokens.neutral.subtle,
              border: `1px solid ${tokens.neutral.border}`,
              borderRadius: 2,
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Targeted guests to send:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {eligibleToSendCount} guests
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Remaining daily send cap:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {remainingCap} messages
              </Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Messages to queue right now:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.primary.main }}>
                {Math.min(eligibleToSendCount, remainingCap)}
              </Typography>
            </Box>
          </Paper>

          {isCapExceeded && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              The number of targeted guests ({eligibleToSendCount}) exceeds today&apos;s remaining daily cap ({remainingCap}).
              Only {remainingCap} messages will be dispatched today; the remaining guests can be queued after the cap window rolls over.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setConfirmSendOpen(false)}
            disabled={actionLoading}
            sx={{ color: tokens.neutral.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSendInvitations}
            disabled={actionLoading || remainingCap <= 0}
            startIcon={actionLoading ? <CircularProgress size={18} color="inherit" /> : <Send />}
            sx={{
              bgcolor: tokens.primary.main,
              color: tokens.neutral.white,
              "&:hover": { bgcolor: tokens.primary.dark },
            }}
          >
            {actionLoading ? "Queueing..." : "Confirm & Send"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog: Retry Failed */}
      <Dialog
        open={confirmRetryOpen}
        onClose={() => !actionLoading && setConfirmRetryOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Retry Failed Invitations?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            There are {summary?.stats.failed} invitations that previously failed to deliver. Retrying will reset their
            delivery attempts and re-enqueue them for sending.
          </Typography>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: tokens.neutral.subtle,
              border: `1px solid ${tokens.neutral.border}`,
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Failed invitations to retry:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.status.error }}>
                {summary?.stats.failed}
              </Typography>
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setConfirmRetryOpen(false)}
            disabled={actionLoading}
            sx={{ color: tokens.neutral.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRetryFailed}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={18} color="inherit" /> : <Refresh />}
            sx={{
              bgcolor: tokens.primary.main,
              color: tokens.neutral.white,
              "&:hover": { bgcolor: tokens.primary.dark },
            }}
          >
            {actionLoading ? "Re-queueing..." : "Retry Failed Now"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Bulk Assign Access Tier */}
      <Dialog
        open={bulkAccessLevelOpen}
        onClose={() => !actionLoading && setBulkAccessLevelOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Assign Access Tier</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Assign an access tier to the {selectedIds.length} selected guests:
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Select Access Tier</InputLabel>
            <Select
              value={selectedAccessLevelId}
              label="Select Access Tier"
              onChange={(e) => setSelectedAccessLevelId(e.target.value)}
            >
              <MenuItem value="none">None (All Events)</MenuItem>
              {accessLevels.map((lvl) => (
                <MenuItem key={lvl.id} value={lvl.id}>
                  {lvl.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setBulkAccessLevelOpen(false)}
            disabled={actionLoading}
            sx={{ color: tokens.neutral.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleBulkAssignAccessLevel}
            disabled={actionLoading}
            sx={{
              bgcolor: tokens.primary.main,
              color: tokens.neutral.white,
              "&:hover": { bgcolor: tokens.primary.dark },
            }}
          >
            {actionLoading ? "Saving..." : "Apply to Selected"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Bulk Assign Sender */}
      <Dialog
        open={bulkSenderOpen}
        onClose={() => !actionLoading && setBulkSenderOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Assign Sender</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Assign a sender to the {selectedIds.length} selected guests:
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Select Sender</InputLabel>
            <Select
              value={selectedSenderId}
              label="Select Sender"
              onChange={(e) => setSelectedSenderId(e.target.value)}
            >
              <MenuItem value="none">Unassign Sender</MenuItem>
              {senders.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s._count.guests} assigned)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setBulkSenderOpen(false)}
            disabled={actionLoading}
            sx={{ color: tokens.neutral.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleBulkAssignSender}
            disabled={actionLoading}
            sx={{
              bgcolor: tokens.primary.main,
              color: tokens.neutral.white,
              "&:hover": { bgcolor: tokens.primary.dark },
            }}
          >
            {actionLoading ? "Saving..." : "Apply to Selected"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Auto-Split Unassigned Guests */}
      <Dialog
        open={autoSplitOpen}
        onClose={() => !actionLoading && setAutoSplitOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Auto-Split Unassigned Guests</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will evenly distribute all unassigned guests across your {senders.length} active senders using a
            round-robin algorithm.
          </Typography>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: tokens.neutral.subtle,
              border: `1px solid ${tokens.neutral.border}`,
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Unassigned guests:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {summary?.stats.unassignedSender ?? 0}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Active senders:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {senders.length}
              </Typography>
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setAutoSplitOpen(false)}
            disabled={actionLoading}
            sx={{ color: tokens.neutral.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAutoSplit}
            disabled={actionLoading || senders.length === 0 || (summary?.stats.unassignedSender ?? 0) === 0}
            startIcon={actionLoading ? <CircularProgress size={18} color="inherit" /> : <People />}
            sx={{
              bgcolor: tokens.primary.main,
              color: tokens.neutral.white,
              "&:hover": { bgcolor: tokens.primary.dark },
            }}
          >
            {actionLoading ? "Splitting..." : "Distribute Guests"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
