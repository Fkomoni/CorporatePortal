import * as XLSX from "xlsx";

export interface BulkUploadRow {
  id: string;
  title: string;
  surname: string;
  firstname: string;
  otherName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  city: string;
  employeeNumber: string;
  memberDependantIndicator: string;
  relationshipToMainMember: string;
  startDateOfMember: string;
  maritalStatus: string;
  contacts: string;
  state: string;
  email: string;
  scheme: string;
  // Status fields after submission
  status?: "success" | "failed" | "pending";
  membershipNo?: string;
  errorMessage?: string;
}

/**
 * Parse Excel date to dd/mm/yyyy format
 */
const parseExcelDate = (value: any): string => {
  if (!value) return "";

  // If it's already a string in dd/mm/yyyy format, return it
  if (typeof value === "string" && value.includes("/")) {
    return value;
  }

  // If it's an Excel serial date number
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);

    if (date) {
      const day = String(date.d).padStart(2, "0");
      const month = String(date.m).padStart(2, "0");
      const year = date.y;

      return `${day}/${month}/${year}`;
    }
  }

  // If it's a Date object
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = value.getFullYear();

    return `${day}/${month}/${year}`;
  }

  return value.toString();
};

/**
 * Normalize text for case-insensitive matching and trim whitespace
 */
export const normalizeText = (text: string): string => {
  if (!text) return "";

  return text.toString().trim().toLowerCase();
};

/**
 * Find matching option from a list (case-insensitive, whitespace-trimmed)
 */
export const findMatchingOption = (
  value: string,
  options: Array<{ Text?: string; title?: string; Sex?: string; MaritalStatus?: string }>
): any => {
  if (!value || !options) return null;

  const normalizedValue = normalizeText(value);

  return options.find((option) => {
    const optionText =
      option.Text || option.title || option.Sex || option.MaritalStatus || "";

    return normalizeText(optionText) === normalizedValue;
  });
};

/**
 * Generate and download Excel template for bulk upload with sample data
 */
