"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  CardActions,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
} from "@mui/material";
import {
  Add,
  ContentCopy,
  Autorenew,
  Block,
  Edit,
  DeleteOutline,
  People,
  CallSplit,
  Close,
  Lock,
  Phone,
  Link as LinkIcon,
} from "@mui/icons-material";
import { tokens } from "@/lib/theme";

interface SenderItem {
  id: string;
  name: string;
  phone?: string | null;
  accessToken: string;
  pin?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  messageOverride?: string | null;
  createdAt: string;
  _count?: {
    guests: number;
  };
}

export default function SendersPage() {
  const [loading, setLoading] = useState(true);
  const [senders, setSenders] = useState<SenderItem[]>([]);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(
    null
  );

  // Add / Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSender, setEditingSender] = useState<SenderItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [messageOverride, setMessageOverride] = useState("");

  // Auto Split Dialog
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [selectedSplitSenderIds, setSelectedSplitSenderIds] = useState<string[]>([]);
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [splitSubmitting, setSplitSubmitting] = useState(false);

  // Delete Confirmation
  const [deletingSender, setDeletingSender] = useState<SenderItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchSenders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/senders");
      const json = await res.json();
      setSenders(json.senders || []);
    } catch {
      setToast({ message: "Failed to load senders", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSenders();
  }, []);

  const openCreateDialog = () => {
    setEditingSender(null);
    setName("");
    setPhone("");
    setPin("");
    setExpiresAt("");
    setMessageOverride("");
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (s: SenderItem) => {
    setEditingSender(s);
    setName(s.name);
    setPhone(s.phone || "");
    setPin(s.pin || "");
    setExpiresAt(s.expiresAt ? new Date(s.expiresAt).toISOString().split("T")[0] : "");
    setMessageOverride(s.messageOverride || "");
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSaveSender = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      pin: pin.trim() || null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      messageOverride: messageOverride.trim() || null,
    };

    try {
      const url = editingSender ? `/api/admin/senders/${editingSender.id}` : "/api/admin/senders";
      const method = editingSender ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to save sender");
        return;
      }

      setToast({
        message: editingSender ? "Sender updated" : "Sender created successfully",
        severity: "success",
      });
      setDialogOpen(false);
      fetchSenders();
    } catch {
      setFormError("Network error while saving sender");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = (accessToken: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const fullUrl = `${origin}/s/${accessToken}`;
    navigator.clipboard.writeText(fullUrl);
    setToast({ message: "Sender link copied to clipboard", severity: "success" });
  };

  const handleRegenerateToken = async (senderId: string) => {
    try {
      const res = await fetch(`/api/admin/senders/${senderId}/regenerate`, { method: "POST" });
      if (!res.ok) {
        setToast({ message: "Failed to regenerate link", severity: "error" });
        return;
      }
      setToast({ message: "Sender link regenerated. Old link is revoked.", severity: "success" });
      fetchSenders();
    } catch {
      setToast({ message: "Error regenerating token", severity: "error" });
    }
  };

  const handleRevokeSender = async (senderId: string) => {
    try {
      const res = await fetch(`/api/admin/senders/${senderId}/revoke`, { method: "POST" });
      if (!res.ok) {
        setToast({ message: "Failed to revoke link", severity: "error" });
        return;
      }
      setToast({ message: "Sender link revoked", severity: "success" });
      fetchSenders();
    } catch {
      setToast({ message: "Error revoking link", severity: "error" });
    }
  };

  const handleDeleteSender = async () => {
    if (!deletingSender) return;
    setDeleteSubmitting(true);

    try {
      const res = await fetch(`/api/admin/senders/${deletingSender.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        setToast({ message: json.error || "Failed to delete sender", severity: "error" });
        return;
      }

      setToast({ message: "Sender deleted and guests unassigned safely", severity: "success" });
      setDeletingSender(null);
      fetchSenders();
    } catch {
      setToast({ message: "Error deleting sender", severity: "error" });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openAutoSplitDialog = () => {
    setSelectedSplitSenderIds(senders.map((s) => s.id));
    setUnassignedOnly(true);
    setSplitDialogOpen(true);
  };

  const handleAutoSplit = async () => {
    if (selectedSplitSenderIds.length === 0) return;
    setSplitSubmitting(true);

    try {
      const res = await fetch("/api/admin/senders/auto-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderIds: selectedSplitSenderIds,
          unassignedOnly,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setToast({ message: json.error || "Failed to auto-split guests", severity: "error" });
        return;
      }

      setToast({
        message: `Successfully distributed ${json.splitCount} guests among ${selectedSplitSenderIds.length} senders`,
        severity: "success",
      });
      setSplitDialogOpen(false);
      fetchSenders();
    } catch {
      setToast({ message: "Error during auto-split", severity: "error" });
    } finally {
      setSplitSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "text.primary" }}>
            Senders & Manual Dispatch
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Empower family members and committee coordinators with dedicated WhatsApp dispatch links.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {senders.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<CallSplit />}
              onClick={openAutoSplitDialog}
              sx={{ minHeight: 44 }}
            >
              Auto-Split Guests
            </Button>
          )}

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openCreateDialog}
            sx={{ minHeight: 44 }}
          >
            Add Sender
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      {loading ? (
        <Box sx={{ p: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={32} color="inherit" />
        </Box>
      ) : senders.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 6,
            textAlign: "center",
            borderRadius: 2,
            borderColor: tokens.neutral.border,
            bgcolor: tokens.neutral.white,
          }}
        >
          <People sx={{ fontSize: 48, color: "text.secondary", mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            No senders configured
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 440, mx: "auto" }}>
            Create sender profiles to distribute WhatsApp invitations among family members or volunteers.
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={openCreateDialog} sx={{ minHeight: 44 }}>
            Create First Sender
          </Button>
        </Paper>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
            },
            gap: 2.5,
          }}
        >
          {senders.map((s) => {
            const isRevoked = Boolean(s.revokedAt);
            const isExpired = Boolean(s.expiresAt && new Date(s.expiresAt) < new Date());
            const hasPin = Boolean(s.pin);

            return (
              <Card
                key={s.id}
                variant="outlined"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 2,
                  borderColor: isRevoked ? tokens.status.errorBorder : tokens.neutral.border,
                  bgcolor: tokens.neutral.white,
                }}
              >
                <CardContent sx={{ flex: 1, pb: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {s.name}
                    </Typography>

                    <Chip
                      icon={<People fontSize="small" />}
                      label={`${s._count?.guests ?? 0} Guests`}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>

                  {s.phone && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                      <Phone fontSize="small" sx={{ color: tokens.neutral.textSecondary, fontSize: 16 }} />
                      <Typography variant="body2" color="text.secondary">
                        {s.phone}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", my: 1.5 }}>
                    {isRevoked ? (
                      <Chip
                        icon={<Block fontSize="small" />}
                        label="Revoked"
                        size="small"
                        sx={{ bgcolor: tokens.status.errorBg, color: tokens.status.error, fontWeight: 700 }}
                      />
                    ) : isExpired ? (
                      <Chip
                        label="Expired"
                        size="small"
                        sx={{ bgcolor: tokens.status.warningBg, color: tokens.status.warning, fontWeight: 700 }}
                      />
                    ) : (
                      <Chip
                        label="Active Link"
                        size="small"
                        sx={{ bgcolor: tokens.status.successBg, color: tokens.status.success, fontWeight: 700 }}
                      />
                    )}

                    {hasPin && (
                      <Chip
                        icon={<Lock fontSize="small" />}
                        label="PIN Protected"
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: "0.75rem" }}
                      />
                    )}
                  </Box>

                  {s.messageOverride && (
                    <Box sx={{ p: 1, borderRadius: 1, bgcolor: tokens.neutral.subtle, mb: 1.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
                        Custom Message Override:
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {s.messageOverride}
                      </Typography>
                    </Box>
                  )}

                  <Divider sx={{ my: 1 }} />

                  {/* Copy Link Button */}
                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    startIcon={<ContentCopy fontSize="small" />}
                    onClick={() => handleCopyLink(s.accessToken)}
                    disabled={isRevoked}
                    sx={{ minHeight: 38, mb: 1 }}
                  >
                    Copy Portal Link
                  </Button>
                </CardContent>

                <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 1.5, pt: 0 }}>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Tooltip title="Regenerate Link Token">
                      <IconButton size="small" onClick={() => handleRegenerateToken(s.id)}>
                        <Autorenew fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {!isRevoked && (
                      <Tooltip title="Revoke Link Access">
                        <IconButton size="small" color="error" onClick={() => handleRevokeSender(s.id)}>
                          <Block fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Button size="small" startIcon={<Edit fontSize="small" />} onClick={() => openEditDialog(s)}>
                      Edit
                    </Button>
                    <IconButton size="small" color="error" onClick={() => setDeletingSender(s)}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Box>
                </CardActions>
              </Card>
            );
          })}
        </Box>
      )}

      {/* CREATE / EDIT SENDER DIALOG */}
      <Dialog open={dialogOpen} onClose={() => !submitting && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveSender}>
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {editingSender ? "Edit Sender" : "Create Sender"}
            </Typography>
            <IconButton onClick={() => setDialogOpen(false)} disabled={submitting}>
              <Close />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}

            <TextField
              label="Sender Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Uncle Rajesh (Groom's Side)"
              fullWidth
              required
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
              <TextField
                label="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91..."
                fullWidth
              />

              <TextField
                label="4-Digit Security PIN (optional)"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 1234"
                helperText="Protects the sender page"
                fullWidth
              />
            </Box>

            <TextField
              label="Link Expiration Date (optional)"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={{ mb: 2 }}
            />

            <TextField
              label="Message Override (optional)"
              value={messageOverride}
              onChange={(e) => setMessageOverride(e.target.value)}
              placeholder="Custom template message for this sender only. Leave blank to use default template."
              multiline
              rows={3}
              helperText="Available variables: {{guest_name}}, {{couple_names}}, {{wedding_date}}, {{pax}}, {{code}}, {{invite_url}}"
              fullWidth
            />
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting || !name} sx={{ minHeight: 44 }}>
              {submitting ? <CircularProgress size={20} color="inherit" /> : editingSender ? "Save Changes" : "Create Sender"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* AUTO SPLIT DIALOG */}
      <Dialog open={splitDialogOpen} onClose={() => !splitSubmitting && setSplitDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Auto-Split Guests Among Senders</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Evenly distribute guests across selected senders using round-robin assignment.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Select Participating Senders:
          </Typography>
          <FormGroup sx={{ pl: 1, mb: 2 }}>
            {senders.map((s) => (
              <FormControlLabel
                key={s.id}
                control={
                  <Checkbox
                    checked={selectedSplitSenderIds.includes(s.id)}
                    onChange={() =>
                      setSelectedSplitSenderIds((prev) =>
                        prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                      )
                    }
                  />
                }
                label={`${s.name} (currently ${s._count?.guests ?? 0} guests)`}
              />
            ))}
          </FormGroup>

          <Divider sx={{ my: 1.5 }} />

          <FormControlLabel
            control={
              <Checkbox
                checked={unassignedOnly}
                onChange={(e) => setUnassignedOnly(e.target.checked)}
              />
            }
            label="Split only unassigned guests (leave existing assignments untouched)"
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSplitDialogOpen(false)} disabled={splitSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAutoSplit}
            disabled={splitSubmitting || selectedSplitSenderIds.length === 0}
            sx={{ minHeight: 44 }}
          >
            {splitSubmitting ? <CircularProgress size={20} color="inherit" /> : "Run Auto-Split"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE SENDER CONFIRMATION */}
      <Dialog open={Boolean(deletingSender)} onClose={() => setDeletingSender(null)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Sender?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Are you sure you want to delete sender <strong>{deletingSender?.name}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Any guests currently assigned to this sender will become unassigned safely. Their invitations and guest records will not be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeletingSender(null)} disabled={deleteSubmitting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteSender}
            disabled={deleteSubmitting}
            sx={{ minHeight: 44 }}
          >
            {deleteSubmitting ? <CircularProgress size={20} color="inherit" /> : "Delete Sender"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Toast */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
