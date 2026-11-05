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
  TextField,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Divider,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Save,
  Refresh,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Download,
  Speed,
  HealthAndSafety,
  Payment,
  Settings as SettingsIcon,
  Checklist,
  Language as LanguageIcon,
  Add,
  Delete,
  Star,
  StarBorder,
  ContentCopy,
  OpenInNew,
} from "@mui/icons-material";
import { tokens } from "@/lib/theme";
import { GoLiveChecklist, UsageReport, HealthCheckResult } from "@/lib/dashboard-service";

interface DomainItem {
  id: string;
  domain: string;
  isPrimary: boolean;
  status: "pending" | "configuring" | "active" | "error";
  createdAt: string;
}

export default function SettingsPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  // Wedding form
  const [coupleName1, setCoupleName1] = useState("");
  const [coupleName2, setCoupleName2] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [accentColor, setAccentColor] = useState(tokens.primary.main);
  const [sendingMethod, setSendingMethod] = useState<"mock" | "whatsapp_cloud" | "manual">("mock");
  const [dailyCap, setDailyCap] = useState(250);

  // Domains
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [platformSubdomain, setPlatformSubdomain] = useState("");
  const [newDomainInput, setNewDomainInput] = useState("");
  const [domainActionLoading, setDomainActionLoading] = useState(false);

  // Checklist & Reports
  const [checklist, setChecklist] = useState<GoLiveChecklist | null>(null);
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [utilityRate, setUtilityRate] = useState("0.35");
  const [marketingRate, setMarketingRate] = useState("0.80");
  const [currency, setCurrency] = useState("INR");

  // Health
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const [settingsRes, usageRes, healthRes, domainsRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch(`/api/admin/settings/usage?utilityRate=${utilityRate}&marketingRate=${marketingRate}&currency=${currency}`),
        fetch("/api/admin/settings/health"),
        fetch("/api/admin/domains"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setCoupleName1(data.wedding.coupleName1 || "");
        setCoupleName2(data.wedding.coupleName2 || "");
        setWeddingDate(
          data.wedding.weddingDate ? new Date(data.wedding.weddingDate).toISOString().split("T")[0] : ""
        );
        setAccentColor(data.wedding.accentColor || tokens.primary.main);
        setSendingMethod(data.sendingMethod || "mock");
        setDailyCap(data.dailyCap || 250);
        setChecklist(data.checklist);
      }

      if (domainsRes.ok) {
        const dData = await domainsRes.json();
        setDomains(dData.domains || []);
        setPlatformSubdomain(dData.platformSubdomain || "");
      }

      if (usageRes.ok) {
        const uData = await usageRes.json();
        setUsageReport(uData.report);
      }

      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealth(hData.health);
      }
    } catch {
      setFeedback({ message: "Failed to load settings.", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [utilityRate, marketingRate, currency]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coupleName1,
          coupleName2,
          weddingDate,
          accentColor,
          sendingMethod,
          dailyCap,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      setFeedback({ message: "Settings saved successfully.", severity: "success" });
      fetchSettings();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainInput.trim()) return;
    setDomainActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomainInput }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add domain");

      setFeedback({ message: `Domain ${newDomainInput} registered. Please configure DNS.`, severity: "success" });
      setNewDomainInput("");
      fetchSettings();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setDomainActionLoading(false);
    }
  };

  const handleVerifyDomain = async (id: string) => {
    setDomainActionLoading(true);
    try {
      const res = await fetch(`/api/admin/domains/${id}/verify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      setFeedback({
        message: data.verified ? "Domain successfully verified and active!" : "Domain verification pending DNS propagation.",
        severity: data.verified ? "success" : "error",
      });
      fetchSettings();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setDomainActionLoading(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    setDomainActionLoading(true);
    try {
      const res = await fetch(`/api/admin/domains/${id}/primary`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set primary domain");

      setFeedback({ message: "Primary domain updated.", severity: "success" });
      fetchSettings();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setDomainActionLoading(false);
    }
  };

  const handleDeleteDomain = async (id: string, domainName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${domainName}?`)) return;
    setDomainActionLoading(true);
    try {
      const res = await fetch(`/api/admin/domains/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove domain");

      setFeedback({ message: `Domain ${domainName} removed.`, severity: "success" });
      fetchSettings();
    } catch (err: unknown) {
      setFeedback({ message: (err as Error).message, severity: "error" });
    } finally {
      setDomainActionLoading(false);
    }
  };

  const handleRefreshHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/admin/settings/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data.health);
      }
    } catch {
      // silent
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleExportCsv = () => {
    const url = `/api/admin/settings/usage?export=csv&utilityRate=${utilityRate}&marketingRate=${marketingRate}&currency=${currency}`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: tokens.primary.main }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
          Wedding Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage wedding configuration, custom domains, go-live readiness, and system health.
        </Typography>
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
        <Tab icon={<SettingsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="General & Delivery" />
        <Tab icon={<LanguageIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Custom Domains" />
        <Tab icon={<Checklist sx={{ fontSize: 18 }} />} iconPosition="start" label="Go-Live Checklist" />
        <Tab icon={<Payment sx={{ fontSize: 18 }} />} iconPosition="start" label="Usage & Costs" />
        <Tab icon={<HealthAndSafety sx={{ fontSize: 18 }} />} iconPosition="start" label="Health Check" />
      </Tabs>

      {/* TAB 0: GENERAL & DELIVERY SETTINGS */}
      {tabIndex === 0 && (
        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, maxWidth: 800 }}>
          <form onSubmit={handleSaveSettings}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Wedding Information
            </Typography>

            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Couple Name 1"
                  value={coupleName1}
                  onChange={(e) => setCoupleName1(e.target.value)}
                  fullWidth
                  required
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Couple Name 2"
                  value={coupleName2}
                  onChange={(e) => setCoupleName2(e.target.value)}
                  fullWidth
                  required
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Wedding Date"
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                  fullWidth
                  required
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Public Guest Accent Color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  fullWidth
                  size="small"
                  helperText="Accent override for guest portal (defaults to theme primary)"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Delivery Engine & Caps
            </Typography>

            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sending Method</InputLabel>
                  <Select
                    value={sendingMethod}
                    label="Sending Method"
                    onChange={(e) => setSendingMethod(e.target.value as "mock" | "whatsapp_cloud" | "manual")}
                  >
                    <MenuItem value="mock">Mock Engine (Local Testing)</MenuItem>
                    <MenuItem value="whatsapp_cloud">WhatsApp Cloud API (Automated)</MenuItem>
                    <MenuItem value="manual">Manual Mode (Direct wa.me Links)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Daily Send Cap (Rolling 24h)"
                  type="number"
                  value={dailyCap}
                  onChange={(e) => setDailyCap(parseInt(e.target.value, 10) || 0)}
                  fullWidth
                  size="small"
                  helperText="Maximum messages permitted per rolling 24 hours"
                />
              </Grid>
            </Grid>

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
                sx={{
                  minHeight: 44,
                  bgcolor: tokens.primary.main,
                  color: tokens.neutral.white,
                  "&:hover": { bgcolor: tokens.primary.dark },
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </Box>
          </form>
        </Paper>
      )}

      {/* TAB 1: CUSTOM DOMAINS */}
      {tabIndex === 1 && (
        <Box sx={{ maxWidth: 880 }}>
          {/* Platform Subdomain Card */}
          <Paper elevation={0} sx={{ p: 3, mb: 3, border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Default Platform Subdomain
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Every wedding automatically receives a free subdomain on the platform:
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 1.5,
                bgcolor: tokens.neutral.subtle,
                borderRadius: 1.5,
                border: `1px solid ${tokens.neutral.border}`,
              }}
            >
              <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                https://{platformSubdomain}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://${platformSubdomain}`);
                    setFeedback({ message: "Subdomain URL copied to clipboard", severity: "success" });
                  }}
                  startIcon={<ContentCopy fontSize="small" />}
                  sx={{ color: tokens.neutral.textSecondary }}
                >
                  Copy
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Add Custom Domain Form */}
          <Paper elevation={0} sx={{ p: 3, mb: 3, border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Add a Custom Domain
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Point your own domain (e.g. <code>arjunandmeera.com</code>) to your wedding site. Guests will see your branding directly at your root URL.
            </Typography>

            <form onSubmit={handleAddDomain}>
              <Box sx={{ display: "flex", gap: 1.5, flexDirection: { xs: "column", sm: "row" } }}>
                <TextField
                  placeholder="e.g. arjunandmeera.com"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={domainActionLoading}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={domainActionLoading || !newDomainInput.trim()}
                  startIcon={domainActionLoading ? <CircularProgress size={16} color="inherit" /> : <Add />}
                  sx={{
                    minHeight: 40,
                    minWidth: 140,
                    bgcolor: tokens.primary.main,
                    color: tokens.neutral.white,
                    "&:hover": { bgcolor: tokens.primary.dark },
                  }}
                >
                  Add Domain
                </Button>
              </Box>
            </form>
          </Paper>

          {/* Registered Domains List */}
          <Paper elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, overflow: "hidden" }}>
            <Box sx={{ p: 2, bgcolor: tokens.neutral.subtle, borderBottom: `1px solid ${tokens.neutral.border}` }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Configured Custom Domains ({domains.length})
              </Typography>
            </Box>

            {domains.length === 0 ? (
              <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  No custom domains configured yet. Add your domain above to get started.
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Domain</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {domains.map((dom) => (
                      <TableRow key={dom.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "monospace" }}>
                            {dom.domain}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            DNS: CNAME @ &rarr; cname.vercel-dns.com
                          </Typography>
                        </TableCell>

                        <TableCell>
                          {dom.isPrimary ? (
                            <Chip
                              icon={<Star sx={{ fontSize: 14 }} />}
                              label="PRIMARY"
                              size="small"
                              sx={{ bgcolor: tokens.neutral.subtleHover, fontWeight: 700, fontSize: "0.7rem" }}
                            />
                          ) : (
                            <Button
                              size="small"
                              onClick={() => handleSetPrimary(dom.id)}
                              disabled={domainActionLoading}
                              sx={{ color: tokens.neutral.textSecondary, textTransform: "none", fontSize: "0.8rem" }}
                            >
                              Make Primary
                            </Button>
                          )}
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={dom.status.toUpperCase()}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.7rem",
                              bgcolor:
                                dom.status === "active"
                                  ? tokens.status.successBg
                                  : dom.status === "error"
                                  ? tokens.status.errorBg
                                  : tokens.neutral.subtleHover,
                              color:
                                dom.status === "active"
                                  ? tokens.status.success
                                  : dom.status === "error"
                                  ? tokens.status.error
                                  : tokens.neutral.textPrimary,
                              border: `1px solid ${tokens.neutral.border}`,
                            }}
                          />
                        </TableCell>

                        <TableCell align="right">
                          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleVerifyDomain(dom.id)}
                              disabled={domainActionLoading}
                              sx={{ borderColor: tokens.neutral.border, color: tokens.neutral.textPrimary, minHeight: 32 }}
                            >
                              Verify DNS
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteDomain(dom.id, dom.domain)}
                              disabled={domainActionLoading}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}

      {/* TAB 2: GO-LIVE CHECKLIST */}
      {tabIndex === 2 && (
        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Go-Live Readiness Audit
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Verifies essential configurations before dispatching invitations to real guests.
              </Typography>
            </Box>
            {checklist && (
              <Chip
                label={checklist.overallReady ? "READY TO GO LIVE" : `${checklist.score} CHECKS PASSED`}
                sx={{
                  fontWeight: 700,
                  bgcolor: checklist.overallReady ? tokens.status.successBg : tokens.status.warningBg,
                  color: checklist.overallReady ? tokens.status.success : tokens.status.warning,
                  border: `1px solid ${checklist.overallReady ? tokens.status.successBorder : tokens.status.warningBorder}`,
                }}
              />
            )}
          </Box>

          {checklist && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {checklist.items.map((item) => (
                <Paper
                  key={item.id}
                  elevation={0}
                  sx={{
                    p: 2.5,
                    border: `1px solid ${tokens.neutral.border}`,
                    borderRadius: 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    bgcolor: tokens.neutral.subtle,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                    {item.status === "pass" ? (
                      <CheckCircle sx={{ color: tokens.status.success, mt: 0.25 }} />
                    ) : item.status === "warn" ? (
                      <Warning sx={{ color: tokens.status.warning, mt: 0.25 }} />
                    ) : (
                      <ErrorIcon sx={{ color: tokens.status.error, mt: 0.25 }} />
                    )}
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {item.description}
                      </Typography>
                    </Box>
                  </Box>

                  {item.actionUrl && (
                    <Button component={Link} href={item.actionUrl} size="small" variant="outlined" sx={{ color: tokens.neutral.textPrimary, borderColor: tokens.neutral.border }}>
                      {item.actionText || "Manage"}
                    </Button>
                  )}
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {/* TAB 3: USAGE REPORT & COST CALCULATOR */}
      {tabIndex === 3 && (
        <Box>
          {/* Controls Bar */}
          <Paper elevation={0} sx={{ p: 3, mb: 3, border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Configurable Message Rates
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Customize per-message pricing rates to estimate your WhatsApp Meta delivery expenses.
                </Typography>
              </Box>

              <Button
                variant="outlined"
                onClick={handleExportCsv}
                startIcon={<Download />}
                sx={{ minHeight: 40, borderColor: tokens.neutral.border, color: tokens.neutral.textPrimary }}
              >
                Export Usage CSV
              </Button>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Utility Rate (Invitations & Reminders)"
                  value={utilityRate}
                  onChange={(e) => setUtilityRate(e.target.value)}
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Marketing Rate (Promotional / Follow-up)"
                  value={marketingRate}
                  onChange={(e) => setMarketingRate(e.target.value)}
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Currency</InputLabel>
                  <Select value={currency} label="Currency" onChange={(e) => setCurrency(e.target.value)}>
                    <MenuItem value="INR">INR (₹)</MenuItem>
                    <MenuItem value="USD">USD ($)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {/* Usage Summary Table */}
          {usageReport && (
            <Paper elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2, overflow: "hidden" }}>
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: tokens.neutral.subtle }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Message Category</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Delivered Count</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Rate ({usageReport.currency})</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Estimated Subtotal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usageReport.breakdownByCategory.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell sx={{ fontWeight: 500 }}>{row.category}</TableCell>
                        <TableCell align="right">{row.count}</TableCell>
                        <TableCell align="right">
                          {usageReport.currency === "INR" ? "₹" : "$"}
                          {row.rate.toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {usageReport.currency === "INR" ? "₹" : "$"}
                          {row.cost.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: tokens.neutral.subtle }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 700 }}>
                        Total Estimated Messaging Expenditure
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "1.05rem", color: tokens.primary.main }}>
                        {usageReport.currency === "INR" ? "₹" : "$"}
                        {usageReport.totalEstimatedCost.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {/* TAB 4: SYSTEM & WEDDING HEALTH CHECK */}
      {tabIndex === 4 && (
        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                System & Job Queue Diagnostics
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Live monitoring of database responsiveness, worker queue throughput, and send limits.
              </Typography>
            </Box>

            <Button
              variant="outlined"
              onClick={handleRefreshHealth}
              disabled={checkingHealth}
              startIcon={checkingHealth ? <CircularProgress size={16} /> : <Refresh />}
              sx={{ borderColor: tokens.neutral.border, color: tokens.neutral.textPrimary }}
            >
              Run Diagnostic
            </Button>
          </Box>

          {health && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Overall Status Banner */}
              <Alert
                severity={health.status === "HEALTHY" ? "success" : health.status === "DEGRADED" ? "warning" : "error"}
                sx={{ borderRadius: 2 }}
              >
                Overall System Health: <strong>{health.status}</strong> (as of{" "}
                {new Date(health.timestamp).toLocaleTimeString()})
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Database Ping
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                        {health.database.latencyMs} ms
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        PostgreSQL 16 connection {health.database.status}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Queued Jobs
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                        {health.jobQueue.queuedCount}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {health.jobQueue.stalledCount} stalled • {health.jobQueue.failedRecentCount} failed in 24h
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Card elevation={0} sx={{ border: `1px solid ${tokens.neutral.border}`, borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Daily Send Cap Headroom
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                        {health.dailyCap.remaining} left
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {health.dailyCap.sentToday} of {health.dailyCap.weddingCap} used today
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {health.details.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Diagnostic Logs & Notices:
                  </Typography>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: tokens.neutral.subtle, borderRadius: 1.5, border: `1px solid ${tokens.neutral.border}` }}>
                    {health.details.map((msg, idx) => (
                      <Typography key={idx} variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                        • {msg}
                      </Typography>
                    ))}
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
