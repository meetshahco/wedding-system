"use client";

import { useState, useEffect, useCallback, use } from "react";
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
} from "@mui/material";
import {
  Send,
  CheckCircle,
  Undo,
  Lock,
  Phone,
  LocationOn,
  Group as GroupIcon,
  SearchOff,
  EventBusy,
  Block,
  Favorite,
} from "@mui/icons-material";
import { tokens } from "@/lib/theme";

interface GuestItem {
  id: string;
  name: string;
  phone: string;
  city: string;
  group: string;
  pax: number;
  code: string;
  inviteStatus: "not_invited" | "sent" | "delivered" | "read" | "failed";
  message: string;
  waMeUrl: string;
  inviteUrl: string;
}

interface SenderData {
  sender: {
    id: string;
    name: string;
    hasPin: boolean;
    messageOverride?: string | null;
  };
  wedding: {
    id: string;
    coupleNames: string;
    weddingDate: string;
    accentColor: string;
  };
  guests: GuestItem[];
  stats: {
    total: number;
    sent: number;
    pending: number;
  };
}

export default function SenderPage({
  params,
}: {
  params: Promise<{ accessToken: string }>;
}) {
  const { accessToken } = use(params);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SenderData | null>(null);
  const [errorState, setErrorState] = useState<{
    message: string;
    type: "notFound" | "expired" | "revoked" | "generic";
  } | null>(null);

  // PIN state
  const [pinRequired, setPinRequired] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // Tabs: 0: All, 1: Pending, 2: Sent
  const [filterTab, setFilterTab] = useState(1);

  // Track guests where user clicked WhatsApp button and is prompted "Did you send it?"
  const [promptingSentId, setPromptingSentId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const fetchSenderData = useCallback(async (enteredPin?: string) => {
    setLoading(true);
    setErrorState(null);

    try {
      const headers: Record<string, string> = {};
      if (enteredPin) {
        headers["x-sender-pin"] = enteredPin;
      }

      const res = await fetch(`/api/s/${accessToken}`, { headers });
      const json = await res.json();

      if (res.status === 401 && json.pinRequired) {
        setPinRequired(true);
        if (json.error) setPinError(json.error);
        setLoading(false);
        return;
      }

      if (res.status === 403) {
        if (json.revoked) {
          setErrorState({ message: json.error, type: "revoked" });
        } else if (json.expired) {
          setErrorState({ message: json.error, type: "expired" });
        } else {
          setErrorState({ message: json.error, type: "generic" });
        }
        setLoading(false);
        return;
      }

      if (res.status === 404) {
        setErrorState({ message: "Sender link not found.", type: "notFound" });
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setErrorState({ message: json.error || "Failed to load sender portal.", type: "generic" });
        setLoading(false);
        return;
      }

      setPinRequired(false);
      setData(json);
    } catch {
      setErrorState({ message: "Connection error. Please try again.", type: "generic" });
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchSenderData();
  }, [fetchSenderData]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setPinSubmitting(true);
    setPinError(null);
    await fetchSenderData(pin);
    setPinSubmitting(false);
  };

  const handleMarkStatus = async (guestId: string, action: "sent" | "undo") => {
    setStatusUpdatingId(guestId);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (pin) headers["x-sender-pin"] = pin;

      const res = await fetch(`/api/s/${accessToken}/status`, {
        method: "POST",
        headers,
        body: JSON.stringify({ guestId, action }),
      });

      if (res.ok) {
        setPromptingSentId(null);
        // Refresh data
        await fetchSenderData(pin);
      }
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Render Error states
  if (errorState) {
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
          {errorState.type === "revoked" && (
            <Block sx={{ fontSize: 52, color: tokens.status.error, mb: 1.5 }} />
          )}
          {errorState.type === "expired" && (
            <EventBusy sx={{ fontSize: 52, color: tokens.status.warning, mb: 1.5 }} />
          )}
          {errorState.type === "notFound" && (
            <SearchOff sx={{ fontSize: 52, color: tokens.neutral.textSecondary, mb: 1.5 }} />
          )}
          {errorState.type === "generic" && (
            <SearchOff sx={{ fontSize: 52, color: tokens.neutral.textSecondary, mb: 1.5 }} />
          )}

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            {errorState.type === "revoked"
              ? "Link Revoked"
              : errorState.type === "expired"
              ? "Link Expired"
              : "Sender Portal Unavailable"}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {errorState.message}
          </Typography>
        </Paper>
      </Box>
    );
  }

  // Render PIN prompt
  if (pinRequired) {
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
            width: "100%",
            maxWidth: 400,
            p: 4,
            textAlign: "center",
            borderRadius: 2,
            borderColor: tokens.neutral.border,
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: tokens.neutral.subtle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <Lock sx={{ color: tokens.primary.main }} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Sender Security PIN
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Please enter your 4-digit security PIN to access your guest list.
          </Typography>

          {pinError && (
            <Alert severity="error" sx={{ mb: 2.5, textAlign: "left" }}>
              {pinError}
            </Alert>
          )}

          <form onSubmit={handlePinSubmit}>
            <TextField
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000"
              type="password"
              autoFocus
              fullWidth
              inputProps={{
                maxLength: 4,
                inputMode: "numeric",
                pattern: "[0-9]*",
                style: {
                  textAlign: "center",
                  fontSize: "1.75rem",
                  letterSpacing: "0.5rem",
                  fontWeight: 700,
                  padding: "10px 14px",
                },
              }}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={pinSubmitting || pin.length < 4}
              sx={{ minHeight: 48 }}
            >
              {pinSubmitting ? <CircularProgress size={22} color="inherit" /> : "Unlock Dashboard"}
            </Button>
          </form>
        </Paper>
      </Box>
    );
  }

  if (loading || !data) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={36} color="inherit" />
      </Box>
    );
  }

  const { sender, wedding, guests, stats } = data;
  const accentColor = wedding.accentColor || tokens.primary.main;
  const progressPercent = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;

  // Filter guests
  const filteredGuests = guests.filter((g) => {
    if (filterTab === 1) return g.inviteStatus !== "sent";
    if (filterTab === 2) return g.inviteStatus === "sent";
    return true;
  });

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: tokens.neutral.subtle, py: { xs: 3, sm: 5 }, px: { xs: 2, sm: 3 } }}>
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        {/* Header Hero */}
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
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Favorite sx={{ color: accentColor, fontSize: 20 }} />
                <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: "0.1rem" }}>
                  {wedding.coupleNames}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Sender: {sender.name}
              </Typography>
            </Box>

            <Chip
              label={`${stats.sent} / ${stats.total} Sent (${progressPercent}%)`}
              sx={{
                fontWeight: 700,
                bgcolor: progressPercent === 100 ? tokens.status.successBg : tokens.neutral.subtle,
                color: progressPercent === 100 ? tokens.status.success : tokens.neutral.textPrimary,
                border: `1px solid ${tokens.neutral.border}`,
              }}
            />
          </Box>

          <Box sx={{ mt: 2.5 }}>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: tokens.neutral.subtleHover,
                "& .MuiLinearProgress-bar": {
                  bgcolor: accentColor,
                },
              }}
            />
          </Box>
        </Paper>

        {/* Filter Tabs */}
        <Paper variant="outlined" sx={{ mb: 3, borderColor: tokens.neutral.border, bgcolor: tokens.neutral.white }}>
          <Tabs
            value={filterTab}
            onChange={(_, val) => setFilterTab(val)}
            indicatorColor="primary"
            textColor="primary"
            sx={{ px: 2, borderBottom: `1px solid ${tokens.neutral.border}` }}
          >
            <Tab label={`To Send (${stats.pending})`} sx={{ minHeight: 48, fontWeight: 600 }} />
            <Tab label={`Already Sent (${stats.sent})`} sx={{ minHeight: 48, fontWeight: 600 }} />
            <Tab label={`All (${stats.total})`} sx={{ minHeight: 48, fontWeight: 600 }} />
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {filteredGuests.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 5 }}>
                <CheckCircle sx={{ fontSize: 44, color: tokens.status.success, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {filterTab === 1 ? "All caught up!" : "No guests in this view."}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {filterTab === 1 ? "You have sent invitations to all your assigned guests." : ""}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                {filteredGuests.map((guest) => {
                  const isSent = guest.inviteStatus === "sent";
                  const isPrompting = promptingSentId === guest.id;
                  const isUpdating = statusUpdatingId === guest.id;

                  return (
                    <Card
                      key={guest.id}
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        borderColor: isSent ? tokens.status.successBorder : tokens.neutral.border,
                        bgcolor: isSent ? tokens.neutral.white : tokens.neutral.white,
                      }}
                    >
                      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1, gap: 1 }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                              {guest.name}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Phone fontSize="small" sx={{ color: tokens.neutral.textSecondary, fontSize: 16 }} />
                                <Typography variant="caption" color="text.secondary">
                                  {guest.phone}
                                </Typography>
                              </Box>

                              {guest.city && (
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  <LocationOn fontSize="small" sx={{ color: tokens.neutral.textSecondary, fontSize: 16 }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {guest.city}
                                  </Typography>
                                </Box>
                              )}

                              {guest.group && (
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  <GroupIcon fontSize="small" sx={{ color: tokens.neutral.textSecondary, fontSize: 16 }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {guest.group}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>

                          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                            <Chip
                              label={`PAX: ${guest.pax}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 600 }}
                            />
                            {isSent ? (
                              <Chip
                                icon={<CheckCircle fontSize="small" />}
                                label="Sent"
                                size="small"
                                sx={{
                                  bgcolor: tokens.status.successBg,
                                  color: tokens.status.success,
                                  fontWeight: 700,
                                }}
                              />
                            ) : (
                              <Chip
                                label="Pending"
                                size="small"
                                sx={{
                                  bgcolor: tokens.neutral.subtle,
                                  color: tokens.neutral.textSecondary,
                                  fontWeight: 600,
                                }}
                              />
                            )}
                          </Box>
                        </Box>

                        {/* Message Preview */}
                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            bgcolor: tokens.neutral.subtle,
                            border: `1px solid ${tokens.neutral.border}`,
                            my: 1.5,
                            whiteSpace: "pre-wrap",
                            fontSize: "0.85rem",
                            lineHeight: 1.5,
                            color: tokens.neutral.textPrimary,
                            maxHeight: 140,
                            overflowY: "auto",
                          }}
                        >
                          {guest.message}
                        </Box>

                        <Divider sx={{ my: 1.5 }} />

                        {/* Actions Flow */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                          {!isSent ? (
                            <>
                              <Button
                                variant="contained"
                                startIcon={<Send />}
                                href={guest.waMeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setPromptingSentId(guest.id)}
                                sx={{
                                  minHeight: 44,
                                  bgcolor: accentColor,
                                  flex: { xs: "1 1 100%", sm: "none" },
                                  "&:hover": { bgcolor: tokens.primary.dark },
                                }}
                              >
                                Send on WhatsApp
                              </Button>

                              {isPrompting ? (
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    bgcolor: tokens.neutral.subtle,
                                    p: 1,
                                    borderRadius: 1,
                                    flex: { xs: "1 1 100%", sm: "none" },
                                  }}
                                >
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    Did you send it?
                                  </Typography>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    onClick={() => handleMarkStatus(guest.id, "sent")}
                                    disabled={isUpdating}
                                    sx={{ minHeight: 36, bgcolor: tokens.status.success }}
                                  >
                                    {isUpdating ? <CircularProgress size={16} color="inherit" /> : "Yes, Sent"}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => setPromptingSentId(null)}
                                    sx={{ minHeight: 36 }}
                                  >
                                    Not Yet
                                  </Button>
                                </Box>
                              ) : (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => handleMarkStatus(guest.id, "sent")}
                                  disabled={isUpdating}
                                  sx={{ minHeight: 44, flex: { xs: "1 1 100%", sm: "none" } }}
                                >
                                  Mark as Sent
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <CheckCircle sx={{ color: tokens.status.success, fontSize: 20 }} />
                                <Typography variant="body2" sx={{ color: tokens.status.success, fontWeight: 600 }}>
                                  Sent to guest
                                </Typography>
                              </Box>

                              <Box sx={{ display: "flex", gap: 1 }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<Send fontSize="small" />}
                                  href={guest.waMeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{ minHeight: 36 }}
                                >
                                  Resend
                                </Button>
                                <Button
                                  variant="text"
                                  size="small"
                                  color="inherit"
                                  startIcon={<Undo fontSize="small" />}
                                  onClick={() => handleMarkStatus(guest.id, "undo")}
                                  disabled={isUpdating}
                                  sx={{ minHeight: 36, color: tokens.neutral.textSecondary }}
                                >
                                  {isUpdating ? <CircularProgress size={16} color="inherit" /> : "Undo"}
                                </Button>
                              </Box>
                            </>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
