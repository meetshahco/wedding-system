"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Add,
  Refresh,
  Schedule,
  CheckCircle,
  Error as ErrorIcon,
  Close,
  Send,
  Delete,
  Edit,
  People,
  Campaign,
  Description,
  ArrowForward,
} from "@mui/icons-material";
import { tokens } from "@/lib/theme";

interface TemplateItem {
  id: string;
  key: string;
  language: string;
  category: string;
  body: string;
  buttons: string;
  sampleValues: string;
}

interface ReminderItem {
  id: string;
  title: string;
  templateKey: string;
  audienceFilter: {
    accessLevelId?: string;
    city?: string;
    group?: string;
    senderId?: string;
    notSentYet?: boolean;
    notOpenedYet?: boolean;
  };
  scheduledAt: string | null;
  status: "draft" | "scheduled" | "running" | "done" | "cancelled";
  createdAt: string;
  stats: {
    total: number;
    sent: number;
    queued: number;
    failed: number;
  };
}

export default function MessagesAndRemindersPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  // Data states
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [sendingMethod, setSendingMethod] = useState<"mock" | "whatsapp_cloud" | "manual">("mock");
  const [accessLevels, setAccessLevels] = useState<{ id: string; name: string }[]>([]);
  const [senders, setSenders] = useState<{ id: string; name: string }[]>([]);

  // Create Reminder / Round Dialog
  const [createReminderOpen, setCreateReminderOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [filterAccessLevel, setFilterAccessLevel] = useState("all");
  const [filterCity, setFilterCity] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterSender, setFilterSender] = useState("all");
  const [filterNotOpenedYet, setFilterNotOpenedYet] = useState(false);
  const [filterNotSentYet, setFilterNotSentYet] = useState(false);
  const [sendImmediately, setSendImmediately] = useState(true);
  const [scheduledDateTime, setScheduledDateTime] = useState("");

  // Audience Preview state
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [previewGuests, setPreviewGuests] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [calculatingAudience, setCalculatingAudience] = useState(false);

  // Template Create/Edit Dialog
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en");
  const [templateCategory, setTemplateCategory] = useState("Utility");
  const [templateBody, setTemplateBody] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [tplRes, remRes, metaRes] = await Promise.all([
        fetch("/api/admin/templates"),
        fetch("/api/admin/reminders"),
        fetch("/api/admin/invitations?limit=1"),
      ]);

      if (tplRes.ok) {
        const tplData = await tplRes.json();
        setTemplates(tplData.templates || []);
        if (tplData.templates?.length > 0 && !selectedTemplateKey) {
          setSelectedTemplateKey(tplData.templates[0].key);
        }
      }

      if (remRes.ok) {
        const remData = await remRes.json();
        setReminders(remData.reminders || []);
        setSendingMethod(remData.sendingMethod || "mock");
      }

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        setAccessLevels(metaData.accessLevels || []);
        setSenders(metaData.senders || []);
      }
    } catch {
      setFeedback({ message: "Failed to load messages and templates.", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [selectedTemplateKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Audience live preview calculation
  const recalculateAudience = useCallback(async () => {
    setCalculatingAudience(true);
    try {
      const res = await fetch("/api/admin/reminders/preview-audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessLevelId: filterAccessLevel === "all" ? undefined : filterAccessLevel,
          city: filterCity.trim() || undefined,
          group: filterGroup.trim() || undefined,
          senderId: filterSender === "all" ? undefined : filterSender,
          notOpenedYet: filterNotOpenedYet,
          notSentYet: filterNotSentYet,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAudienceCount(data.count);
        setPreviewGuests(data.guests.slice(0, 5));
      }
    } catch {
      // silent
    } finally {
      setCalculatingAudience(false);
    }
  }, [filterAccessLevel, filterCity, filterGroup, filterSender, filterNotOpenedYet, filterNotSentYet]);

  useEffect(() => {
    if (createReminderOpen) {
      recalculateAudience();
    }
  }, [createReminderOpen, recalculateAudience]);

  // Handle Create Reminder
  const handleCreateReminder = async () => {
    if (!reminderTitle.trim()) {
      setFeedback({ message: "Title is required.", severity: "error" });
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        title: reminderTitle.trim(),
        templateKey: selectedTemplateKey,
        audienceFilter: {
          accessLevelId: filterAccessLevel === "all" ? undefined : filterAccessLevel,
          city: filterCity.trim() || undefined,
          group: filterGroup.trim() || undefined,
          senderId: filterSender === "all" ? undefined : filterSender,
          notOpenedYet: filterNotOpenedYet,
          notSentYet: filterNotSentYet,
        },
        sendImmediately,
        scheduledAt: !sendImmediately && scheduledDateTime ? new Date(scheduledDateTime).toISOString() : null,
      };

      const res = await fetch("/api/admin/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule reminder");

      setFeedback({
        message: sendingMethod === "manual"
          ? `Created manual message round for ${data.totalQueued} recipients.`
          : `Scheduled reminder for ${data.totalQueued} recipients.`,
        severity: "success",
      });
      setCreateReminderOpen(false);
      setReminderTitle("");
      fetchData();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Reminder
  const handleCancelReminder = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/reminders/${id}/cancel`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel reminder");

      setFeedback({
        message: `Cancelled reminder and removed ${data.cancelledLogsCount} queued messages.`,
        severity: "success",
      });
      fetchData();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Save Template
  const handleSaveTemplate = async () => {
    if (!templateBody.trim()) {
      setFeedback({ message: "Template body cannot be empty.", severity: "error" });
      return;
    }
    setActionLoading(true);
    try {
      if (editingTemplateId) {
        const res = await fetch(`/api/admin/templates/${editingTemplateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: templateBody,
            category: templateCategory,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update template");
        setFeedback({ message: "Template updated successfully.", severity: "success" });
      } else {
        const res = await fetch("/api/admin/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: templateKey,
            language: templateLanguage,
            category: templateCategory,
            body: templateBody,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create template");
        setFeedback({ message: "Template created successfully.", severity: "success" });
      }

      setTemplateModalOpen(false);
      setEditingTemplateId(null);
      setTemplateKey("");
      setTemplateBody("");
      fetchData();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Template
  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete template");
      setFeedback({ message: "Template deleted.", severity: "success" });
      fetchData();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const isManualMode = sendingMethod === "manual";

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
              Messages & Reminders
            </Typography>
            <Chip
              label={
                isManualMode
                  ? "MANUAL SENDER ROUNDS"
                  : sendingMethod === "whatsapp_cloud"
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
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Create reminder campaigns with audience filtering, manage message templates, and track delivery rounds.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", width: { xs: "100%", sm: "auto" } }}>
          <Button
            variant="outlined"
            onClick={fetchData}
            startIcon={<Refresh />}
            sx={{ minHeight: 44, borderColor: tokens.neutral.border, color: tokens.neutral.textPrimary }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            onClick={() => setCreateReminderOpen(true)}
            startIcon={<Add />}
            sx={{
              minHeight: 44,
              bgcolor: tokens.primary.main,
              color: tokens.neutral.white,
              "&:hover": { bgcolor: tokens.primary.dark },
            }}
          >
            {isManualMode ? "New Message Round" : "New Reminder"}
          </Button>
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

      {/* Tabs */}
      <Tabs
        value={tabIndex}
        onChange={(_, val) => setTabIndex(val)}
        sx={{
          mb: 3,
          borderBottom: `1px solid ${tokens.neutral.border}`,
          "& .MuiTab-root": {
            fontWeight: 600,
            color: tokens.neutral.textSecondary,
            "&.Mui-selected": { color: tokens.primary.main },
          },
          "& .MuiTabs-indicator": { bgcolor: tokens.primary.main },
        }}
      >
        <Tab label={isManualMode ? "Message Rounds" : "Reminders & Broadcasts"} />
        <Tab label="Message Templates" />
      </Tabs>

      {/* TAB 0: REMINDERS & BROADCASTS / MESSAGE ROUNDS */}
      {tabIndex === 0 && (
        <Box>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress sx={{ color: tokens.primary.main }} />
            </Box>
          ) : reminders.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 6,
                textAlign: "center",
                border: `1px solid ${tokens.neutral.border}`,
                borderRadius: 2,
              }}
            >
              <Campaign sx={{ fontSize: 48, color: tokens.neutral.textMuted, mb: 1.5 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {isManualMode ? "No message rounds created yet" : "No reminders scheduled yet"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: "auto", mt: 0.5, mb: 3 }}>
                {isManualMode
                  ? "Message rounds allow you to send follow-up WhatsApp messages (dress code, schedule updates, etc.) through your assigned senders."
                  : "Send targeted broadcast reminders to guests based on their access tier, city, group, or open status."}
              </Typography>
              <Button
                variant="contained"
                onClick={() => setCreateReminderOpen(true)}
                startIcon={<Add />}
                sx={{
                  bgcolor: tokens.primary.main,
                  color: tokens.neutral.white,
                  "&:hover": { bgcolor: tokens.primary.dark },
                }}
              >
                {isManualMode ? "Create First Message Round" : "Create First Reminder"}
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {reminders.map((reminder) => {
                const total = reminder.stats.total;
                const completed = reminder.stats.sent;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <Grid item xs={12} key={reminder.id}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 3,
                        border: `1px solid ${tokens.neutral.border}`,
                        borderRadius: 2,
                        bgcolor: tokens.neutral.white,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: { xs: "column", sm: "row" },
                          justifyContent: "space-between",
                          alignItems: { xs: "flex-start", sm: "center" },
                          gap: 1.5,
                          mb: 2,
                        }}
                      >
                        <Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                              {reminder.title}
                            </Typography>
                            <Chip
                              label={reminder.status.toUpperCase()}
                              size="small"
                              sx={{
                                fontWeight: 600,
                                fontSize: "0.7rem",
                                bgcolor:
                                  reminder.status === "done"
                                    ? tokens.status.successBg
                                    : reminder.status === "scheduled" || reminder.status === "running"
                                    ? tokens.neutral.subtleHover
                                    : tokens.status.errorBg,
                                color:
                                  reminder.status === "done"
                                    ? tokens.status.success
                                    : reminder.status === "scheduled" || reminder.status === "running"
                                    ? tokens.neutral.textPrimary
                                    : tokens.status.error,
                                border: `1px solid ${tokens.neutral.border}`,
                              }}
                            />
                          </Box>

                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                            Template: <strong>{reminder.templateKey}</strong> • Created:{" "}
                            {new Date(reminder.createdAt).toLocaleDateString()}
                            {reminder.scheduledAt && ` • Scheduled: ${new Date(reminder.scheduledAt).toLocaleString()}`}
                          </Typography>
                        </Box>

                        {/* Actions */}
                        {reminder.status === "scheduled" && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleCancelReminder(reminder.id)}
                            disabled={actionLoading}
                            sx={{
                              borderColor: tokens.status.errorBorder,
                              color: tokens.status.error,
                              "&:hover": { bgcolor: tokens.status.errorBg },
                            }}
                          >
                            Cancel Reminder
                          </Button>
                        )}
                      </Box>

                      {/* Audience Filters applied */}
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                        {reminder.audienceFilter.accessLevelId && (
                          <Chip size="small" label={`Tier: ${reminder.audienceFilter.accessLevelId}`} sx={{ bgcolor: tokens.neutral.subtle }} />
                        )}
                        {reminder.audienceFilter.city && (
                          <Chip size="small" label={`City: ${reminder.audienceFilter.city}`} sx={{ bgcolor: tokens.neutral.subtle }} />
                        )}
                        {reminder.audienceFilter.group && (
                          <Chip size="small" label={`Group: ${reminder.audienceFilter.group}`} sx={{ bgcolor: tokens.neutral.subtle }} />
                        )}
                        {reminder.audienceFilter.notOpenedYet && (
                          <Chip size="small" label="Not Opened Yet" sx={{ bgcolor: tokens.status.warningBg, color: tokens.status.warning }} />
                        )}
                        {reminder.audienceFilter.notSentYet && (
                          <Chip size="small" label="Not Sent Yet" sx={{ bgcolor: tokens.neutral.subtle }} />
                        )}
                      </Box>

                      {/* Progress Bar */}
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Delivery Progress ({completed} of {total} sent)
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {pct}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: tokens.neutral.subtleHover,
                            "& .MuiLinearProgress-bar": { bgcolor: tokens.primary.main },
                          }}
                        />
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>
      )}

      {/* TAB 1: MESSAGE TEMPLATES */}
      {tabIndex === 1 && (
        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Configured WhatsApp Templates ({templates.length})
            </Typography>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
              <Tooltip title="Direct sync with Meta WhatsApp Business Account for template approvals is coming soon. In v1 manual mode, message templates render directly for family senders.">
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled
                    startIcon={<Refresh />}
                    sx={{
                      borderColor: tokens.neutral.border,
                      color: tokens.neutral.textSecondary,
                      textTransform: "none",
                      minHeight: 36,
                    }}
                  >
                    Sync with Meta
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
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  setEditingTemplateId(null);
                  setTemplateKey("");
                  setTemplateLanguage("en");
                  setTemplateCategory("Utility");
                  setTemplateBody("");
                  setTemplateModalOpen(true);
                }}
                startIcon={<Add />}
                sx={{
                  bgcolor: tokens.primary.main,
                  color: tokens.neutral.white,
                  "&:hover": { bgcolor: tokens.primary.dark },
                }}
              >
                Add Template
              </Button>
            </Box>
          </Box>

          <Grid container spacing={2}>
            {templates.map((tpl) => (
              <Grid item xs={12} md={6} key={tpl.id}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: `1px solid ${tokens.neutral.border}`,
                    borderRadius: 2,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, fontFamily: "monospace" }}>
                          {tpl.key}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                          <Chip
                            label={`Lang: ${tpl.language.toUpperCase()}`}
                            size="small"
                            sx={{ bgcolor: tokens.neutral.subtleHover, fontSize: "0.7rem", fontWeight: 600 }}
                          />
                          <Chip
                            label={tpl.category}
                            size="small"
                            sx={{ bgcolor: tokens.neutral.subtle, fontSize: "0.7rem" }}
                          />
                        </Box>
                      </Box>

                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingTemplateId(tpl.id);
                            setTemplateKey(tpl.key);
                            setTemplateLanguage(tpl.language);
                            setTemplateCategory(tpl.category);
                            setTemplateBody(tpl.body);
                            setTemplateModalOpen(true);
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        {tpl.key !== "invitation" && (
                          <IconButton size="small" onClick={() => handleDeleteTemplate(tpl.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Box>

                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        bgcolor: tokens.neutral.subtle,
                        border: `1px solid ${tokens.neutral.border}`,
                        borderRadius: 1.5,
                        fontSize: "0.85rem",
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        color: tokens.neutral.textPrimary,
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      {tpl.body}
                    </Paper>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* DIALOG: CREATE REMINDER / MESSAGE ROUND */}
      <Dialog
        open={createReminderOpen}
        onClose={() => !actionLoading && setCreateReminderOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {isManualMode ? "Create Manual Message Round" : "Schedule New Reminder"}
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Campaign / Round Title"
            placeholder="e.g. Sangeet Dress Code Reminder"
            value={reminderTitle}
            onChange={(e) => setReminderTitle(e.target.value)}
            fullWidth
            required
            size="small"
            sx={{ mb: 2.5 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
            <InputLabel>Template to Send</InputLabel>
            <Select
              value={selectedTemplateKey}
              label="Template to Send"
              onChange={(e) => setSelectedTemplateKey(e.target.value)}
            >
              {Array.from(new Set(templates.map((t) => t.key))).map((key) => (
                <MenuItem key={key} value={key}>
                  {key}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider sx={{ my: 2 }} />

          {/* Audience Filter Builder */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Audience Filtering
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Access Tier</InputLabel>
                <Select
                  value={filterAccessLevel}
                  label="Access Tier"
                  onChange={(e) => setFilterAccessLevel(e.target.value)}
                >
                  <MenuItem value="all">All Access Tiers</MenuItem>
                  <MenuItem value="none">No Tier Assigned</MenuItem>
                  {accessLevels.map((lvl) => (
                    <MenuItem key={lvl.id} value={lvl.id}>
                      {lvl.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Assigned Sender</InputLabel>
                <Select
                  value={filterSender}
                  label="Assigned Sender"
                  onChange={(e) => setFilterSender(e.target.value)}
                >
                  <MenuItem value="all">All Senders</MenuItem>
                  <MenuItem value="none">Unassigned Only</MenuItem>
                  {senders.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="City Filter"
                placeholder="e.g. Mumbai (leave blank for all)"
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Group Filter"
                placeholder="e.g. Bride Family"
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
          </Grid>

          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={filterNotOpenedYet}
                  onChange={(e) => setFilterNotOpenedYet(e.target.checked)}
                />
              }
              label="Target only guests who have NOT opened their invite yet"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={filterNotSentYet}
                  onChange={(e) => setFilterNotSentYet(e.target.checked)}
                />
              }
              label="Target only guests who have NOT been invited yet"
            />
          </Box>

          {/* Live Audience Counter */}
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
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Matching Recipients:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: tokens.primary.main }}>
                {calculatingAudience ? <CircularProgress size={16} /> : `${audienceCount ?? 0} guests`}
              </Typography>
            </Box>

            {previewGuests.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Sample: {previewGuests.map((g) => g.name).join(", ")}
                  {(audienceCount ?? 0) > previewGuests.length && ` + ${(audienceCount ?? 0) - previewGuests.length} more`}
                </Typography>
              </Box>
            )}
          </Paper>

          {/* Scheduling controls for API modes */}
          {!isManualMode && (
            <Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Delivery Timing
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={sendImmediately}
                    onChange={(e) => setSendImmediately(e.target.checked)}
                  />
                }
                label="Send immediately upon creation"
              />

              {!sendImmediately && (
                <TextField
                  label="Schedule Date & Time"
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={{ mt: 1.5 }}
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setCreateReminderOpen(false)}
            disabled={actionLoading}
            sx={{ color: tokens.neutral.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateReminder}
            disabled={actionLoading || audienceCount === 0}
            startIcon={actionLoading ? <CircularProgress size={18} color="inherit" /> : <Send />}
            sx={{
              bgcolor: tokens.primary.main,
              color: tokens.neutral.white,
              "&:hover": { bgcolor: tokens.primary.dark },
            }}
          >
            {actionLoading
              ? "Scheduling..."
              : isManualMode
              ? "Create Message Round"
              : sendImmediately
              ? "Send Broadcast Now"
              : "Schedule Reminder"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: CREATE / EDIT TEMPLATE */}
      <Dialog
        open={templateModalOpen}
        onClose={() => !actionLoading && setTemplateModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingTemplateId ? "Edit Message Template" : "Add Message Template"}
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Template Key"
            placeholder="e.g. sangeet_dress_code"
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_"))}
            fullWidth
            required
            size="small"
            disabled={Boolean(editingTemplateId)}
            sx={{ mb: 2 }}
          />

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Language</InputLabel>
                <Select
                  value={templateLanguage}
                  label="Language"
                  disabled={Boolean(editingTemplateId)}
                  onChange={(e) => setTemplateLanguage(e.target.value)}
                >
                  <MenuItem value="en">English (en)</MenuItem>
                  <MenuItem value="hi">Hindi (hi)</MenuItem>
                  <MenuItem value="gu">Gujarati (gu)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={templateCategory}
                  label="Category"
                  onChange={(e) => setTemplateCategory(e.target.value)}
                >
                  <MenuItem value="Utility">Utility</MenuItem>
                  <MenuItem value="Marketing">Marketing</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TextField
            label="Template Body"
            placeholder="Hi {{guest_name}}, here is your wedding update..."
            value={templateBody}
            onChange={(e) => setTemplateBody(e.target.value)}
            multiline
            rows={5}
            fullWidth
            required
            sx={{ mb: 2 }}
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              Insert Variable Tags:
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {[
                "{{guest_name}}",
                "{{couple_names}}",
                "{{wedding_date}}",
                "{{pax}}",
                "{{code}}",
                "{{invite_url}}",
                "{{access_level}}",
              ].map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onClick={() => setTemplateBody((prev) => `${prev} ${tag}`)}
                  sx={{ cursor: "pointer", bgcolor: tokens.neutral.subtleHover, fontSize: "0.72rem" }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setTemplateModalOpen(false)}
            disabled={actionLoading}
            sx={{ color: tokens.neutral.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveTemplate}
            disabled={actionLoading}
            sx={{
              bgcolor: tokens.primary.main,
              color: tokens.neutral.white,
              "&:hover": { bgcolor: tokens.primary.dark },
            }}
          >
            {actionLoading ? "Saving..." : "Save Template"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
