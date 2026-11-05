"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  CloudUpload,
  Close,
  Download,
  CheckCircle,
  Warning,
  ArrowBack,
  ArrowForward,
} from "@mui/icons-material";
import { parseFile, guessColumnMapping, ParsedTableData } from "@/lib/client-file-parser";
import { ValidatedGuestRow, ImportValidationResult } from "@/lib/import-validation";
import Papa from "papaparse";

interface GuestImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (importedCount: number) => void;
}

const STEPS = ["Upload File", "Map Columns", "Preview & Validate"];

export default function GuestImportDialog({
  open,
  onClose,
  onSuccess,
}: GuestImportDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [tableData, setTableData] = useState<ParsedTableData | null>(null);
  const [columnMapping, setColumnMapping] = useState({
    name: "",
    phone: "",
    city: "",
    pax: "",
  });
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setActiveStep(0);
    setFile(null);
    setTableData(null);
    setColumnMapping({ name: "", phone: "", city: "", pax: "" });
    setValidationResult(null);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Step 1: File selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setFile(selectedFile);

    try {
      const parsed = await parseFile(selectedFile);
      if (parsed.rows.length === 0) {
        setError("The uploaded file contains no data rows.");
        return;
      }
      setTableData(parsed);
      const guessed = guessColumnMapping(parsed.headers);
      setColumnMapping(guessed);
      setActiveStep(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  // Step 2: Validate mapped rows
  const handleProceedToValidation = async () => {
    if (!columnMapping.name || !columnMapping.phone) {
      setError("Please map at least Name and Phone columns.");
      return;
    }

    if (!tableData) return;

    setError(null);
    setValidating(true);

    try {
      const rawRows = tableData.rows.map((row) => ({
        name: row[columnMapping.name],
        phone: row[columnMapping.phone],
        city: columnMapping.city ? row[columnMapping.city] : "",
        pax: columnMapping.pax ? row[columnMapping.pax] : 1,
      }));

      const res = await fetch("/api/admin/guests/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", rawRows }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to validate file");
      }

      setValidationResult(data);
      setActiveStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  // Step 3: Perform import
  const handleImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/guests/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          validRowsToImport: validationResult.validRows,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import rows");
      }

      onSuccess(data.importedCount);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  // Download rejected rows CSV
  const handleDownloadRejected = () => {
    if (!validationResult || validationResult.invalidRows.length === 0) return;

    const rows = validationResult.invalidRows.map((r) => ({
      Row: r.rowNumber,
      Name: r.name,
      Phone: r.phone,
      City: r.city,
      Pax: r.pax,
      Errors: r.errors.join("; "),
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rejected-guests-${file?.name || "import"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={isMobile}
      maxWidth="md"
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
          Import Guests
        </Typography>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* STEP 0: UPLOAD FILE */}
        {activeStep === 0 && (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Box
              component="label"
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: "2px dashed",
                borderColor: "divider",
                borderRadius: 2,
                p: 4,
                cursor: "pointer",
                bgcolor: "background.paper",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
            >
              <CloudUpload sx={{ fontSize: 56, color: "primary.main", mb: 1.5 }} />
              <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
                Click to upload CSV or Excel (.xlsx)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                File should contain Name, Phone, and optional City and Pax
              </Typography>
              <Button variant="outlined" component="span" size="small">
                Browse Files
              </Button>
              <input
                type="file"
                hidden
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
              />
            </Box>

            <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
              <Button
                variant="text"
                size="small"
                startIcon={<Download />}
                href="/sample-guests.csv"
                download="sample-guests.csv"
              >
                Download Sample CSV Template
              </Button>
            </Box>
          </Box>
        )}

        {/* STEP 1: MAP COLUMNS */}
        {activeStep === 1 && tableData && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Map the columns from your file ({file?.name}) to the guest fields:
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
                mb: 3,
              }}
            >
              <FormControl fullWidth required>
                <InputLabel id="map-name-label">Name Column</InputLabel>
                <Select
                  labelId="map-name-label"
                  label="Name Column *"
                  value={columnMapping.name}
                  onChange={(e) =>
                    setColumnMapping((prev) => ({ ...prev, name: e.target.value }))
                  }
                >
                  <MenuItem value="">
                    <em>Select column</em>
                  </MenuItem>
                  {tableData.headers.map((h) => (
                    <MenuItem key={h} value={h}>
                      {h}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel id="map-phone-label">Phone Column</InputLabel>
                <Select
                  labelId="map-phone-label"
                  label="Phone Column *"
                  value={columnMapping.phone}
                  onChange={(e) =>
                    setColumnMapping((prev) => ({ ...prev, phone: e.target.value }))
                  }
                >
                  <MenuItem value="">
                    <em>Select column</em>
                  </MenuItem>
                  {tableData.headers.map((h) => (
                    <MenuItem key={h} value={h}>
                      {h}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="map-city-label">City Column (Optional)</InputLabel>
                <Select
                  labelId="map-city-label"
                  label="City Column (Optional)"
                  value={columnMapping.city}
                  onChange={(e) =>
                    setColumnMapping((prev) => ({ ...prev, city: e.target.value }))
                  }
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {tableData.headers.map((h) => (
                    <MenuItem key={h} value={h}>
                      {h}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="map-pax-label">Pax Column (Optional, defaults to 1)</InputLabel>
                <Select
                  labelId="map-pax-label"
                  label="Pax Column (Optional, defaults to 1)"
                  value={columnMapping.pax}
                  onChange={(e) =>
                    setColumnMapping((prev) => ({ ...prev, pax: e.target.value }))
                  }
                >
                  <MenuItem value="">
                    <em>None (Default 1)</em>
                  </MenuItem>
                  {tableData.headers.map((h) => (
                    <MenuItem key={h} value={h}>
                      {h}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              First 3 rows preview from uploaded file:
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, maxHeight: 180 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {tableData.headers.map((h) => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableData.rows.slice(0, 3).map((r, i) => (
                    <TableRow key={i}>
                      {tableData.headers.map((h) => (
                        <TableCell key={h}>{r[h] || "—"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* STEP 2: PREVIEW & VALIDATE */}
        {activeStep === 2 && validationResult && (
          <Box>
            <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
              <Paper
                variant="outlined"
                sx={{
                  flex: 1,
                  minWidth: 140,
                  p: 2,
                  bgcolor: "action.selected",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <CheckCircle sx={{ color: "success.main" }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "success.dark" }}>
                    {validationResult.validRows.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Valid rows ready to import
                  </Typography>
                </Box>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  flex: 1,
                  minWidth: 140,
                  p: 2,
                  bgcolor: "action.hover",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <Warning
                  sx={{
                    color:
                      validationResult.invalidRows.length > 0
                        ? "warning.main"
                        : "text.disabled",
                  }}
                />
                <Box>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color:
                        validationResult.invalidRows.length > 0
                          ? "warning.dark"
                          : "text.primary",
                    }}
                  >
                    {validationResult.invalidRows.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Rejected rows with issues
                  </Typography>
                </Box>
              </Paper>
            </Box>

            {validationResult.invalidRows.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle2" color="error.main" sx={{ fontWeight: 600 }}>
                    Rejected Rows ({validationResult.invalidRows.length})
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    startIcon={<Download />}
                    onClick={handleDownloadRejected}
                  >
                    Download Rejected CSV
                  </Button>
                </Box>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 180 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Row</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {validationResult.invalidRows.slice(0, 5).map((r) => (
                        <TableRow key={r.rowNumber}>
                          <TableCell>{r.rowNumber}</TableCell>
                          <TableCell>{r.name || "—"}</TableCell>
                          <TableCell>{r.phone || "—"}</TableCell>
                          <TableCell>
                            {r.errors.map((e, idx) => (
                              <Chip
                                key={idx}
                                label={e}
                                size="small"
                                color="error"
                                variant="outlined"
                                sx={{ mr: 0.5, my: 0.2 }}
                              />
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {validationResult.validRows.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Valid Rows Preview ({validationResult.validRows.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 180 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Normalised Phone</TableCell>
                        <TableCell>City</TableCell>
                        <TableCell align="right">Pax</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {validationResult.validRows.slice(0, 5).map((r) => (
                        <TableRow key={r.rowNumber}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.phone}</TableCell>
                          <TableCell>{r.city || "—"}</TableCell>
                          <TableCell align="right">{r.pax}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {activeStep > 0 && (
          <Button
            startIcon={<ArrowBack />}
            onClick={() => {
              setError(null);
              setActiveStep((s) => s - 1);
            }}
            disabled={validating || importing}
          >
            Back
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        {activeStep === 1 && (
          <Button
            variant="contained"
            endIcon={
              validating ? <CircularProgress size={18} color="inherit" /> : <ArrowForward />
            }
            onClick={handleProceedToValidation}
            disabled={validating || !columnMapping.name || !columnMapping.phone}
          >
            {validating ? "Validating..." : "Validate Rows"}
          </Button>
        )}

        {activeStep === 2 && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={
              importing ||
              !validationResult ||
              validationResult.validRows.length === 0
            }
          >
            {importing ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              `Import ${validationResult?.validRows.length || 0} Valid Rows`
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

