import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Spinner } from "@heroui/spinner";
import toast from "react-hot-toast";
// import html2canvas from "html2canvas";
// import jsPDF from "jspdf";
import { useNavigate } from "react-router-dom";

import {
  InvoiceReminder,
  getInvoiceReminders,
} from "@/lib/services/invoice-reminders-service";
import { sendInvoiceReminderEmail } from "@/lib/services/invoice-reminder-email";

export default function InvoiceRemindersPage() {
  const [reminders, setReminders] = useState<InvoiceReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF] = useState<number | null>(null);
  const [sendingEmail, setSendingEmail] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      setLoading(true);
      const data = await getInvoiceReminders();

      setReminders(data);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  };

  // const generateInvoicePDF = async (reminder: InvoiceReminder) => {
  //   setGeneratingPDF(reminder.id);

  //   try {
  //     // Parse schemes and premiums
  //     const schemes = reminder.schemes.split("//");
  //     const positivePremiums = reminder.positivePremium.split("//");
  //     const negativePremiums = reminder.NegativePremium.split("//");
  //     const positivePops = reminder.PositivePop.split("//");
  //     const negativePops = reminder.NegativePop.split("//");

  //     // Build table rows
  //     const tableRows = schemes
  //       .map((scheme, index) => {
  //         const posPremium = parseFloat(positivePremiums[index] || "0");
  //         const negPremium = parseFloat(negativePremiums[index] || "0");
  //         const totalPremium = posPremium + negPremium;

  //         // Skip empty schemes
  //         if (!scheme.trim() || totalPremium === 0) return "";

  //         return `
  //           <tr style="${index % 2 === 0 ? "background:#fff;" : "background:#f9fafb;"}">
  //             <td style="padding:8px 12px;border:1px solid #d1d5db;font-size:13px;color:#1f2937;">${scheme}</td>
  //             <td style="padding:8px 12px;border:1px solid #d1d5db;font-size:13px;text-align:right;color:#1f2937;">${formatCurrency(posPremium)}</td>
  //             <td style="padding:8px 12px;border:1px solid #d1d5db;font-size:13px;text-align:right;color:#1f2937;">${formatCurrency(negPremium)}</td>
  //             <td style="padding:8px 12px;border:1px solid #d1d5db;font-size:13px;text-align:center;color:#1f2937;">${positivePops[index] || "0"}</td>
  //             <td style="padding:8px 12px;border:1px solid #d1d5db;font-size:13px;text-align:center;color:#1f2937;">${negativePops[index] || "0"}</td>
  //             <td style="padding:8px 12px;border:1px solid #d1d5db;font-size:13px;font-weight:600;text-align:right;color:#1f2937;">${formatCurrency(totalPremium)}</td>
  //             <td style="padding:8px 12px;border:1px solid #d1d5db;font-size:13px;text-align:center;font-weight:600;color:#1f2937;">${parseInt(positivePops[index] || "0") + parseInt(negativePops[index] || "0")}</td>
  //           </tr>`;
  //       })
  //       .filter(Boolean)
  //       .join("");

  //     // Create hidden container
  //     const container = document.createElement("div");

  //     container.style.cssText =
  //       "position:absolute;left:-9999px;top:0;width:794px;background:#fff;font-family:system-ui,sans-serif;padding:32px;";

  //     container.innerHTML = `
  //       <!-- Header -->
  //       <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
  //         <div><img src="/leadway-logo.png" style="height:56px;" alt="Leadway" /></div>
  //         <div style="text-align:right;font-size:12px;">
  //           <p style="font-weight:700;color:#1f2937;margin:0;">LEADWAY HEALTH LIMITED</p>
  //           <p style="color:#4b5563;margin:2px 0;">121, Funsho Williams Avenue</p>
  //           <p style="color:#4b5563;margin:2px 0;">Iponri, Lagos, Nigeria</p>
  //           <p style="color:#4b5563;margin:2px 0;">healthpartnerships@leadway.com</p>
  //         </div>
  //       </div>

  //       <!-- Banner -->
  //       <div style="background:#C44915;color:#fff;text-align:center;font-weight:700;font-size:16px;padding:12px 0;margin-bottom:20px;">
  //         PAYMENT REMINDER
  //       </div>

  //       <!-- Details Row -->
  //       <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
  //         <div style="width:48%;">
  //           <p style="font-weight:700;color:#1f2937;margin:0 0 4px;">${reminder.GROUP_NAME}</p>
  //           <p style="font-size:12px;color:#4b5563;margin:0;">${reminder.Paddress}</p>
  //         </div>
  //         <div style="width:48%;text-align:right;">
  //           <h2 style="font-size:24px;font-weight:900;color:#C44915;margin:0 0 12px;">INVOICE</h2>
  //           <div style="font-size:12px;">
  //             <div style="margin-bottom:4px;"><span style="color:#6b7280;">Receipt No:</span> <strong>${reminder.receiptnumber}</strong></div>
  //             <div style="margin-bottom:4px;"><span style="color:#6b7280;">Next Due Date:</span> <strong>${formatDate(reminder.nextdue)}</strong></div>
  //             <div style="margin-bottom:4px;"><span style="color:#6b7280;">Frequency:</span> <strong>${reminder.frequency}</strong></div>
  //           </div>
  //           <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;">
  //             <div style="margin-bottom:4px;"><span style="color:#6b7280;">ACCOUNT NAME:</span> <strong>LEADWAY HEALTH LIMITED</strong></div>
  //             <div style="margin-bottom:4px;"><span style="color:#6b7280;">BANK:</span> <strong>FIRST BANK OF NIGERIA</strong></div>
  //             <div><span style="color:#6b7280;">ACCOUNT NO:</span> <strong>2036177455</strong></div>
  //           </div>
  //         </div>
  //       </div>

  //       <!-- Policy Holder -->
  //       <div style="background:#f3f4f6;border-radius:4px;padding:10px 14px;margin-bottom:20px;">
  //         <span style="font-size:11px;color:#6b7280;text-transform:uppercase;">Policy Holder:</span>
  //         <span style="margin-left:8px;font-weight:700;color:#1f2937;">${reminder.GROUP_NAME}</span>
  //       </div>

  //       <!-- Table -->
  //       <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
  //         <thead>
  //           <tr style="background:#C44915;color:#fff;">
  //             <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;border:1px solid #d1d5db;">PLAN TYPE</th>
  //             <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;border:1px solid #d1d5db;">POSITIVE PREMIUM (₦)</th>
  //             <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;border:1px solid #d1d5db;">NEGATIVE PREMIUM (₦)</th>
  //             <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;border:1px solid #d1d5db;">POS. POP.</th>
  //             <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;border:1px solid #d1d5db;">NEG. POP.</th>
  //             <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;border:1px solid #d1d5db;">TOTAL PREMIUM (₦)</th>
  //             <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;border:1px solid #d1d5db;">TOTAL POP.</th>
  //           </tr>
  //         </thead>
  //         <tbody>${tableRows}</tbody>
  //         <tfoot>
  //           <tr style="background:#C44915;color:#fff;font-weight:700;">
  //             <td colspan="5" style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #d1d5db;">NEXT DUE AMOUNT</td>
  //             <td colspan="2" style="padding:10px 12px;font-size:13px;text-align:right;border:1px solid #d1d5db;">${formatCurrency(reminder.nextdueamount)}</td>
  //           </tr>
  //         </tfoot>
  //       </table>

  //       <!-- Payment Instructions -->
  //       <div style="border-left:4px solid #C44915;background:#fff7ed;border-radius:0 4px 4px 0;padding:12px 16px;margin-bottom:20px;">
  //         <p style="font-weight:700;font-size:12px;margin:0 0 6px;">Payment Instructions</p>
  //         <p style="font-size:11px;color:#374151;line-height:1.6;margin:0;">
  //           Please make payment to <strong>LEADWAY HEALTH LIMITED</strong> at <strong>FIRST BANK OF NIGERIA</strong>, Account No: <strong>2036177455</strong>.
  //           Quote reference <strong>${reminder.receiptnumber}</strong>. For enquiries: <strong>healthpartnerships@leadway.com</strong>
  //         </p>
  //       </div>

  //       <!-- Footer -->
  //       <div style="border-top:2px solid #C44915;padding-top:10px;">
  //         <div style="display:flex;justify-content:space-between;font-size:11px;color:#9ca3af;">
  //           <span>Leadway Health Limited | RC No. 738998 | NHIA Accredited HMO</span>
  //           <span>www.leadwayhealth.com | +234 700 700 5050</span>
  //         </div>
  //       </div>
  //     `;

  //     document.body.appendChild(container);

  //     const canvas = await html2canvas(container, {
  //       scale: 3,
  //       useCORS: true,
  //       backgroundColor: "#ffffff",
  //       logging: false,
  //     });

  //     document.body.removeChild(container);

  //     const imgData = canvas.toDataURL("image/png", 1.0);
  //     const pdf = new jsPDF({
  //       orientation: "portrait",
  //       unit: "mm",
  //       format: "a4",
  //       compress: false,
  //     });

  //     const pdfWidth = pdf.internal.pageSize.getWidth();
  //     const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  //     pdf.addImage(
  //       imgData,
  //       "PNG",
  //       0,
  //       0,
  //       pdfWidth,
  //       pdfHeight,
  //       undefined,
  //       "FAST",
  //     );
  //     pdf.save(`Invoice_Reminder_${reminder.receiptnumber}.pdf`);

  //     toast.success("Invoice downloaded successfully!");
  //   } catch (error) {
  //     console.error("PDF Error:", error);
  //     toast.error("Failed to generate PDF");
  //   } finally {
  //     setGeneratingPDF(null);
  //   }
  // };

  const sendReminderEmail = async (reminder: InvoiceReminder) => {
    setSendingEmail(reminder.id);

    try {
      await sendInvoiceReminderEmail(reminder);
    } catch (error) {
      // Error already handled by the service
      console.error("Email send error:", error);
    } finally {
      setSendingEmail(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner color="warning" size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Invoice Reminders
        </h1>
        <p className="text-gray-600">
          View and manage invoice payment reminders
        </p>
      </div>

      {/* Table */}
      {reminders.length > 0 ? (
        <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
          <Table aria-label="Invoice Reminders Table">
            <TableHeader>
              <TableColumn>GROUP NAME</TableColumn>
              <TableColumn>ADDRESS</TableColumn>
              <TableColumn>EMAIL</TableColumn>
              <TableColumn>CONTACT NAME</TableColumn>
              <TableColumn>NEXT DUE DATE</TableColumn>
              <TableColumn>NEXT DUE AMOUNT</TableColumn>
              <TableColumn>FREQUENCY</TableColumn>
              <TableColumn>DATE GENERATED</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {reminders.map((reminder) => (
                <TableRow key={reminder.id}>
                  <TableCell className="font-medium">
                    {reminder.GROUP_NAME}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {reminder.Paddress}
                  </TableCell>
                  <TableCell className="text-sm">{reminder.EmailAdd}</TableCell>
                  <TableCell>{reminder.Contact_name}</TableCell>
                  <TableCell>{formatDate(reminder.nextdue)}</TableCell>
                  <TableCell className="font-semibold text-green-700">
                    {formatCurrency(reminder.nextdueamount)}
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {reminder.frequency}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(reminder.modifieddate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        color="primary"
                        isLoading={generatingPDF === reminder.id}
                        radius="sm"
                        size="sm"
                        variant="flat"
                        onPress={() => navigate("/dashboard/invoice")}
                      >
                        View Invoice
                      </Button>
                      <Button
                        color="success"
                        isLoading={sendingEmail === reminder.id}
                        radius="sm"
                        size="sm"
                        variant="flat"
                        onPress={() => sendReminderEmail(reminder)}
                      >
                        Send Email
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
          <svg
            className="h-16 w-16 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No Reminders Found
          </h3>
          <p className="text-gray-500">
            There are no invoice reminders at the moment
          </p>
        </div>
      )}
    </div>
  );
}
