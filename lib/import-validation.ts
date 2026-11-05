import { normalisePhone } from "./phone";

export interface RawImportRow {
  name?: string;
  phone?: string;
  city?: string;
  pax?: string | number;
  [key: string]: unknown;
}

export interface ValidatedGuestRow {
  rowNumber: number;
  name: string;
  phone: string; // normalised E.164
  city: string;
  pax: number;
  isValid: boolean;
  errors: string[];
}

export interface ImportValidationResult {
  validRows: ValidatedGuestRow[];
  invalidRows: ValidatedGuestRow[];
}

export function validateImportRows(
  rows: RawImportRow[],
  existingPhones: Set<string>
): ImportValidationResult {
  const seenInFile = new Set<string>();
  const validRows: ValidatedGuestRow[] = [];
  const invalidRows: ValidatedGuestRow[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1;
    const errors: string[] = [];

    const name = String(row.name ?? "").trim();
    if (!name) {
      errors.push("Missing name");
    }

    const rawPhone = String(row.phone ?? "").trim();
    const normalised = normalisePhone(rawPhone);

    if (!rawPhone || !normalised) {
      errors.push("Invalid phone number (must be valid phone with optional country code, default India +91)");
    } else {
      if (seenInFile.has(normalised)) {
        errors.push(`Duplicate phone number in file (${normalised})`);
      } else {
        seenInFile.add(normalised);
      }

      if (existingPhones.has(normalised)) {
        errors.push(`Phone number already exists in database (${normalised})`);
      }
    }

    let pax = 1;
    if (row.pax !== undefined && row.pax !== null && String(row.pax).trim() !== "") {
      const parsedPax = parseInt(String(row.pax).trim(), 10);
      if (isNaN(parsedPax) || parsedPax < 1) {
        errors.push("Pax must be at least 1");
      } else {
        pax = parsedPax;
      }
    }

    const city = String(row.city ?? "").trim();

    const validatedRow: ValidatedGuestRow = {
      rowNumber,
      name,
      phone: normalised || rawPhone,
      city,
      pax,
      isValid: errors.length === 0,
      errors,
    };

    if (validatedRow.isValid) {
      validRows.push(validatedRow);
    } else {
      invalidRows.push(validatedRow);
    }
  });

  return { validRows, invalidRows };
}