export const downloadBulkUploadTemplate = () => {
  // Create workbook
  const wb = XLSX.utils.book_new();

  // Define headers for the template
  const headers = [
    "Title",
    "Surname",
    "Firstname",
    "Other Name",
    "Date of Birth\ndd/mm/ccyy",
    "Gender\nFemale or Male",
    "Address\nNo commas",
    "City",
    "Employee number",
    "Member/Dependant\nIndicator",
    "Relationship to main member",
    "Start date of member\ndd/mm/ccyy",
    "Marital status",
    "Contacts",
    "State",
    "Email",
    "Scheme",
  ];

  // Sample data with realistic Nigerian information - mixed employee numbers
  const sampleData = [
    ["Mr", "Obileye", "Chinedu", "Kenneth", "12/06/1988", "Male", "23 Orchid Road Lekki", "Lekki", "EMP101", "M", "Main member", "01/02/2025", "MARRIED", "08091234567", "Lagos", "chinedu.obileye@email.com", "MAX - Leadway Holdings2026"],
    ["Mrs", "Obileye", "Chioma", "Grace", "18/09/1990", "Female", "23 Orchid Road Lekki", "Lekki", "EMP101", "D", "Spouse", "01/02/2025", "MARRIED", "08091234568", "Lagos", "chioma.obileye@email.com", "MAX - Leadway Holdings2026"],
    ["Dr", "Nwosu", "Amaka", "Ifeoma", "25/03/1982", "Female", "45 Admiralty Road Victoria Island", "Victoria Island", "EMP205", "M", "Main member", "01/02/2025", "SINGLE", "08023456780", "Lagos", "amaka.nwosu@email.com", "PREMIUM - Leadway Holdings2026"],
    ["Miss", "Obileye", "Chiamaka", "Peace", "14/07/2015", "Female", "23 Orchid Road Lekki", "Lekki", "EMP101", "D", "Daughter", "01/02/2025", "SINGLE", "08091234569", "Lagos", "", "MAX - Leadway Holdings2026"],
    ["Mr", "Bakare", "Oluwaseun", "Tunde", "30/11/1985", "Male", "78 Allen Avenue Ikeja", "Ikeja", "EMP312", "M", "Main member", "01/03/2025", "MARRIED", "08045678912", "Lagos", "seun.bakare@email.com", "MAX - Leadway Holdings2026"],
    ["Mrs", "Bakare", "Folake", "Titilayo", "05/02/1987", "Female", "78 Allen Avenue Ikeja", "Ikeja", "EMP312", "D", "Spouse", "01/03/2025", "MARRIED", "08045678913", "Lagos", "folake.bakare@email.com", "MAX - Leadway Holdings2026"],
    ["Mr", "Bakare", "Ayomide", "Samuel", "22/08/2012", "Male", "78 Allen Avenue Ikeja", "Ikeja", "EMP312", "D", "Son", "01/03/2025", "SINGLE", "08045678914", "Lagos", "", "MAX - Leadway Holdings2026"],
    ["Miss", "Okoro", "Blessing", "Ngozi", "16/04/1992", "Female", "12 Awolowo Road Ikoyi", "Ikoyi", "EMP420", "M", "Main member", "15/03/2025", "SINGLE", "08056789023", "Lagos", "blessing.okoro@email.com", "PREMIUM - Leadway Holdings2026"],
    ["Mr", "Usman", "Ibrahim", "Musa", "08/01/1980", "Male", "34 Constitution Avenue Abuja", "Abuja", "EMP518", "M", "Main member", "15/03/2025", "MARRIED", "08034567892", "Abuja", "ibrahim.usman@email.com", "MAX - Leadway Holdings2026"],
    ["Mrs", "Usman", "Hadiza", "Amina", "19/05/1983", "Female", "34 Constitution Avenue Abuja", "Abuja", "EMP518", "D", "Spouse", "15/03/2025", "MARRIED", "08034567893", "Abuja", "hadiza.usman@email.com", "MAX - Leadway Holdings2026"],
  ];

  // Combine headers and sample data
  const worksheetData = [headers, ...sampleData];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  ws["!cols"] = [
    { wch: 10 },  // Title
    { wch: 15 },  // Surname
    { wch: 15 },  // Firstname
    { wch: 15 },  // Other Name
    { wch: 15 },  // Date of Birth
    { wch: 15 },  // Gender
    { wch: 35 },  // Address
    { wch: 18 },  // City
    { wch: 15 },  // Employee number
    { wch: 18 },  // Member/Dependant Indicator
    { wch: 25 },  // Relationship to main member
    { wch: 20 },  // Start date of member
    { wch: 15 },  // Marital status
    { wch: 15 },  // Contacts
    { wch: 15 },  // State
    { wch: 30 },  // Email
    { wch: 30 },  // Scheme
  ];

  // Style the header row (make it green with white text)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:Q1");

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });

    if (!ws[cellAddress]) continue;

    ws[cellAddress].s = {
      fill: { fgColor: { rgb: "92D050" } },
      font: { bold: true, color: { rgb: "000000" } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
    };
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Bulk Upload Template");

  // Generate and download file
  XLSX.writeFile(wb, "Bulk_Upload_Template.xlsx");
};

/**
 * Parse uploaded Excel file and convert to array of BulkUploadRow
 */
export const parseExcelFile = async (
  file: File
): Promise<BulkUploadRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary", cellDates: true });

        // Get first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: "",
        });

        if (jsonData.length === 0) {
          reject(new Error("Excel file is empty"));

          return;
        }

        // Validate template headers
        const headers = jsonData[0];
        const expectedHeaders = [
          "Title",
          "Surname",
          "Firstname",
          "Other Name",
          "Date of Birth",
          "Gender",
          "Address",
          "City",
          "Employee number",
          "Member/Dependant",
          "Relationship to main member",
          "Start date of member",
          "Marital status",
          "Contacts",
          "State",
          "Email",
          "Scheme",
        ];

        // Check if header contains expected columns (case-insensitive)
        const normalizedHeaders = headers.map((h: string) =>
          normalizeText(h.split("\n")[0])
        );
        const hasRequiredColumns = expectedHeaders.every((expected) =>
          normalizedHeaders.some((h: string) => normalizeText(h).includes(normalizeText(expected)))
        );

        if (!hasRequiredColumns) {
          reject(
            new Error(
              "Invalid template! Please download the correct template and use it."
            )
          );

          return;
        }

        // Helper function to auto-correct gender based on relationship
        const autoCorrectGender = (relationship: string, gender: string): string => {
          const rel = normalizeText(relationship);

          if (rel === "son") return "Male";
          if (rel === "daughter") return "Female";

          return gender; // Keep original if not Son/Daughter
        };

        // Skip header row and map to BulkUploadRow
        const rows: BulkUploadRow[] = jsonData
          .slice(1) // Skip header
          .filter((row) => row.length > 0 && row[1]) // Filter empty rows and ensure surname exists
          .map((row, index) => {
            const relationship = (row[10] || "").toString().trim();
            let gender = (row[5] || "").toString().trim();

            // Auto-correct gender for Son/Daughter
            gender = autoCorrectGender(relationship, gender);

            return {
              id: `row-${Date.now()}-${index}`,
              title: (row[0] || "").toString().trim(),
              surname: (row[1] || "").toString().trim(),
              firstname: (row[2] || "").toString().trim(),
              otherName: (row[3] || "").toString().trim(),
              dateOfBirth: parseExcelDate(row[4]),
              gender: gender,
              address: (row[6] || "").toString().trim(),
              city: (row[7] || "").toString().trim(),
              employeeNumber: (row[8] || "").toString().trim(),
              memberDependantIndicator: (row[9] || "").toString().trim().toUpperCase(),
              relationshipToMainMember: relationship,
              startDateOfMember: parseExcelDate(row[11]),
              maritalStatus: (row[12] || "").toString().trim().toUpperCase(),
              contacts: (row[13] || "").toString().trim(),
              state: (row[14] || "").toString().trim(),
              email: (row[15] || "").toString().trim(),
              scheme: (row[16] || "").toString().trim(),
            };
          });

        resolve(rows);
      } catch (error) {
        reject(new Error("Failed to parse Excel file: " + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsBinaryString(file);
  });
};

