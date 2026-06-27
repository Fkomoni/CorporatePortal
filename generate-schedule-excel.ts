import * as XLSX from "xlsx";

import { InvoiceScheduleItem } from "@/types";

export async function generateScheduleExcel(
  scheduleData: InvoiceScheduleItem[],
): Promise<void> {
  if (!scheduleData || scheduleData.length === 0) {
    throw new Error("No schedule data provided");
  }

  await new Promise((resolve) => setTimeout(resolve, 50));

  const rows = scheduleData.map((item, index) => ({
    "S/N": index + 1,
    "Enrollee ID": item.Member_EnrolleeID,
    "Customer Name": item.Member_CustomerName,
    "Member Type": item.Member_Membertype,
    "Gender": item.Member_Gender,
    "Relationship": item.Member_Relationship.trim(),
    "Plan": item.Member_Plan,
    "Status": item.MemberStatus,
    "Start Date": new Date(item.ContractStarteddate).toLocaleDateString("en-GB"),
    "End Date": new Date(item.ContractEndDate).toLocaleDateString("en-GB"),
    "Date Captured": new Date(item.Member_DateCaptured).toLocaleDateString("en-GB"),
    "Premium Fees (NGN)": item.IndividualPremiumFees,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Schedule");
  XLSX.writeFile(wb, `Invoice_Schedule_${Math.floor(new Date().getSeconds())}.xlsx`, { compression: false });
}
