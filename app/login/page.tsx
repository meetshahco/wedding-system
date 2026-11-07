"use client";

import { useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff, Favorite } from "@mui/icons-material";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/admin/dashboard";

  const [email, setEmail] = useState("owner@weddings.test");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        window.location.href = from;
      } else {
        setError(data.error ?? "Invalid credentials");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "background.default",
        px: 2,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          {/* Header */}
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Favorite sx={{ color: "primary.main", fontSize: 40, mb: 1 }} />
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              Wedding Studio
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Sign in with your email and password
            </Typography>
          </Box>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              autoFocus
              disabled={loading}
              sx={{ mb: 2.5 }}
            />

            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              disabled={loading}
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((s) => !s)}
                      edge="end"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider", textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Default credentials: <strong>owner@weddings.test</strong> / <strong>Password123!</strong>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
