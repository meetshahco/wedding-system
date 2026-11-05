"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  InputAdornment,
  MenuItem,
  Chip,
  IconButton,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Search,
  PersonAdd,
  UploadFile,
  Download,
  Delete,
  Edit,
  ContentCopy,
  OpenInNew,
  Clear,
  People,
  Group,
} from "@mui/icons-material";
import GuestFormDialog, { GuestFormData } from "@/components/admin/GuestFormDialog";
import GuestImportDialog from "@/components/admin/GuestImportDialog";

interface GuestRow {
  id: string;
  name: string;
  phone: string;
  city: string;
  pax: number;
  token: string;
  code: string;
  inviteStatus: string;
  optedOut: boolean;
  viewedAt: string | null;
  accessLevel: { id: string; name: string } | null;
  rsvps: Array<{
    id: string;
    eventId: string;
    status: string;
    paxAttending: number;
  }>;
}

interface Totals {
  totalGuests: number;
  totalPax: number;
  filteredGuests: number;
  filteredPax: number;
}

export default function GuestsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // < 600px

  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [totals, setTotals] = useState<Totals>({
    totalGuests: 0,
    totalPax: 0,
    filteredGuests: 0,
    filteredPax: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [accessFilter, setAccessFilter] = useState("");
  const [inviteStatusFilter, setInviteStatusFilter] = useState("");
  const [rsvpStatusFilter, setRsvpStatusFilter] = useState("");

  // Access levels for filtering
  const [accessLevels, setAccessLevels] = useState<{ id: string; name: string }[]>([]);

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestFormData | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [guestToDelete, setGuestToDelete] = useState<GuestRow | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Snackbar
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" | "info" } | null>(null);

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (cityFilter) params.set("city", cityFilter);
      if (accessFilter) params.set("accessLevelId", accessFilter);
      if (inviteStatusFilter) params.set("inviteStatus", inviteStatusFilter);
      if (rsvpStatusFilter) params.set("rsvpStatus", rsvpStatusFilter);

      const res = await fetch(`/api/admin/guests?${params.toString()}`);
      const data = await res.json();

      setGuests(data.guests || []);
      setCities(data.cities || []);
      setTotals(data.totals || { totalGuests: 0, totalPax: 0, filteredGuests: 0, filteredPax: 0 });
    } catch {
      setToast({ message: "Failed to load guests", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [search, cityFilter, accessFilter, inviteStatusFilter, rsvpStatusFilter]);

  // Fetch access levels for dropdown
  const fetchAccessLevels = async () => {
    try {
      const res = await fetch("/api/admin/access-levels");
      if (res.ok) {
        const data = await res.json();
        setAccessLevels(data.accessLevels || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  useEffect(() => {
    fetchAccessLevels();
  }, []);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(guests.map((g) => g.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setToast({ message: `Copied ${label} to clipboard`, severity: "success" });
  };

  const handleDeleteSingle = async () => {
    if (!guestToDelete) return;
    try {
      const res = await fetch(`/api/admin/guests/${guestToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setToast({ message: "Guest removed successfully", severity: "success" });
        setSelectedIds((prev) => prev.filter((id) => id !== guestToDelete.id));
        fetchGuests();
      } else {
        throw new Error();
      }
    } catch {
      setToast({ message: "Failed to delete guest", severity: "error" });
    } finally {
      setDeleteConfirmOpen(false);
      setGuestToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch("/api/admin/guests/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({
          message: `Successfully deleted ${data.deletedCount} guests`,
          severity: "success",
        });
        setSelectedIds([]);
        fetchGuests();
      } else {
        throw new Error();
      }
    } catch {
      setToast({ message: "Failed to delete selected guests", severity: "error" });
    } finally {
      setBulkDeleteConfirmOpen(false);
    }
  };

  const getInviteChipColor = (status: string) => {
    switch (status) {
      case "read":
        return "success";
      case "delivered":
        return "info";
      case "sent":
        return "primary";
      case "queued":
        return "warning";
      case "failed":
        return "error";
      default:
        return "default";
    }
  };

  const getRsvpBadge = (g: GuestRow) => {
    if (!g.rsvps || g.rsvps.length === 0) {
      return <Chip label="Pending" size="small" variant="outlined" />;
    }
    const hasAttending = g.rsvps.some((r) => r.status === "attending");
    if (hasAttending) {
      const totalAttending = g.rsvps.reduce((acc, curr) => acc + (curr.paxAttending || 0), 0);
      return (
        <Chip
          label={`Attending (${totalAttending})`}
          size="small"
          color="success"
          variant="filled"
        />
      );
    }
    return <Chip label="Declined" size="small" color="error" variant="outlined" />;
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header & Metrics */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "center" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Guest List
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your wedding guests, invitations, links, and RSVPs
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            href="/api/admin/guests/export"
            sx={{ minHeight: 44 }}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFile />}
            onClick={() => setImportOpen(true)}
            sx={{ minHeight: 44 }}
          >
            Import
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => {
              setEditingGuest(null);
              setFormOpen(true);
            }}
            sx={{ minHeight: 44 }}
          >
            Add Guest
          </Button>
        </Box>
      </Box>

      {/* Summary Stat Cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
          mb: 3,
        }}
      >
        <Paper
          variant="outlined"
          sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <People sx={{ color: "primary.main", fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {totals.totalGuests}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Guests
            </Typography>
          </Box>
        </Paper>

        <Paper
          variant="outlined"
          sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <Group sx={{ color: "primary.main", fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {totals.totalPax}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Expected Pax
            </Typography>
          </Box>
        </Paper>

        <Paper
          variant="outlined"
          sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.main" }}>
              {totals.filteredGuests}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Filtered Guests
            </Typography>
          </Box>
        </Paper>

        <Paper
          variant="outlined"
          sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.main" }}>
              {totals.filteredPax}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Filtered Pax
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Search and Filters Bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "2fr 1fr 1fr",
              md: "2fr 1fr 1fr 1fr 1fr",
            },
            gap: 1.5,
          }}
        >
          <TextField
            placeholder="Search name, phone, code, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: search && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch("")}>
                    <Clear fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            select
            label="City"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            size="small"
          >
            <MenuItem value="">All Cities</MenuItem>
            {cities.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Access Level"
            value={accessFilter}
            onChange={(e) => setAccessFilter(e.target.value)}
            size="small"
          >
            <MenuItem value="">All Levels</MenuItem>
            <MenuItem value="unassigned">Unassigned</MenuItem>
            {accessLevels.map((al) => (
              <MenuItem key={al.id} value={al.id}>
                {al.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Invite Status"
            value={inviteStatusFilter}
            onChange={(e) => setInviteStatusFilter(e.target.value)}
            size="small"
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="not_invited">Not Invited</MenuItem>
            <MenuItem value="queued">Queued</MenuItem>
            <MenuItem value="sent">Sent</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="read">Read</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
          </TextField>

          <TextField
            select
            label="RSVP Status"
            value={rsvpStatusFilter}
            onChange={(e) => setRsvpStatusFilter(e.target.value)}
            size="small"
          >
            <MenuItem value="">All RSVPs</MenuItem>
            <MenuItem value="attending">Attending</MenuItem>
            <MenuItem value="declined">Declined</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
          </TextField>
        </Box>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <Box
            sx={{
              mt: 2,
              pt: 2,
              borderTop: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {selectedIds.length} guest(s) selected
            </Typography>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<Delete />}
              onClick={() => setBulkDeleteConfirmOpen(true)}
              sx={{ minHeight: 36 }}
            >
              Delete Selected
            </Button>
          </Box>
        )}
      </Paper>

      {/* Main Content: Table on desktop, Cards on mobile (< 600px) */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : guests.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            py: 8,
            px: 2,
            textAlign: "center",
            bgcolor: "background.paper",
            borderRadius: 3,
          }}
        >
          <People sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            No guests found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Try adjusting your search filters or add a new guest
          </Typography>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => {
              setEditingGuest(null);
              setFormOpen(true);
            }}
          >
            Add First Guest
          </Button>
        </Paper>
      ) : isMobile ? (
        /* Mobile Card View (<600px) */
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {guests.map((g) => {
            const inviteUrl = `${origin}/i/${g.token}`;
            return (
              <Card key={g.id} variant="outlined">
                <CardContent sx={{ pb: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      mb: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Checkbox
                        size="small"
                        checked={selectedIds.includes(g.id)}
                        onChange={() => handleSelectOne(g.id)}
                        sx={{ p: 0.5 }}
                      />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                          {g.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {g.phone} {g.city ? `• ${g.city}` : ""}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip label={`Pax: ${g.pax}`} size="small" variant="outlined" />
                  </Box>

                  <Box sx={{ display: "flex", gap: 1, my: 1, flexWrap: "wrap" }}>
                    <Chip
                      label={g.inviteStatus.replace("_", " ")}
                      size="small"
                      color={getInviteChipColor(g.inviteStatus)}
                    />
                    {getRsvpBadge(g)}
                    {g.accessLevel && (
                      <Chip
                        label={g.accessLevel.name}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {/* Code and Link */}
                  <Box
                    sx={{
                      bgcolor: "background.paper",
                      p: 1.5,
                      borderRadius: 1.5,
                      mt: 1.5,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Code:{" "}
                        <Box
                          component="strong"
                          sx={{ letterSpacing: 1.5, color: "text.primary" }}
                        >
                          {g.code}
                        </Box>
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<ContentCopy fontSize="small" />}
                        onClick={() => copyToClipboard(g.code, "Code")}
                        sx={{ minHeight: 32, p: "2px 8px" }}
                      >
                        Copy Code
                      </Button>
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        /i/{g.token}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<ContentCopy fontSize="small" />}
                          onClick={() => copyToClipboard(inviteUrl, "Link")}
                          sx={{ minHeight: 32, p: "2px 8px" }}
                        >
                          Copy Link
                        </Button>
                        <IconButton
                          size="small"
                          component="a"
                          href={`/i/${g.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ p: 0.5 }}
                        >
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>

                <CardActions sx={{ justifyContent: "flex-end", px: 2, pt: 0, pb: 1 }}>
                  <Button
                    size="small"
                    startIcon={<Edit fontSize="small" />}
                    onClick={() => {
                      setEditingGuest(g);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Delete fontSize="small" />}
                    onClick={() => {
                      setGuestToDelete(g);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    Delete
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </Box>
      ) : (
        /* Desktop Table View (>= 600px) */
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedIds.length > 0 && selectedIds.length < guests.length
                    }
                    checked={
                      guests.length > 0 && selectedIds.length === guests.length
                    }
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Guest</TableCell>
                <TableCell>Phone / City</TableCell>
                <TableCell align="center">Pax</TableCell>
                <TableCell>Access Level</TableCell>
                <TableCell>Invite Status</TableCell>
                <TableCell>RSVP</TableCell>
                <TableCell>4-Digit Code</TableCell>
                <TableCell>Invite Link</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {guests.map((g) => {
                const isSelected = selectedIds.includes(g.id);
                const inviteUrl = `${origin}/i/${g.token}`;

                return (
                  <TableRow key={g.id} hover selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleSelectOne(g.id)}
                      />
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {g.name}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">{g.phone}</Typography>
                      {g.city && (
                        <Typography variant="caption" color="text.secondary">
                          {g.city}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell align="center">
                      <Chip label={g.pax} size="small" variant="outlined" />
                    </TableCell>

                    <TableCell>
                      {g.accessLevel ? (
                        <Chip
                          label={g.accessLevel.name}
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Unassigned
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={g.inviteStatus.replace("_", " ")}
                        size="small"
                        color={getInviteChipColor(g.inviteStatus)}
                      />
                    </TableCell>

                    <TableCell>{getRsvpBadge(g)}</TableCell>

                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <code style={{ fontWeight: 700, letterSpacing: 1 }}>
                          {g.code}
                        </code>
                        <Tooltip title="Copy 4-digit code">
                          <IconButton
                            size="small"
                            onClick={() => copyToClipboard(g.code, "Code")}
                            sx={{ minWidth: 32, minHeight: 32 }}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            maxWidth: 100,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          /i/{g.token}
                        </Typography>
                        <Tooltip title="Copy personalized link">
                          <IconButton
                            size="small"
                            onClick={() => copyToClipboard(inviteUrl, "Link")}
                            sx={{ minWidth: 32, minHeight: 32 }}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Open invite in new tab">
                          <IconButton
                            size="small"
                            component="a"
                            href={`/i/${g.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ minWidth: 32, minHeight: 32 }}
                          >
                            <OpenInNew fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>

                    <TableCell align="right">
                      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <Tooltip title="Edit Guest">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingGuest(g);
                              setFormOpen(true);
                            }}
                            sx={{ minWidth: 36, minHeight: 36 }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Guest">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setGuestToDelete(g);
                              setDeleteConfirmOpen(true);
                            }}
                            sx={{ minWidth: 36, minHeight: 36 }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Guest Add / Edit Dialog */}
      <GuestFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialData={editingGuest}
        onSuccess={() => {
          setToast({
            message: editingGuest
              ? "Guest updated successfully"
              : "Guest added successfully",
            severity: "success",
          });
          fetchGuests();
        }}
      />

      {/* Guest Import Dialog */}
      <GuestImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={(count) => {
          setToast({
            message: `Successfully imported ${count} guests!`,
            severity: "success",
          });
          fetchGuests();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove{" "}
            <strong>{guestToDelete?.name}</strong>? Their RSVP responses and
            invitation logs will also be deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteSingle}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Bulk Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedIds.length} selected
            guests? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBulkDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleBulkDelete}
            color="error"
            variant="contained"
          >
            Delete {selectedIds.length} Guests
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
          <Alert
            onClose={() => setToast(null)}
            severity={toast.severity}
            sx={{ width: "100%" }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
