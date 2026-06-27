import ExcelJS from "exceljs";

import { InvoiceLineItem } from "@/types";

export async function generateInvoiceExcel(
  invoiceData: InvoiceLineItem[],
  refNo: string,
  frequency: string,
  amountDueToday: number,
  paid: number,
  remaining: number,
  existingTotalAmount: number
): Promise<void> {
  if (!invoiceData || invoiceData.length === 0) {
    throw new Error("No invoice data provided");
  }

  const firstItem = invoiceData[0];
  const currentDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Leadway Health Limited";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Invoice", {
    pageSetup: { paperSize: 9, orientation: "portrait" },
  });

  // Set column widths
  worksheet.columns = [
    { width: 35 }, // A - Plan Type
    { width: 18 }, // B - Positive Premium
    { width: 18 }, // C - Negative Premium
    { width: 15 }, // D - Positive Pop
    { width: 15 }, // E - Negative Pop
    { width: 20 }, // F - Total Premium
    { width: 12 }, // G - Total Pop
  ];

  let currentRow = 1;

  // Company Header (Rows 1-4) - Right aligned
  const headerCell1 = worksheet.getCell("G1");

  headerCell1.value = "LEADWAY HEALTH LIMITED";
  headerCell1.font = { bold: true, size: 11 };
  headerCell1.alignment = { horizontal: "right", vertical: "middle" };

  const headerCell2 = worksheet.getCell("G2");

  headerCell2.value = "121, Funsho Williams Avenue";
  headerCell2.font = { size: 10 };
  headerCell2.alignment = { horizontal: "right", vertical: "middle" };

  const headerCell3 = worksheet.getCell("G3");

  headerCell3.value = "Iponri, Lagos, Nigeria";
  headerCell3.font = { size: 10 };
  headerCell3.alignment = { horizontal: "right", vertical: "middle" };

  const headerCell4 = worksheet.getCell("G4");

  headerCell4.value = "healthpartnerships@leadway.com";
  headerCell4.font = { size: 10 };
  headerCell4.alignment = { horizontal: "right", vertical: "middle" };

  currentRow = 6;

  // Orange Banner Row (Row 6)
  worksheet.mergeCells("A6:G6");
  const bannerCell = worksheet.getCell("A6");

  bannerCell.value = "LEADWAY HEALTH LIMITED";
  bannerCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  bannerCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC44915" },
  };
  bannerCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(6).height = 25;

  currentRow = 8;

  // Client Info (Rows 8-9)
  const clientCell1 = worksheet.getCell("A8");

  clientCell1.value = firstItem.Client_ClientName;
  clientCell1.font = { bold: true, size: 11 };

  const clientCell2 = worksheet.getCell("A9");

  clientCell2.value = firstItem.Client_Address;
  clientCell2.font = { size: 10 };

  currentRow = 11;

  // Invoice Header - Right Side (Rows 11-13)
  const invoiceHeaderCell = worksheet.getCell("G11");

  invoiceHeaderCell.value = "INVOICE";
  invoiceHeaderCell.font = {
    bold: true,
    size: 14,
    color: { argb: "FFC44915" },
  };
  invoiceHeaderCell.alignment = { horizontal: "right", vertical: "middle" };

  const refCell = worksheet.getCell("G12");

  refCell.value = `REF NO: ${refNo}`;
  refCell.font = { size: 10 };
  refCell.alignment = { horizontal: "right", vertical: "middle" };

  const dateCell = worksheet.getCell("G13");

  dateCell.value = `DATE: ${currentDate}`;
  dateCell.font = { size: 10 };
  dateCell.alignment = { horizontal: "right", vertical: "middle" };

  currentRow = 15;

  // Account Details - Right Side (Rows 15-17)
  const accNameCell = worksheet.getCell("G15");

  accNameCell.value = `ACCOUNT NAME: ${firstItem.AccName}`;
  accNameCell.font = { size: 10, bold: true };
  accNameCell.alignment = { horizontal: "right", vertical: "middle" };

  const bankNameCell = worksheet.getCell("G16");

  bankNameCell.value = `BANK NAME: ${firstItem.BankName}`;
  bankNameCell.font = { size: 10, bold: true };
  bankNameCell.alignment = { horizontal: "right", vertical: "middle" };

  const accNoCell = worksheet.getCell("G17");

  accNoCell.value = `ACCOUNT NO: ${firstItem.BankAcc}`;
  accNoCell.font = { size: 10, bold: true };
  accNoCell.alignment = { horizontal: "right", vertical: "middle" };

  currentRow = 19;

  // Policy Holder Row (Row 19)
  worksheet.mergeCells("A19:G19");
  const policyHolderCell = worksheet.getCell("A19");

  policyHolderCell.value = `POLICY HOLDER: ${firstItem.Client_ClientName}`;
  policyHolderCell.font = { size: 10 };
  policyHolderCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" },
  };
  policyHolderCell.alignment = { horizontal: "left", vertical: "middle" };
  worksheet.getRow(19).height = 20;

  currentRow = 21;

  // Table Header Row (Row 21)
  const headerRow = worksheet.getRow(21);
  const headers = [
    "PLAN TYPE",
    "POSITIVE PREMIUM (₦)",
    "NEGATIVE PREMIUM (₦)",
    "POSITIVE POP.",
    "NEGATIVE POP.",
    "TOTAL PREMIUM (₦)",
    "TOTAL POP.",
  ];

  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);

    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC44915" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
  headerRow.height = 20;

  currentRow = 22;

  // Invoice line items
  let grandTotal = 0;
  let totalPop = 0;

  invoiceData.forEach((item, index) => {
    const row = worksheet.getRow(currentRow);
    const isEvenRow = index % 2 === 0;

    const rowData = [
      item.Member_Plan,
      item.PositivePremium,
      item.NegativePremium,
      item.PositiveCount,
      item.NegativeCount,
      item.TotalPremium,
      item.TotalCount,
    ];

    rowData.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1);

      cell.value = value;

      if (colIndex >= 1 && colIndex <= 5) {
        if (typeof value === "number") {
          cell.numFmt =
            colIndex === 1 || colIndex === 2 || colIndex === 5
              ? "#,##0.00"
              : "0";
        }
      }

      cell.alignment = {
        horizontal: colIndex === 0 ? "left" : colIndex >= 3 ? "center" : "right",
        vertical: "middle",
      };

      if (!isEvenRow) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }

      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
    });

    grandTotal += item.TotalPremium;
    totalPop += item.TotalCount;
    currentRow++;
  });

  // Grand Total Row
  const totalRow = worksheet.getRow(currentRow);

  totalRow.height = 25;

  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const totalLabelCell = worksheet.getCell(`A${currentRow}`);

  totalLabelCell.value = "GRAND TOTAL";
  totalLabelCell.font = {
    bold: true,
    size: 11,
    color: { argb: "FFFFFFFF" },
  };
  totalLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC44915" },
  };
  totalLabelCell.alignment = { horizontal: "right", vertical: "middle" };
  totalLabelCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" },
  };

  const totalValueCell = worksheet.getCell(`F${currentRow}`);

  totalValueCell.value = `NGN ${grandTotal.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  totalValueCell.font = {
    bold: true,
    size: 11,
    color: { argb: "FFFFFFFF" },
  };
  totalValueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC44915" },
  };
  totalValueCell.alignment = { horizontal: "right", vertical: "middle" };
  totalValueCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" },
  };

  const totalPopCell = worksheet.getCell(`G${currentRow}`);

  totalPopCell.value = totalPop;
  totalPopCell.font = {
    bold: true,
    size: 11,
    color: { argb: "FFFFFFFF" },
  };
  totalPopCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC44915" },
  };
  totalPopCell.alignment = { horizontal: "center", vertical: "middle" };
  totalPopCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" },
  };

  currentRow += 2;

  // ═══ NEW: Payment Summary Table ═══
  // Amount Due Today (Blue)
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const dueLabelCell = worksheet.getCell(`A${currentRow}`);

  dueLabelCell.value = `Amount Due Today (${frequency})`;
  dueLabelCell.font = { bold: true, size: 10, color: { argb: "FF1E40AF" } };
  dueLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF6FF" }, // Light blue
  };
  dueLabelCell.alignment = { horizontal: "left", vertical: "middle" };
  dueLabelCell.border = {
    top: { style: "thin", color: { argb: "FFBFDBFE" } },
    left: { style: "thin", color: { argb: "FFBFDBFE" } },
    bottom: { style: "thin", color: { argb: "FFBFDBFE" } },
    right: { style: "thin", color: { argb: "FFBFDBFE" } },
  };

  worksheet.mergeCells(`F${currentRow}:G${currentRow}`);
  const dueValueCell = worksheet.getCell(`F${currentRow}`);

  dueValueCell.value = amountDueToday;
  dueValueCell.numFmt = '"₦"#,##0.00';
  dueValueCell.font = { bold: true, size: 10, color: { argb: "FF1E40AF" } };
  dueValueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF6FF" },
  };
  dueValueCell.alignment = { horizontal: "right", vertical: "middle" };
  dueValueCell.border = {
    top: { style: "thin", color: { argb: "FFBFDBFE" } },
    left: { style: "thin", color: { argb: "FFBFDBFE" } },
    bottom: { style: "thin", color: { argb: "FFBFDBFE" } },
    right: { style: "thin", color: { argb: "FFBFDBFE" } },
  };

  currentRow++;

  // Paid (Green)
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const paidLabelCell = worksheet.getCell(`A${currentRow}`);

  paidLabelCell.value = "Paid";
  paidLabelCell.font = { bold: true, size: 10, color: { argb: "FF15803D" } };
  paidLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0FDF4" }, // Light green
  };
  paidLabelCell.alignment = { horizontal: "left", vertical: "middle" };
  paidLabelCell.border = {
    top: { style: "thin", color: { argb: "FFBBF7D0" } },
    left: { style: "thin", color: { argb: "FFBBF7D0" } },
    bottom: { style: "thin", color: { argb: "FFBBF7D0" } },
    right: { style: "thin", color: { argb: "FFBBF7D0" } },
  };

  worksheet.mergeCells(`F${currentRow}:G${currentRow}`);
  const paidValueCell = worksheet.getCell(`F${currentRow}`);

  paidValueCell.value = paid;
  paidValueCell.numFmt = '"₦"#,##0.00';
  paidValueCell.font = { bold: true, size: 10, color: { argb: "FF15803D" } };
  paidValueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0FDF4" },
  };
  paidValueCell.alignment = { horizontal: "right", vertical: "middle" };
  paidValueCell.border = {
    top: { style: "thin", color: { argb: "FFBBF7D0" } },
    left: { style: "thin", color: { argb: "FFBBF7D0" } },
    bottom: { style: "thin", color: { argb: "FFBBF7D0" } },
    right: { style: "thin", color: { argb: "FFBBF7D0" } },
  };

  currentRow++;

  // Outstanding (Orange)
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const remainingLabelCell = worksheet.getCell(`A${currentRow}`);

  remainingLabelCell.value = "Outstanding";
  remainingLabelCell.font = { bold: true, size: 10, color: { argb: "FFC2410C" } };
  remainingLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF7ED" }, // Light orange
  };
  remainingLabelCell.alignment = { horizontal: "left", vertical: "middle" };
  remainingLabelCell.border = {
    top: { style: "thin", color: { argb: "FFFED7AA" } },
    left: { style: "thin", color: { argb: "FFFED7AA" } },
    bottom: { style: "thin", color: { argb: "FFFED7AA" } },
    right: { style: "thin", color: { argb: "FFFED7AA" } },
  };

  worksheet.mergeCells(`F${currentRow}:G${currentRow}`);
  const remainingValueCell = worksheet.getCell(`F${currentRow}`);

  remainingValueCell.value = remaining;
  remainingValueCell.numFmt = '"₦"#,##0.00';
  remainingValueCell.font = { bold: true, size: 10, color: { argb: "FFC2410C" } };
  remainingValueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF7ED" },
  };
  remainingValueCell.alignment = { horizontal: "right", vertical: "middle" };
  remainingValueCell.border = {
    top: { style: "thin", color: { argb: "FFFED7AA" } },
    left: { style: "thin", color: { argb: "FFFED7AA" } },
    bottom: { style: "thin", color: { argb: "FFFED7AA" } },
    right: { style: "thin", color: { argb: "FFFED7AA" } },
  };

  currentRow++;

  // Total Amount (Purple)
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const totalAmountLabelCell = worksheet.getCell(`A${currentRow}`);

  totalAmountLabelCell.value = "Total Amount";
  totalAmountLabelCell.font = { bold: true, size: 10, color: { argb: "FF7C3AED" } };
  totalAmountLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFAF5FF" }, // Light purple
  };
  totalAmountLabelCell.alignment = { horizontal: "left", vertical: "middle" };
  totalAmountLabelCell.border = {
    top: { style: "thin", color: { argb: "FFE9D5FF" } },
    left: { style: "thin", color: { argb: "FFE9D5FF" } },
    bottom: { style: "thin", color: { argb: "FFE9D5FF" } },
    right: { style: "thin", color: { argb: "FFE9D5FF" } },
  };

  worksheet.mergeCells(`F${currentRow}:G${currentRow}`);
  const totalAmountValueCell = worksheet.getCell(`F${currentRow}`);

  totalAmountValueCell.value = existingTotalAmount;
  totalAmountValueCell.numFmt = '"₦"#,##0.00';
  totalAmountValueCell.font = { bold: true, size: 10, color: { argb: "FF7C3AED" } };
  totalAmountValueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFAF5FF" },
  };
  totalAmountValueCell.alignment = { horizontal: "right", vertical: "middle" };
  totalAmountValueCell.border = {
    top: { style: "thin", color: { argb: "FFE9D5FF" } },
    left: { style: "thin", color: { argb: "FFE9D5FF" } },
    bottom: { style: "thin", color: { argb: "FFE9D5FF" } },
    right: { style: "thin", color: { argb: "FFE9D5FF" } },
  };

  currentRow += 3;

  // Payment Instructions
  const paymentHeaderCell = worksheet.getCell(`A${currentRow}`);

  paymentHeaderCell.value = "Payment Instructions";
  paymentHeaderCell.font = { bold: true, size: 11 };

  currentRow++;
  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  const paymentLine1 = worksheet.getCell(`A${currentRow}`);

  paymentLine1.value = `Please make payment to ${firstItem.AccName || "LEADWAY HEALTH LIMITED"} at ${firstItem.BankName || "FIRST BANK OF NIGERIA"
    }, Account No: ${firstItem.BankAcc || "N/A"}.`;
  paymentLine1.font = { size: 9 };
  paymentLine1.alignment = { wrapText: true };

  currentRow++;
  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  const paymentLine2 = worksheet.getCell(`A${currentRow}`);

  paymentLine2.value =
    "Kindly quote the invoice reference number when making payment.";
  paymentLine2.font = { size: 9 };

  currentRow++;
  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  const paymentLine3 = worksheet.getCell(`A${currentRow}`);

  paymentLine3.value =
    "For enquiries, contact us at healthsales@leadway.com";
  paymentLine3.font = { size: 9 };

  currentRow += 3;

  // Footer
  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  const footerCell1 = worksheet.getCell(`A${currentRow}`);

  footerCell1.value =
    "Leadway Health Limited | RC No: 738998 | NHIA Accredited HMO";
  footerCell1.font = { size: 8, color: { argb: "FF666666" } };

  currentRow++;
  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  const footerCell2 = worksheet.getCell(`A${currentRow}`);

  footerCell2.value = "www.leadwayhealth.com | +234 (0) 700 700 5050";
  footerCell2.font = { size: 8, color: { argb: "FF666666" } };

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const fileName = `Invoice_${refNo.replace(/\//g, "_")}.xlsx`;
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