/**
 * Validate a bulk upload row
 */
export const validateBulkUploadRow = (row: BulkUploadRow): string[] => {
  const errors: string[] = [];

  if (!row.surname) errors.push("Surname is required");
  if (!row.firstname) errors.push("Firstname is required");
  if (!row.dateOfBirth) errors.push("Date of Birth is required");
  if (!row.gender) errors.push("Gender is required");
  if (!row.employeeNumber && row.memberDependantIndicator?.toUpperCase() === "M") {
    errors.push("Employee number is required for main members");
  }
  if (!row.memberDependantIndicator) {
    errors.push("Member/Dependant Indicator is required (M or D)");
  }
  if (!row.startDateOfMember) errors.push("Start date is required");
  if (!row.maritalStatus) errors.push("Marital status is required");
  if (!row.email && row.memberDependantIndicator?.toUpperCase() === "M") {
    errors.push("Email is required for main members");
  }

  return errors;
};

export function rowsToExcelBase64(rows: BulkUploadRow[]): string {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Results");

  return XLSX.write(wb, { bookType: "xlsx", type: "base64" });
}

/**
 * Export bulk upload results to Excel
 */
export const exportResultsToExcel = (rows: BulkUploadRow[]) => {
  // Create workbook
  const wb = XLSX.utils.book_new();

  // Define headers
  const headers = [
    "Title",
    "Surname",
    "Firstname",
    "Other Name",
    "Date of Birth",
    "Gender",
    "Address",
    "City",
    "Employee number",
    "Member/Dependant Indicator",
    "Relationship to main member",
    "Start date of member",
    "Marital status",
    "Contacts",
    "State",
    "Email",
    "Membership No",
    "Status",
    "Error Message",
  ];

  // Map rows to data array
  const data = rows.map((row) => [
    row.title,
    row.surname,
    row.firstname,
    row.otherName,
    row.dateOfBirth,
    row.gender,
    row.address,
    row.city,
    row.employeeNumber,
    row.memberDependantIndicator,
    row.relationshipToMainMember,
    row.startDateOfMember,
    row.maritalStatus,
    row.contacts,
    row.state,
    row.email,
    row.membershipNo || "",
    row.status ? row.status.toUpperCase() : "PENDING",
    row.errorMessage || "",
  ]);

  // Combine headers and data
  const worksheetData = [headers, ...data];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  ws["!cols"] = [
    { wch: 10 },  // Title
    { wch: 15 },  // Surname
    { wch: 15 },  // Firstname
    { wch: 15 },  // Other Name
    { wch: 15 },  // Date of Birth
    { wch: 15 },  // Gender
    { wch: 35 },  // Address
    { wch: 18 },  // City
    { wch: 15 },  // Employee number
    { wch: 18 },  // Member/Dependant Indicator
    { wch: 25 },  // Relationship to main member
    { wch: 20 },  // Start date of member
    { wch: 15 },  // Marital status
    { wch: 15 },  // Contacts
    { wch: 15 },  // State
    { wch: 30 },  // Email
    { wch: 20 },  // Membership No
    { wch: 12 },  // Status
    { wch: 50 },  // Error Message
  ];

  // Style header row
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:S1");

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });

    if (!ws[cellAddress]) continue;

    ws[cellAddress].s = {
      fill: { fgColor: { rgb: "92D050" } },
      font: { bold: true, color: { rgb: "000000" } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
    };
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Enrollment Results");

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `Enrollment_Results_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
};
