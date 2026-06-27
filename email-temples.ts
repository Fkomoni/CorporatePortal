// /lib/services/internal-notification-emails.ts
// ─────────────────────────────────────────────
// One file for all 3 internal team notification emails.
// Reuses the same SendEmailAlert endpoint already used across your app.

import { API_URL, getAuthHeaders } from "@/lib/helpers";
import { authStore } from "@/lib/store/auth";

const INTERNAL_EMAIL = "healthenrol@leadway.com";

interface EmailPayload {
  EmailAddress: string;
  CC: string;
  BCC: string;
  Subject: string;
  MessageBody: string;
  Attachments: { FileName: string; ContentType: string; Base64Data: string }[];
  Category: string;
  UserId: number;
  ProviderId: number;
  ServiceId: number;
  Reference: string;
  TransactionType: string;
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  const response = await fetch(`${API_URL}/EnrolleeProfile/SendEmailAlert`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Email send failed: ${response.statusText}`);
}

// ─── Shared HTML ──────────────────────────────────────────────────────────────

const baseStyles = `<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f4f4;color:#333;line-height:1.6}
  .wrapper{padding:24px 16px}
  .container{max-width:640px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#F15A24 0%,#C44915 100%);padding:28px 32px;color:#fff}
  .header h1{font-size:22px;font-weight:700;margin-bottom:4px}
  .header p{font-size:13px;opacity:.9}
  .body{padding:32px}
  .intro{font-size:15px;color:#374151;margin-bottom:24px;line-height:1.7}
  .card{background:#f9fafb;border-left:4px solid #F15A24;border-radius:4px;padding:20px 24px;margin-bottom:24px}
  .row{display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px}
  .row:last-child{border-bottom:none}
  .lbl{font-weight:600;color:#6b7280;min-width:170px;flex-shrink:0}
  .val{color:#111827}
  .pill{display:inline-block;background:#fff7ed;border:1px solid #F15A24;color:#C44915;font-size:12px;font-weight:600;padding:2px 10px;border-radius:99px}
  .note{background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:16px 20px;font-size:13px;color:#92400e;margin-bottom:24px}
  .note strong{display:block;margin-bottom:4px;font-size:14px}
  .footer{background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;font-size:12px;color:#9ca3af}
  .footer strong{color:#6b7280}
</style>`;

const footer = () => `<div class="footer">
  <strong>Leadway Health Limited</strong><br/>
  121, Funsho Williams Avenue, Iponri, Lagos, Nigeria<br/>
  healthenrol@leadway.com &nbsp;|&nbsp; +234 700 700 5050 &nbsp;|&nbsp; www.leadwayhealth.com<br/>
  <span style="margin-top:8px;display:block;">&copy; ${new Date().getFullYear()} Leadway Health Limited. RC No. 738998 | NHIA Accredited HMO</span>
</div>`;


// ════════════════════════════════════════════════════════════════════════════
// 1. ENROLLMENT PAGE
//    After principal + each dependant succeeds, call once per member.
// ════════════════════════════════════════════════════════════════════════════

export interface EnrollmentNotificationParams {
  companyName: string;
  initiatorName?: string;
  principal?: {
    enrolleeName: string;
    memberNumber: string;
  };
  dependants: {
    enrolleeName: string;
    memberNumber: string;
  }[];
}

function enrollmentTemplate(p: EnrollmentNotificationParams): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const principalRow = p.principal ? `
    <tr style="background:#fff7ed;">
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${p.principal.enrolleeName}</td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;"><strong>${p.principal.memberNumber}</strong></td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;"><span class="pill">Principal</span></td>
    </tr>` : "";

  const dependantRows = p.dependants.map(d => `
    <tr>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${d.enrolleeName}</td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;"><strong>${d.memberNumber}</strong></td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">Dependant</td>
    </tr>`).join("");

  const totalCount = (p.principal ? 1 : 0) + p.dependants.length;

  return `<!DOCTYPE html><html><head>${baseStyles}</head><body><div class="wrapper"><div class="container">
  <div class="header">
    <h1>&#x1F195; New Member Registration</h1>
    <p>Awaiting your approval &mdash; ${date}</p>
  </div>
  <div class="body">
    <p class="intro">Dear Team,<br/><br/>
    Please be informed that a registration has been done on the system and requires your approval. Details are below.</p>
    <div class="card">
      <div class="row"><span class="lbl">Company Name</span><span class="val"><strong>${p.companyName}</strong></span></div>
      <div class="row"><span class="lbl">Total Members Enrolled</span><span class="val">${totalCount}</span></div>
      ${p.initiatorName ? `<div class="row"><span class="lbl">Initiated By</span><span class="val">${p.initiatorName}</span></div>` : ""}
      <div class="row"><span class="lbl">Date</span><span class="val">${date}</span></div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#F15A24;color:#fff;">
          <th style="padding:10px 12px;text-align:left;font-size:13px;border:1px solid #e5e7eb;">Name</th>
          <th style="padding:10px 12px;text-align:left;font-size:13px;border:1px solid #e5e7eb;">Member Number</th>
          <th style="padding:10px 12px;text-align:left;font-size:13px;border:1px solid #e5e7eb;">Type</th>
        </tr>
      </thead>
      <tbody>
        ${principalRow}
        ${dependantRows}
      </tbody>
    </table>

    <div class="note"><strong>&#9888; Action Required</strong>
    Please review these registrations on the system and approve or flag any discrepancies as soon as possible.</div>
  </div>
  ${footer()}
</div></div></body></html>`;
}

export async function sendEnrollmentNotification(p: EnrollmentNotificationParams): Promise<void> {
  const { user } = authStore.get();
  const totalCount = (p.principal ? 1 : 0) + p.dependants.length;

  await sendEmail({
    EmailAddress: INTERNAL_EMAIL, CC: "", BCC: "",
    Subject: `NEW REGISTRATION — ${totalCount} member(s) | ${p.companyName}`,
    MessageBody: enrollmentTemplate(p),
    Attachments: [],
    Category: "Enrollment Notification",
    UserId: Number(user?.User_id) || 0,
    ProviderId: 0, ServiceId: 0,
    Reference: p.principal?.memberNumber ?? p.dependants[0]?.memberNumber ?? "",
    TransactionType: "Enrollment",
  });
}


// ════════════════════════════════════════════════════════════════════════════
// 2. BULK UPLOAD PAGE
//    Call once after all rows finish. Attach the results Excel.
// ════════════════════════════════════════════════════════════════════════════

export interface BulkUploadNotificationParams {
  totalCount: number;
  successCount: number;
  failCount: number;
  companyName: string;
  initiatorName?: string;
  excelBase64: string;   // base64 .xlsx — see helper below
  excelFileName: string;
}

function bulkUploadTemplate(p: BulkUploadNotificationParams): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return `<!DOCTYPE html><html><head>${baseStyles}</head><body><div class="wrapper"><div class="container">
  <div class="header"><h1>&#x1F4CB; Bulk Registration Submitted</h1><p>Attached file contains members requiring approval &mdash; ${date}</p></div>
  <div class="body">
    <p class="intro">Dear Team,<br/><br/>
    Please be informed that a bulk registration has been done on the system.
    The attached file is a list of the registrations that require your approval.</p>
    <div class="card">
      <div class="row"><span class="lbl">Company</span><span class="val">${p.companyName}</span></div>
      <div class="row"><span class="lbl">Total Records</span><span class="val">${p.totalCount}</span></div>
      <div class="row"><span class="lbl">Successfully Enrolled</span><span class="val" style="color:#15803d;font-weight:700;">${p.successCount}</span></div>
      <div class="row"><span class="lbl">Failed</span><span class="val" style="color:${p.failCount > 0 ? "#dc2626" : "#15803d"};font-weight:700;">${p.failCount}</span></div>
      ${p.initiatorName ? `<div class="row"><span class="lbl">Initiated By</span><span class="val">${p.initiatorName}</span></div>` : ""}
      <div class="row"><span class="lbl">Date</span><span class="val">${date}</span></div>
    </div>
    <div class="note"><strong>&#9888; Action Required</strong>
    Please review the attached Excel file containing all member numbers and approve the registrations on the system.
    ${p.failCount > 0 ? `<br/><br/>Note: <strong>${p.failCount} record(s)</strong> failed and are highlighted in the attachment.` : ""}
    </div>
  </div>
  ${footer()}
</div></div></body></html>`;
}

/**
 * WHERE TO CALL — bulk-upload-page.tsx → handleSubmitAll()
 * Place right after the for-loop, alongside the existing exportResultsToExcel():
 *
 * // 1. Add this helper to bulk-upload-utils.ts:
 * import * as XLSX from "xlsx";
 * export function rowsToExcelBase64(rows: BulkUploadRow[]): string {
 *   const ws = XLSX.utils.json_to_sheet(rows);
 *   const wb = XLSX.utils.book_new();
 *   XLSX.utils.book_append_sheet(wb, ws, "Results");
 *   return XLSX.write(wb, { bookType: "xlsx", type: "base64" });
 * }
 *
 * // 2. Then in handleSubmitAll after the loop:
 * exportResultsToExcel(updatedRows);
 * const excelBase64 = rowsToExcelBase64(updatedRows);
 * await sendBulkUploadNotification({
 *   totalCount:    uploadedRows.length,
 *   successCount,
 *   failCount,
 *   companyName:   companies.find(c => c.GROUP_ID.toString() === selectedCompany)?.GROUP_NAME ?? selectedCompany,
 *   initiatorName: user.user?.UserName,
 *   excelBase64,
 *   excelFileName: `BulkUpload_${new Date().toISOString().slice(0,10)}.xlsx`,
 * });
 */
export async function sendBulkUploadNotification(p: BulkUploadNotificationParams): Promise<void> {
  const { user } = authStore.get();

  await sendEmail({
    EmailAddress: INTERNAL_EMAIL, CC: "", BCC: "",
    Subject: `BULK REGISTRATION — ${p.companyName} | ${p.successCount}/${p.totalCount} enrolled`,
    MessageBody: bulkUploadTemplate(p),
    Attachments: [{
      FileName: p.excelFileName,
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      Base64Data: p.excelBase64,
    }],
    Category: "Bulk Enrollment Notification",
    UserId: Number(user?.User_id) || 0,
    ProviderId: 0, ServiceId: 0,
    Reference: p.companyName,
    TransactionType: "BulkEnrollment",
  });
}


// ════════════════════════════════════════════════════════════════════════════
// 3. GROUP ENROLLMENT (group-step-four.tsx)
//    Call after createAccount() succeeds.
// ════════════════════════════════════════════════════════════════════════════

export interface GroupEnrollmentNotificationParams {
  companyName: string;
  businessSector: string;
  initiatorName: string;
  groupId: string;
  virtualAccount: string;
  hasBenefitSchedule: boolean;
  benefitScheduleName?: string;
  benefitScheduleBase64?: string;
  benefitScheduleContentType?: string;
  hasStaffList: boolean;
  staffListName?: string;
  staffListBase64?: string;
  staffListContentType?: string;
  hasCac: boolean;
  cacName?: string;
  cacBase64?: string;
  cacContentType?: string;
}

function groupEnrollmentTemplate(p: GroupEnrollmentNotificationParams): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const docRow = (label: string, ok: boolean, name?: string) =>
    `<div class="row"><span class="lbl">${label}</span><span class="val" style="color:${ok ? "#15803d" : "#9ca3af"};">
      ${ok ? `&#10003; ${name ?? "Uploaded"}` : "Not uploaded"}</span></div>`;

  return `<!DOCTYPE html><html><head>${baseStyles}</head><body><div class="wrapper"><div class="container">
  <div class="header"><h1>&#x1F3E2; New Company Account Created</h1><p>Awaiting your approval &mdash; ${date}</p></div>
  <div class="body">
    <p class="intro">Dear Team,<br/><br/>
    Please be informed that a company has been created with the details below for your approval.</p>
    <div class="card">
      <div class="row"><span class="lbl">Company Name</span><span class="val"><strong>${p.companyName}</strong></span></div>
      <div class="row"><span class="lbl">Business Sector</span><span class="val">${p.businessSector || "&mdash;"}</span></div>
      <div class="row"><span class="lbl">Name of Initiator</span><span class="val">${p.initiatorName}</span></div>
      <div class="row"><span class="lbl">Group ID</span><span class="val"><strong>${p.groupId}</strong></span></div>
      <div class="row"><span class="lbl">Virtual Account No.</span><span class="val">${p.virtualAccount}</span></div>
      <div class="row"><span class="lbl">Date Created</span><span class="val">${date}</span></div>
    </div>
    <p style="font-size:14px;font-weight:600;color:#374151;margin-bottom:12px;">Uploaded Documents</p>
    <div class="card">
      ${docRow("Benefit Schedule", p.hasBenefitSchedule, p.benefitScheduleName)}
      ${docRow("Staff List", p.hasStaffList, p.staffListName)}
      ${docRow("CAC Certificate", p.hasCac, p.cacName)}
    </div>
    <div class="note"><strong>&#9888; Action Required</strong>
    Please log in to the system and approve this company account.
    Uploaded documents are attached to this email for reference.</div>
  </div>
  ${footer()}
</div></div></body></html>`;
}

/**
 * WHERE TO CALL — group-step-four.tsx → handleSubmit()
 * Place right after createAccount() succeeds:
 *
 * import { fileToBase64 } from "@/lib/helpers";
 *
 * const cacBase64      = values.data.cac            ? await fileToBase64(values.data.cac)            : undefined;
 * const staffBase64    = values.data.uploadMembers   ? await fileToBase64(values.data.uploadMembers)   : undefined;
 * const scheduleBase64 = values.data.benefitSchedule ? await fileToBase64(values.data.benefitSchedule) : undefined;
 *
 * await sendGroupEnrollmentNotification({
 *   companyName:                values.data.companyName,
 *   businessSector:             values.data.sector,
 *   initiatorName:              user.user?.UserName ?? String(user.user?.User_id),
 *   groupId:                    result.GroupId ?? "",
 *   virtualAccount:             result.VirtualAccount ?? "",
 *   hasBenefitSchedule:         !!values.data.benefitSchedule,
 *   benefitScheduleName:        values.data.benefitSchedule?.name,
 *   benefitScheduleBase64:      scheduleBase64,
 *   benefitScheduleContentType: values.data.benefitSchedule?.type,
 *   hasStaffList:               !!values.data.uploadMembers,
 *   staffListName:              values.data.uploadMembers?.name,
 *   staffListBase64:            staffBase64,
 *   staffListContentType:       values.data.uploadMembers?.type,
 *   hasCac:                     !!values.data.cac,
 *   cacName:                    values.data.cac?.name,
 *   cacBase64,
 *   cacContentType:             values.data.cac?.type,
 * });
 */
export async function sendGroupEnrollmentNotification(p: GroupEnrollmentNotificationParams): Promise<void> {
  const { user } = authStore.get();

  const attachments: EmailPayload["Attachments"] = [];

  if (p.benefitScheduleBase64) attachments.push({ FileName: p.benefitScheduleName ?? "BenefitSchedule", ContentType: p.benefitScheduleContentType ?? "application/octet-stream", Base64Data: p.benefitScheduleBase64 });
  if (p.staffListBase64) attachments.push({ FileName: p.staffListName ?? "StaffList", ContentType: p.staffListContentType ?? "application/octet-stream", Base64Data: p.staffListBase64 });
  if (p.cacBase64) attachments.push({ FileName: p.cacName ?? "CAC_Certificate", ContentType: p.cacContentType ?? "application/octet-stream", Base64Data: p.cacBase64 });

  await sendEmail({
    EmailAddress: INTERNAL_EMAIL, CC: "", BCC: "",
    Subject: `NEW COMPANY ACCOUNT — ${p.companyName} | Group ID: ${p.groupId}`,
    MessageBody: groupEnrollmentTemplate(p),
    Attachments: attachments,
    Category: "Group Enrollment Notification",
    UserId: Number(user?.User_id) || 0,
    ProviderId: 0, ServiceId: 0,
    Reference: p.groupId,
    TransactionType: "GroupEnrollment",
  });
}
