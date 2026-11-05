"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Close } from "@mui/icons-material";

export interface GuestFormData {
  id?: string;
  name: string;
  phone: string;
  city: string;
  pax: number;
}

interface GuestFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: GuestFormData | null;
}

export default function GuestFormDialog({
  open,
  onClose,
  onSuccess,
  initialData,
}: GuestFormDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const isEdit = Boolean(initialData?.id);

  const [formData, setFormData] = useState<GuestFormData>({
    name: "",
    phone: "",
    city: "",
    pax: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        phone: initialData.phone,
        city: initialData.city || "",
        pax: initialData.pax || 1,
      });
    } else {
      setFormData({
        name: "",
        phone: "",
        city: "",
        pax: 1,
      });
    }
    setError(null);
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = isEdit
        ? `/api/admin/guests/${initialData?.id}`
        : "/api/admin/guests";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save guest");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pb: 1,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {isEdit ? "Edit Guest" : "Add New Guest"}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="close">
          <Close />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            label="Full Name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            fullWidth
            required
            autoFocus
            sx={{ mb: 2.5 }}
          />

          <TextField
            label="Phone Number"
            value={formData.phone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value }))
            }
            placeholder="e.g. 9876543210 or +919876543210"
            helperText="Default country is India (+91) if country code is omitted"
            fullWidth
            required
            sx={{ mb: 2.5 }}
          />

          <TextField
            label="City"
            value={formData.city}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, city: e.target.value }))
            }
            placeholder="e.g. Mumbai, Delhi"
            fullWidth
            sx={{ mb: 2.5 }}
          />

          <TextField
            label="Pax (Number of Attendees)"
            type="number"
            value={formData.pax}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                pax: Math.max(1, parseInt(e.target.value || "1", 10)),
              }))
            }
            inputProps={{ min: 1, max: 100 }}
            fullWidth
            required
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !formData.name.trim() || !formData.phone.trim()}
          >
            {loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Add Guest"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

