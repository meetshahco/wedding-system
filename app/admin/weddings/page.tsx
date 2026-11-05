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
  FormControlLabel,
  Checkbox,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Add,
  Event,
  People,
  CheckCircle,
  Close,
  Edit,
  SwapHoriz,
} from "@mui/icons-material";
import { tokens } from "@/lib/theme";

interface WeddingItem {
  id: string;
  slug: string;
  coupleName1: string;
  coupleName2: string;
  weddingDate: string;
  accentColor: string;
  archived: boolean;
  _count?: {
    guests: number;
    events: number;
  };
}

export default function WeddingsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [weddings, setWeddings] = useState<WeddingItem[]>([]);
  const [activeWeddingId, setActiveWeddingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editingWedding, setEditingWedding] = useState<WeddingItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [slug, setSlug] = useState("");
  const [coupleName1, setCoupleName1] = useState("");
  const [coupleName2, setCoupleName2] = useState("");
  const [weddingDate, setWeddingDate] = useState("2027-04-15");
  const [accentColor, setAccentColor] = useState(tokens.primary.main);
  const [startFromTemplate, setStartFromTemplate] = useState(true);

  // Feedback toast
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  const fetchWeddings = async () => {
    setLoading(true);
    try {
      const [resWeddings, resMe] = await Promise.all([
        fetch("/api/admin/weddings"),
        fetch("/api/admin/auth/me"),
      ]);

      const dataWeddings = await resWeddings.json();
      const dataMe = await resMe.json();

      setWeddings(dataWeddings.weddings || []);
      setActiveWeddingId(dataMe.activeWedding?.id || null);
    } catch {
      setToast({ message: "Failed to load weddings", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeddings();
  }, []);

  const openCreateDialog = () => {
    setEditingWedding(null);
    setSlug("");
    setCoupleName1("");
    setCoupleName2("");
    setWeddingDate("2027-04-15");
    setAccentColor(tokens.primary.main);
    setStartFromTemplate(true);
    setFormError(null);
    setCreateOpen(true);
  };

  const openEditDialog = (w: WeddingItem) => {
    setEditingWedding(w);
    setSlug(w.slug);
    setCoupleName1(w.coupleName1);
    setCoupleName2(w.coupleName2);
    setWeddingDate(new Date(w.weddingDate).toISOString().split("T")[0]);
    setAccentColor(w.accentColor || tokens.primary.main);
    setFormError(null);
    setCreateOpen(true);
  };

  const handleSaveWedding = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (editingWedding) {
        const res = await fetch(`/api/admin/weddings/${editingWedding.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coupleName1,
            coupleName2,
            weddingDate: new Date(weddingDate).toISOString(),
            accentColor,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update wedding");

        setToast({ message: "Wedding updated successfully", severity: "success" });
      } else {
        const res = await fetch("/api/admin/weddings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slug.toLowerCase().trim(),
            coupleName1,
            coupleName2,
            weddingDate: new Date(weddingDate).toISOString(),
            accentColor,
            startFromTemplate,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create wedding");

        setToast({ message: "Wedding created successfully!", severity: "success" });
      }

      setCreateOpen(false);
      fetchWeddings();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchWedding = async (id: string) => {
    try {
      const res = await fetch("/api/admin/auth/switch-wedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weddingId: id }),
      });
      if (res.ok) {
        setActiveWeddingId(id);
        setToast({ message: "Switched active wedding", severity: "success" });
        setTimeout(() => {
          window.location.reload();
        }, 600);
      }
    } catch {
      setToast({ message: "Failed to switch wedding", severity: "error" });
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            All Weddings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your client weddings, switch active workspaces, or launch from template
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openCreateDialog}
          sx={{ minHeight: 44 }}
        >
          Create Wedding
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : weddings.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            No weddings created yet
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={openCreateDialog}>
            Create First Wedding
          </Button>
        </Paper>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          {weddings.map((w) => {
            const isActive = w.id === activeWeddingId;
            const formattedDate = new Date(w.weddingDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <Card
                key={w.id}
                variant="outlined"
                sx={{
                  border: isActive ? `2px solid ${tokens.primary.main}` : `1px solid ${tokens.neutral.border}`,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <CardContent sx={{ flex: 1, pb: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {w.coupleName1} & {w.coupleName2}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        /w/{w.slug}
                      </Typography>
                    </Box>
                    {isActive ? (
                      <Chip
                        icon={<CheckCircle fontSize="small" />}
                        label="Active"
                        size="small"
                        color="primary"
                      />
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<SwapHoriz fontSize="small" />}
                        onClick={() => handleSwitchWedding(w.id)}
                        sx={{ minHeight: 32, p: "2px 8px" }}
                      >
                        Switch
                      </Button>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", gap: 1.5, my: 2, flexWrap: "wrap" }}>
                    <Chip
                      icon={<Event fontSize="small" />}
                      label={formattedDate}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      icon={<People fontSize="small" />}
                      label={`${w._count?.guests ?? 0} Guests`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        bgcolor: w.accentColor || tokens.primary.main,
                        border: `1px solid ${tokens.neutral.border}`,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Accent: {w.accentColor || tokens.primary.main}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions sx={{ justifyContent: "flex-end", px: 2, pt: 0, pb: 1.5 }}>
                  <Button
                    size="small"
                    startIcon={<Edit fontSize="small" />}
                    onClick={() => openEditDialog(w)}
                  >
                    Edit
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullScreen={isMobile}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {editingWedding ? "Edit Wedding" : "Create New Wedding"}
          </Typography>
          <IconButton onClick={() => setCreateOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        <form onSubmit={handleSaveWedding}>
          <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}

            {!editingWedding && (
              <TextField
                label="URL Slug"
                placeholder="e.g. rohan-priya"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                helperText="Identifier for the wedding URL (e.g. /w/rohan-priya)"
                fullWidth
                required
                autoFocus
                sx={{ mb: 2 }}
              />
            )}

            <TextField
              label="Partner 1 Name"
              value={coupleName1}
              onChange={(e) => setCoupleName1(e.target.value)}
              placeholder="e.g. Rohan"
              fullWidth
              required
              sx={{ mb: 2 }}
            />

            <TextField
              label="Partner 2 Name"
              value={coupleName2}
              onChange={(e) => setCoupleName2(e.target.value)}
              placeholder="e.g. Priya"
              fullWidth
              required
              sx={{ mb: 2 }}
            />

            <TextField
              label="Wedding Date"
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />

            <TextField
              label="Branding Accent Color (Hex)"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              placeholder={tokens.primary.main}
              helperText={`Overrides public site accent color (default ${tokens.primary.main})`}
              fullWidth
              sx={{ mb: 2 }}
            />

            {!editingWedding && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={startFromTemplate}
                    onChange={(e) => setStartFromTemplate(e.target.checked)}
                  />
                }
                label="Start from template (seeds default events & templates)"
              />
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting || !coupleName1 || !coupleName2}>
              {submitting ? <CircularProgress size={20} color="inherit" /> : editingWedding ? "Save Changes" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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
