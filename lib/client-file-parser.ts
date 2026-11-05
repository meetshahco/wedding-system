import Papa from "papaparse";
import ExcelJS from "exceljs";

export interface ParsedTableData {
  headers: string[];
  rows: Record<string, string>[];
}

export async function parseFile(file: File): Promise<ParsedTableData> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: "greedy",
        complete: (results) => {
          const headers = results.meta.fields || [];
          const rows = (results.data as Record<string, unknown>[]).map((row) => {
            const cleanRow: Record<string, string> = {};
            for (const key of headers) {
              cleanRow[key] = String(row[key] ?? "").trim();
            }
            return cleanRow;
          });
          resolve({ headers, rows });
        },
        error: (err) => reject(err),
      });
    });
  }

  if (extension === "xlsx" || extension === "xls") {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("Excel file has no worksheets");
    }

    const headers: string[] = [];
    const rows: Record<string, string>[] = [];

    // Read first row as headers
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    // Read subsequent rows
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const rowData: Record<string, string> = {};
      let hasData = false;

      headers.forEach((header, index) => {
        const cell = row.getCell(index + 1);
        let val = "";
        if (cell.value !== null && cell.value !== undefined) {
          if (typeof cell.value === "object" && "text" in cell.value) {
            val = String((cell.value as { text: unknown }).text ?? "").trim();
          } else {
            val = String(cell.value).trim();
          }
        }
        if (val) hasData = true;
        rowData[header] = val;
      });

      if (hasData) {
        rows.push(rowData);
      }
    });

    return { headers, rows };
  }

  throw new Error("Unsupported file format. Please upload a .csv or .xlsx file.");
}

/**
 * Auto-guess column mapping from headers
 */
export function guessColumnMapping(headers: string[]): {
  name: string;
  phone: string;
  city: string;
  pax: string;
} {
  const mapping = { name: "", phone: "", city: "", pax: "" };

  for (const h of headers) {
    const lower = h.toLowerCase().trim();

    if (!mapping.name && (lower === "name" || lower.includes("name") || lower === "guest")) {
      mapping.name = h;
    } else if (
      !mapping.phone &&
      (lower.includes("phone") ||
        lower.includes("mobile") ||
        lower.includes("contact") ||
        lower.includes("number") ||
        lower.includes("whatsapp"))
    ) {
      mapping.phone = h;
    } else if (!mapping.city && (lower.includes("city") || lower.includes("location") || lower.includes("town"))) {
      mapping.city = h;
    } else if (
      !mapping.pax &&
      (lower.includes("pax") ||
        lower.includes("count") ||
        lower.includes("seats") ||
        lower.includes("people") ||
        lower.includes("guest count"))
    ) {
      mapping.pax = h;
    }
  }

  return mapping;
}

