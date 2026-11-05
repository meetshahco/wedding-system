"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Paper,
} from "@mui/material";
import { ArrowForward, Key } from "@mui/icons-material";
import { tokens } from "@/lib/theme";

interface CodeEntryFormProps {
  slug: string;
  coupleNames: string;
  formattedDate: string;
  accentColor?: string;
}

export default function CodeEntryForm({
  slug,
  coupleNames,
  formattedDate,
  accentColor,
}: CodeEntryFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAccent = accentColor || tokens.primary.main;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 4) {
      setError("Please enter your 4-digit invitation code.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/w/${slug}/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid code. Please try again.");
        return;
      }

      if (data.token) {
        router.push(`/i/${data.token}`);
      }
    } catch {
      setError("A connection error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeChange = (val: string) => {
    // Only accept up to 4 digits
    const digitsOnly = val.replace(/\D/g, "").slice(0, 4);
    setCode(digitsOnly);
    if (error) setError(null);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        width: "100%",
        maxWidth: 420,
        p: { xs: 3, sm: 4 },
        borderRadius: 2,
        borderColor: tokens.neutral.border,
        bgcolor: tokens.neutral.white,
        textAlign: "center",
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
        <Key sx={{ color: activeAccent }} />
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: tokens.neutral.textPrimary }}>
        {coupleNames}
      </Typography>

      <Typography variant="body2" sx={{ color: tokens.neutral.textSecondary, mb: 3 }}>
        {formattedDate}
      </Typography>

      <Typography variant="body2" sx={{ color: tokens.neutral.textSecondary, mb: 2 }}>
        Enter the 4-digit code from your invitation card or message to view celebration details.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, textAlign: "left" }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <TextField
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder="0000"
          type="text"
          autoFocus
          fullWidth
          inputProps={{
            inputMode: "numeric",
            pattern: "[0-9]*",
            maxLength: 4,
            style: {
              textAlign: "center",
              fontSize: "1.75rem",
              letterSpacing: "0.5rem",
              fontWeight: 700,
              padding: "12px 14px",
            },
          }}
          sx={{ mb: 3 }}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={submitting || code.length !== 4}
          endIcon={!submitting && <ArrowForward />}
          sx={{
            minHeight: 48,
            bgcolor: activeAccent,
            "&:hover": {
              bgcolor: tokens.primary.dark,
            },
          }}
        >
          {submitting ? <CircularProgress size={22} color="inherit" /> : "View Invitation"}
        </Button>
      </form>
    </Paper>
  );
}
