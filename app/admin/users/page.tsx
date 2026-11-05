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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  MenuItem,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  PersonAdd,
  ContentCopy,
  CheckCircle,
  Close,
  Block,
} from "@mui/icons-material";

interface UserItem {
  id: string;
  name: string;
  email: string;
  globalRole: "OWNER" | "MANAGER" | "USER";
  isActive: boolean;
  createdAt: string;
  weddingAccess: Array<{
    wedding: {
      id: string;
      coupleName1: string;
      coupleName2: string;
    };
  }>;
}

interface PendingInvite {
  id: string;
  email: string;
  token: string;
  targetRole: string;
  expiresAt: string;
}

export default function UsersPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [users, setUsers] = useState<UserItem[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [weddings, setWeddings] = useState<Array<{ id: string; coupleName1: string; coupleName2: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [targetRole, setTargetRole] = useState<"OWNER" | "MANAGER" | "USER">("USER");
  const [selectedWeddingId, setSelectedWeddingId] = useState("");
  const [weddingRole, setWeddingRole] = useState<"MANAGER" | "VIEWER">("VIEWER");
  const [submitting, setSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ inviteUrl: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Feedback toast
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [resUsers, resWeddings] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/weddings"),
      ]);

      const dataUsers = await resUsers.json();
      const dataWeddings = await resWeddings.json();

      setUsers(dataUsers.users || []);
      setPendingInvites(dataUsers.pendingInvites || []);
      setWeddings(dataWeddings.weddings || []);
    } catch {
      setToast({ message: "Failed to load users", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          targetRole,
          weddingId: selectedWeddingId || null,
          weddingRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite user");

      setInviteResult({
        inviteUrl: data.invite.inviteUrl,
        email: data.invite.email,
      });
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      setToast({
        message: `User ${user.isActive ? "deactivated" : "activated"} successfully`,
        severity: "success",
      });
      fetchUsers();
    } catch {
      setToast({ message: "Failed to update user status", severity: "error" });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setToast({ message: `Copied ${label} to clipboard`, severity: "success" });
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
            Users & Roles
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage studio team members, clients, and role-based wedding access
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<PersonAdd />}
          onClick={() => {
            setEmail("");
            setTargetRole("USER");
            setSelectedWeddingId("");
            setWeddingRole("VIEWER");
            setInviteResult(null);
            setError(null);
            setInviteOpen(true);
          }}
          sx={{ minHeight: 44 }}
        >
          Invite User
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 4 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name / Email</TableCell>
                  <TableCell>Global Role</TableCell>
                  <TableCell>Assigned Weddings</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {u.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {u.email}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={u.globalRole}
                        size="small"
                        color={u.globalRole === "OWNER" ? "primary" : "default"}
                      />
                    </TableCell>

                    <TableCell>
                      {u.globalRole === "OWNER" ? (
                        <Typography variant="caption" sx={{ fontStyle: "italic", color: "text.secondary" }}>
                          Full Studio Access (All Weddings)
                        </Typography>
                      ) : u.weddingAccess.length === 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          No specific wedding assigned
                        </Typography>
                      ) : (
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          {u.weddingAccess.map((wa) => (
                            <Chip
                              key={wa.wedding.id}
                              label={`${wa.wedding.coupleName1} & ${wa.wedding.coupleName2}`}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      )}
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={u.isActive ? "Active" : "Deactivated"}
                        size="small"
                        color={u.isActive ? "success" : "default"}
                        variant="outlined"
                      />
                    </TableCell>

                    <TableCell align="right">
                      {u.globalRole !== "OWNER" && (
                        <Button
                          size="small"
                          color={u.isActive ? "error" : "primary"}
                          variant="outlined"
                          startIcon={u.isActive ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}
                          onClick={() => handleToggleActive(u)}
                          sx={{ minHeight: 32 }}
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Pending Invitations ({pendingInvites.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Invited Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Expires</TableCell>
                      <TableCell align="right">Invite Link</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingInvites.map((pi) => {
                      const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${pi.token}`;
                      return (
                        <TableRow key={pi.id}>
                          <TableCell>{pi.email}</TableCell>
                          <TableCell>
                            <Chip label={pi.targetRole} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            {new Date(pi.expiresAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Copy single-use invite link">
                              <Button
                                size="small"
                                startIcon={<ContentCopy fontSize="small" />}
                                onClick={() => copyToClipboard(inviteUrl, "Invite Link")}
                              >
                                Copy Link
                              </Button>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </>
      )}

      {/* Invite Dialog */}
      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        fullScreen={isMobile}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Invite User
          </Typography>
          <IconButton onClick={() => setInviteOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        {inviteResult ? (
          <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
            <Alert severity="success" sx={{ mb: 2 }}>
              Single-use invite link created for <strong>{inviteResult.email}</strong>!
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Send this single-use link to the user. It expires in 7 days and can only be used once to set up their name and password:
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                bgcolor: "action.selected",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {inviteResult.inviteUrl}
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<ContentCopy fontSize="small" />}
                onClick={() => copyToClipboard(inviteResult.inviteUrl, "Invite link")}
              >
                Copy
              </Button>
            </Paper>
          </DialogContent>
        ) : (
          <form onSubmit={handleSendInvite}>
            <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
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
                placeholder="name@example.com"
                fullWidth
                required
                autoFocus
                sx={{ mb: 2.5 }}
              />

              <TextField
                select
                label="Global Role"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as "OWNER" | "MANAGER" | "USER")}
                fullWidth
                sx={{ mb: 2.5 }}
              >
                <MenuItem value="USER">Client / Couple User (Restricted to assigned wedding)</MenuItem>
                <MenuItem value="MANAGER">Studio Manager (Can manage weddings)</MenuItem>
                <MenuItem value="OWNER">Studio Owner (Full system access)</MenuItem>
              </TextField>

              {targetRole === "USER" && (
                <>
                  <TextField
                    select
                    label="Assign to Wedding (Optional)"
                    value={selectedWeddingId}
                    onChange={(e) => setSelectedWeddingId(e.target.value)}
                    fullWidth
                    sx={{ mb: 2.5 }}
                  >
                    <MenuItem value="">
                      <em>None (Assign later)</em>
                    </MenuItem>
                    {weddings.map((w) => (
                      <MenuItem key={w.id} value={w.id}>
                        {w.coupleName1} & {w.coupleName2}
                      </MenuItem>
                    ))}
                  </TextField>

                  {selectedWeddingId && (
                    <TextField
                      select
                      label="Wedding Access Level"
                      value={weddingRole}
                      onChange={(e) => setWeddingRole(e.target.value as "MANAGER" | "VIEWER")}
                      fullWidth
                    >
                      <MenuItem value="VIEWER">Viewer (Read-only)</MenuItem>
                      <MenuItem value="MANAGER">Manager (Can edit wedding data)</MenuItem>
                    </TextField>
                  )}
                </>
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setInviteOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={submitting || !email.trim()}>
                {submitting ? <CircularProgress size={20} color="inherit" /> : "Generate Invite Link"}
              </Button>
            </DialogActions>
          </form>
        )}
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

