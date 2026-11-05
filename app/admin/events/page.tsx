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
  Tabs,
  Tab,
  IconButton,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
} from "@mui/material";
import {
  Add,
  Edit,
  DeleteOutline,
  Event as EventIcon,
  AccessTime,
  LocationOn,
  Checklist,
  People,
  AutoAwesome,
  Close,
} from "@mui/icons-material";
import { tokens } from "@/lib/theme";

interface AccessLevelLink {
  accessLevel: {
    id: string;
    name: string;
  };
}

interface EventItem {
  id: string;
  name: string;
  date: string;
  startTime: string;
  venue: string;
  address: string;
  mapUrl?: string;
  dressCode?: string;
  description?: string;
  sortOrder: number;
  accessLevels?: AccessLevelLink[];
}

interface LinkedEventItem {
  event: {
    id: string;
    name: string;
    date: string;
    startTime: string;
  };
}

interface AccessLevelItem {
  id: string;
  name: string;
  events: LinkedEventItem[];
  _count?: {
    guests: number;
  };
}

export default function EventsAndAccessLevelsPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [accessLevels, setAccessLevels] = useState<AccessLevelItem[]>([]);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(
    null
  );

  // Event modal state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventFormError, setEventFormError] = useState<string | null>(null);

  // Event fields
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("2027-04-15");
  const [eventTime, setEventTime] = useState("10:00 AM");
  const [eventVenue, setEventVenue] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [eventMapUrl, setEventMapUrl] = useState("");
  const [eventDressCode, setEventDressCode] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventSortOrder, setEventSortOrder] = useState(1);

  // Access Level modal state
  const [alDialogOpen, setAlDialogOpen] = useState(false);
  const [editingAl, setEditingAl] = useState<AccessLevelItem | null>(null);
  const [alSubmitting, setAlSubmitting] = useState(false);
  const [alFormError, setAlFormError] = useState<string | null>(null);

  // Access Level fields
  const [alName, setAlName] = useState("");
  const [alSelectedEventIds, setAlSelectedEventIds] = useState<string[]>([]);

  // Delete Confirmation state
  const [deleteEventItem, setDeleteEventItem] = useState<EventItem | null>(null);
  const [deleteAlItem, setDeleteAlItem] = useState<AccessLevelItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Loading template state
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resEvents, resAls] = await Promise.all([
        fetch("/api/admin/events"),
        fetch("/api/admin/access-levels"),
      ]);

      const dataEvents = await resEvents.json();
      const dataAls = await resAls.json();

      setEvents(dataEvents.events || []);
      setAccessLevels(dataAls.accessLevels || []);
    } catch {
      setToast({ message: "Failed to load events and access levels", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Event Handlers
  const openCreateEventDialog = () => {
    setEditingEvent(null);
    setEventName("");
    setEventDate("2027-04-15");
    setEventTime("10:00 AM");
    setEventVenue("");
    setEventAddress("");
    setEventMapUrl("");
    setEventDressCode("");
    setEventDescription("");
    setEventSortOrder(events.length + 1);
    setEventFormError(null);
    setEventDialogOpen(true);
  };

  const openEditEventDialog = (e: EventItem) => {
    setEditingEvent(e);
    setEventName(e.name);
    setEventDate(new Date(e.date).toISOString().split("T")[0]);
    setEventTime(e.startTime);
    setEventVenue(e.venue);
    setEventAddress(e.address);
    setEventMapUrl(e.mapUrl || "");
    setEventDressCode(e.dressCode || "");
    setEventDescription(e.description || "");
    setEventSortOrder(e.sortOrder);
    setEventFormError(null);
    setEventDialogOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEventSubmitting(true);
    setEventFormError(null);

    const payload = {
      name: eventName.trim(),
      date: new Date(eventDate).toISOString(),
      startTime: eventTime.trim(),
      venue: eventVenue.trim(),
      address: eventAddress.trim(),
      mapUrl: eventMapUrl.trim() || "",
      dressCode: eventDressCode.trim() || "",
      description: eventDescription.trim() || "",
      sortOrder: Number(eventSortOrder) || 0,
    };

    try {
      const url = editingEvent ? `/api/admin/events/${editingEvent.id}` : `/api/admin/events`;
      const method = editingEvent ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setEventFormError(data.error || "Failed to save event");
        return;
      }

      setToast({
        message: editingEvent ? "Event updated successfully" : "Event created successfully",
        severity: "success",
      });
      setEventDialogOpen(false);
      fetchData();
    } catch {
      setEventFormError("Network error while saving event");
    } finally {
      setEventSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventItem) return;
    setDeleteSubmitting(true);

    try {
      const res = await fetch(`/api/admin/events/${deleteEventItem.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setToast({ message: data.error || "Failed to delete event", severity: "error" });
        return;
      }

      setToast({ message: "Event removed safely", severity: "success" });
      setDeleteEventItem(null);
      fetchData();
    } catch {
      setToast({ message: "Network error while deleting event", severity: "error" });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Access Level Handlers
  const openCreateAlDialog = () => {
    setEditingAl(null);
    setAlName("");
    setAlSelectedEventIds([]);
    setAlFormError(null);
    setAlDialogOpen(true);
  };

  const openEditAlDialog = (al: AccessLevelItem) => {
    setEditingAl(al);
    setAlName(al.name);
    setAlSelectedEventIds(al.events.map((e) => e.event.id));
    setAlFormError(null);
    setAlDialogOpen(true);
  };

  const toggleEventForAl = (eventId: string) => {
    setAlSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handleSaveAl = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlSubmitting(true);
    setAlFormError(null);

    const payload = {
      name: alName.trim(),
      eventIds: alSelectedEventIds,
    };

    try {
      const url = editingAl
        ? `/api/admin/access-levels/${editingAl.id}`
        : `/api/admin/access-levels`;
      const method = editingAl ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setAlFormError(data.error || "Failed to save access level");
        return;
      }

      setToast({
        message: editingAl
          ? "Access level updated successfully"
          : "Access level created successfully",
        severity: "success",
      });
      setAlDialogOpen(false);
      fetchData();
    } catch {
      setAlFormError("Network error while saving access level");
    } finally {
      setAlSubmitting(false);
    }
  };

  const handleDeleteAl = async () => {
    if (!deleteAlItem) return;
    setDeleteSubmitting(true);

    try {
      const res = await fetch(`/api/admin/access-levels/${deleteAlItem.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setToast({ message: data.error || "Failed to delete access level", severity: "error" });
        return;
      }

      setToast({ message: "Access level removed safely", severity: "success" });
      setDeleteAlItem(null);
      fetchData();
    } catch {
      setToast({ message: "Network error while deleting access level", severity: "error" });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleLoadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const res = await fetch("/api/admin/events/template", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || "Failed to load template", severity: "error" });
        return;
      }

      setToast({
        message: "Standard events and access levels loaded successfully",
        severity: "success",
      });
      fetchData();
    } catch {
      setToast({ message: "Network error while loading template", severity: "error" });
    } finally {
      setLoadingTemplate(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {/* Page Header */}
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
            Events & Access Levels
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage the celebration events and define guest access tiers for this wedding.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {events.length === 0 && (
            <Button
              variant="outlined"
              startIcon={<AutoAwesome fontSize="small" />}
              onClick={handleLoadTemplate}
              disabled={loadingTemplate}
              sx={{ minHeight: 44 }}
            >
              {loadingTemplate ? "Loading Template..." : "Load Default Template"}
            </Button>
          )}

          {tabIndex === 0 ? (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={openCreateEventDialog}
              sx={{ minHeight: 44 }}
            >
              Add Event
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={openCreateAlDialog}
              sx={{ minHeight: 44 }}
            >
              Add Access Level
            </Button>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: `1px solid ${tokens.neutral.border}`, px: 2 }}
        >
          <Tab
            icon={<EventIcon fontSize="small" />}
            iconPosition="start"
            label={`Events (${events.length})`}
            sx={{ minHeight: 48, fontWeight: 600 }}
          />
          <Tab
            icon={<Checklist fontSize="small" />}
            iconPosition="start"
            label={`Access Levels (${accessLevels.length})`}
            sx={{ minHeight: 48, fontWeight: 600 }}
          />
        </Tabs>

        {loading ? (
          <Box sx={{ p: 6, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={32} color="inherit" />
          </Box>
        ) : (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* TAB 0: EVENTS */}
            {tabIndex === 0 && (
              <>
                {events.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: "center" }}>
                    <EventIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                      No events added yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Create individual events or start with the default 4-event celebration template.
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center" }}>
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={openCreateEventDialog}
                        sx={{ minHeight: 44 }}
                      >
                        Create Event
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<AutoAwesome />}
                        onClick={handleLoadTemplate}
                        disabled={loadingTemplate}
                        sx={{ minHeight: 44 }}
                      >
                        Load Template
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, 1fr)",
                      },
                      gap: 2.5,
                    }}
                  >
                    {events.map((ev) => {
                      const formattedDate = new Date(ev.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      return (
                        <Card
                          key={ev.id}
                          variant="outlined"
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            border: `1px solid ${tokens.neutral.border}`,
                          }}
                        >
                          <CardContent sx={{ flex: 1, pb: 1 }}>
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                mb: 1,
                              }}
                            >
                              <Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                  {ev.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Order #{ev.sortOrder}
                                </Typography>
                              </Box>

                              <Chip
                                icon={<AccessTime fontSize="small" />}
                                label={ev.startTime}
                                size="small"
                                variant="outlined"
                              />
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                              <EventIcon fontSize="small" sx={{ color: "text.secondary" }} />
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {formattedDate}
                              </Typography>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
                              <LocationOn fontSize="small" sx={{ color: "text.secondary", mt: 0.2 }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {ev.venue}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {ev.address}
                                </Typography>
                              </Box>
                            </Box>

                            {ev.dressCode && (
                              <Typography variant="body2" sx={{ mb: 1, fontSize: "0.85rem" }}>
                                <strong>Dress Code:</strong> {ev.dressCode}
                              </Typography>
                            )}

                            {ev.description && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 1.5, fontSize: "0.85rem" }}
                              >
                                {ev.description}
                              </Typography>
                            )}

                            <Divider sx={{ my: 1 }} />

                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                              Linked Access Levels:
                            </Typography>
                            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                              {ev.accessLevels && ev.accessLevels.length > 0 ? (
                                ev.accessLevels.map((al) => (
                                  <Chip
                                    key={al.accessLevel.id}
                                    label={al.accessLevel.name}
                                    size="small"
                                    sx={{ bgcolor: tokens.neutral.subtle, fontSize: "0.75rem" }}
                                  />
                                ))
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  Not assigned to any access level yet
                                </Typography>
                              )}
                            </Box>
                          </CardContent>

                          <CardActions sx={{ justifyContent: "flex-end", px: 2, pb: 2, pt: 0, gap: 1 }}>
                            <Button
                              size="small"
                              startIcon={<Edit fontSize="small" />}
                              onClick={() => openEditEventDialog(ev)}
                              sx={{ minHeight: 36 }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              startIcon={<DeleteOutline fontSize="small" />}
                              onClick={() => setDeleteEventItem(ev)}
                              sx={{ minHeight: 36 }}
                            >
                              Delete
                            </Button>
                          </CardActions>
                        </Card>
                      );
                    })}
                  </Box>
                )}
              </>
            )}

            {/* TAB 1: ACCESS LEVELS */}
            {tabIndex === 1 && (
              <>
                {accessLevels.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: "center" }}>
                    <Checklist sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                      No access levels defined yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Create tiers (e.g. All Events, Reception Only) to control which events guests can see.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={openCreateAlDialog}
                      sx={{ minHeight: 44 }}
                    >
                      Create Access Level
                    </Button>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, 1fr)",
                      },
                      gap: 2.5,
                    }}
                  >
                    {accessLevels.map((al) => (
                      <Card
                        key={al.id}
                        variant="outlined"
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          border: `1px solid ${tokens.neutral.border}`,
                        }}
                      >
                        <CardContent sx={{ flex: 1, pb: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              mb: 1.5,
                            }}
                          >
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                              {al.name}
                            </Typography>
                            <Chip
                              icon={<People fontSize="small" />}
                              label={`${al._count?.guests ?? 0} Guests`}
                              size="small"
                              variant="outlined"
                            />
                          </Box>

                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                            Included Events ({al.events.length}):
                          </Typography>

                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 1 }}>
                            {al.events.length > 0 ? (
                              al.events.map((e) => (
                                <Box
                                  key={e.event.id}
                                  sx={{
                                    p: 1,
                                    borderRadius: 1,
                                    bgcolor: tokens.neutral.subtle,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {e.event.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {e.event.startTime}
                                  </Typography>
                                </Box>
                              ))
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                No events linked to this access level
                              </Typography>
                            )}
                          </Box>
                        </CardContent>

                        <CardActions sx={{ justifyContent: "flex-end", px: 2, pb: 2, pt: 0, gap: 1 }}>
                          <Button
                            size="small"
                            startIcon={<Edit fontSize="small" />}
                            onClick={() => openEditAlDialog(al)}
                            sx={{ minHeight: 36 }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteOutline fontSize="small" />}
                            onClick={() => setDeleteAlItem(al)}
                            sx={{ minHeight: 36 }}
                          >
                            Delete
                          </Button>
                        </CardActions>
                      </Card>
                    ))}
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </Paper>

      {/* EVENT CREATE/EDIT DIALOG */}
      <Dialog
        open={eventDialogOpen}
        onClose={() => !eventSubmitting && setEventDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSaveEvent}>
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {editingEvent ? "Edit Event" : "Create New Event"}
            </Typography>
            <IconButton onClick={() => setEventDialogOpen(false)} disabled={eventSubmitting}>
              <Close />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            {eventFormError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {eventFormError}
              </Alert>
            )}

            <TextField
              label="Event Name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. Sangeet & Cocktail Night"
              fullWidth
              required
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
              <TextField
                label="Date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="Start Time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                placeholder="7:00 PM"
                fullWidth
                required
              />
            </Box>

            <TextField
              label="Venue Name"
              value={eventVenue}
              onChange={(e) => setEventVenue(e.target.value)}
              placeholder="e.g. Grand Ballroom"
              fullWidth
              required
              sx={{ mb: 2 }}
            />

            <TextField
              label="Address"
              value={eventAddress}
              onChange={(e) => setEventAddress(e.target.value)}
              placeholder="Full venue address"
              fullWidth
              required
              sx={{ mb: 2 }}
            />

            <TextField
              label="Google Maps URL (optional)"
              value={eventMapUrl}
              onChange={(e) => setEventMapUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
              fullWidth
              sx={{ mb: 2 }}
            />

            <TextField
              label="Dress Code (optional)"
              value={eventDressCode}
              onChange={(e) => setEventDressCode(e.target.value)}
              placeholder="e.g. Indo-Western / Glam"
              fullWidth
              sx={{ mb: 2 }}
            />

            <TextField
              label="Description (optional)"
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Notes or instructions for guests"
              multiline
              rows={2}
              fullWidth
              sx={{ mb: 2 }}
            />

            <TextField
              label="Display Sort Order"
              type="number"
              value={eventSortOrder}
              onChange={(e) => setEventSortOrder(Number(e.target.value))}
              helperText="Determines chronological order on public invite"
              fullWidth
            />
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setEventDialogOpen(false)} disabled={eventSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={eventSubmitting || !eventName || !eventVenue || !eventAddress}
              sx={{ minHeight: 44 }}
            >
              {eventSubmitting ? (
                <CircularProgress size={20} color="inherit" />
              ) : editingEvent ? (
                "Save Changes"
              ) : (
                "Create Event"
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ACCESS LEVEL CREATE/EDIT DIALOG */}
      <Dialog
        open={alDialogOpen}
        onClose={() => !alSubmitting && setAlDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSaveAl}>
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {editingAl ? "Edit Access Level" : "Create Access Level"}
            </Typography>
            <IconButton onClick={() => setAlDialogOpen(false)} disabled={alSubmitting}>
              <Close />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            {alFormError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {alFormError}
              </Alert>
            )}

            <TextField
              label="Access Level Name"
              value={alName}
              onChange={(e) => setAlName(e.target.value)}
              placeholder="e.g. All Events, Reception Only"
              fullWidth
              required
              sx={{ mb: 2 }}
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Select Included Events:
            </Typography>

            {events.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No events created yet. Add events first so they can be assigned here.
              </Typography>
            ) : (
              <FormGroup sx={{ pl: 1 }}>
                {events.map((ev) => (
                  <FormControlLabel
                    key={ev.id}
                    control={
                      <Checkbox
                        checked={alSelectedEventIds.includes(ev.id)}
                        onChange={() => toggleEventForAl(ev.id)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {ev.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {ev.venue} • {ev.startTime}
                        </Typography>
                      </Box>
                    }
                    sx={{ mb: 1 }}
                  />
                ))}
              </FormGroup>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setAlDialogOpen(false)} disabled={alSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={alSubmitting || !alName}
              sx={{ minHeight: 44 }}
            >
              {alSubmitting ? (
                <CircularProgress size={20} color="inherit" />
              ) : editingAl ? (
                "Save Changes"
              ) : (
                "Create"
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* DELETE EVENT CONFIRMATION */}
      <Dialog open={Boolean(deleteEventItem)} onClose={() => setDeleteEventItem(null)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Remove Event?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Are you sure you want to remove <strong>{deleteEventItem?.name}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            This will safely unassign the event from any access levels. The access levels themselves will remain intact.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteEventItem(null)} disabled={deleteSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteEvent}
            color="error"
            variant="contained"
            disabled={deleteSubmitting}
            sx={{ minHeight: 44 }}
          >
            {deleteSubmitting ? <CircularProgress size={20} color="inherit" /> : "Delete Event"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE ACCESS LEVEL CONFIRMATION */}
      <Dialog open={Boolean(deleteAlItem)} onClose={() => setDeleteAlItem(null)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Remove Access Level?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Are you sure you want to remove <strong>{deleteAlItem?.name}</strong>?
          </Typography>
          {(deleteAlItem?._count?.guests ?? 0) > 0 ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {deleteAlItem?._count?.guests} guests currently have this access level. Deleting it will safely clear their access level assignment without deleting the guests.
            </Alert>
          ) : (
            <Typography variant="caption" color="text.secondary">
              No guests are currently assigned to this access level.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteAlItem(null)} disabled={deleteSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAl}
            color="error"
            variant="contained"
            disabled={deleteSubmitting}
            sx={{ minHeight: 44 }}
          >
            {deleteSubmitting ? <CircularProgress size={20} color="inherit" /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
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
