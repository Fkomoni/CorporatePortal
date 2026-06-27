import toast from "react-hot-toast";

import { InvoiceReminder } from "./invoice-reminders-service";

import { API_URL, getAuthHeaders } from "@/lib/helpers";
import { authStore } from "@/lib/store/auth";


interface Attachment {
  FileName: string;
  ContentType: string;
  Base64Data: string;
}

interface EmailPayload {
  EmailAddress: string;
  CC: string;
  BCC: string;
  Subject: string;
  MessageBody: string;
  Attachments: Attachment[];
  Category: string;
  UserId: number;
  ProviderId: number;
  ServiceId: number;
  Reference: string;
  TransactionType: string;
}

const getInvoiceReminderTemplate = (reminder: InvoiceReminder): string => {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // Parse schemes and premiums
  const schemes = reminder.schemes.split("//");
  const positivePremiums = reminder.positivePremium.split("//");
  const positivePops = reminder.PositivePop.split("//");

  // Build plan rows (only show plans with positive premium)
  const planRows = schemes
    .map((scheme, index) => {
      const premium = parseFloat(positivePremiums[index] || "0");

      if (!scheme.trim() || premium === 0) return "";

      return `
        <tr>
          <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">${scheme}</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">₦${formatCurrency(premium)}</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${positivePops[index] || "0"}</td>
        </tr>
      `;
    })
    .filter(Boolean)
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 700px;
            margin: 20px auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #F15A24 0%, #C44915 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 600;
          }
          .header p {
            margin: 8px 0 0;
            font-size: 14px;
            opacity: 0.95;
          }
          .content {
            padding: 30px;
          }
          .greeting {
            font-size: 16px;
            margin-bottom: 20px;
          }
          .info-card {
            background-color: #f9fafb;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #F15A24;
            border-radius: 4px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: 600;
            color: #6b7280;
            font-size: 14px;
          }
          .value {
            color: #1f2937;
            font-weight: 500;
            font-size: 14px;
          }
          .amount-highlight {
            background: linear-gradient(135deg, #fee2e2 0%, #fef3c7 100%);
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            text-align: center;
            border: 2px solid #F15A24;
          }
          .amount-label {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 8px;
            font-weight: 500;
          }
          .amount {
            font-size: 32px;
            color: #F15A24;
            font-weight: 700;
            margin: 0;
          }
          .due-date {
            font-size: 14px;
            color: #dc2626;
            margin-top: 8px;
            font-weight: 600;
          }
          .plan-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .plan-table th {
            background-color: #F15A24;
            color: white;
            padding: 12px 10px;
            text-align: left;
            font-size: 13px;
            font-weight: 600;
          }
          .plan-table td {
            padding: 10px;
            border: 1px solid #e5e7eb;
            font-size: 13px;
          }
          .plan-table tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .payment-box {
            background-color: #fffbeb;
            border: 2px solid #fbbf24;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .payment-box h3 {
            color: #92400e;
            margin: 0 0 12px;
            font-size: 16px;
          }
          .payment-box p {
            margin: 8px 0;
            color: #78350f;
            font-size: 14px;
          }
          .bank-details {
            background-color: white;
            padding: 15px;
            border-radius: 6px;
            margin-top: 12px;
          }
          .bank-details p {
            margin: 6px 0;
            color: #1f2937;
          }
          .footer {
            background-color: #f9fafb;
            text-align: center;
            padding: 25px;
            color: #6b7280;
            font-size: 13px;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
          }
          .contact-info {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Payment Reminder</h1>
            <p>Invoice Due for ${reminder.GROUP_NAME}</p>
          </div>

          <div class="content">
            <div class="greeting">
              <p>Dear <strong>${reminder.Contact_name}</strong>,</p>
              <p>This is a friendly reminder that your payment for <strong>${reminder.frequency}</strong> health insurance coverage is due.</p>
            </div>

            <div class="info-card">
              <div class="info-row">
                <span class="label">Company Name:</span>
                <span class="value">${reminder.GROUP_NAME}</span>
              </div>
              <div class="info-row">
                <span class="label">Receipt Number:</span>
                <span class="value">${reminder.receiptnumber}</span>
              </div>
              <div class="info-row">
                <span class="label">Payment Frequency:</span>
                <span class="value">${reminder.frequency}</span>
              </div>
            </div>

            <div class="amount-highlight">
              <div class="amount-label">AMOUNT DUE</div>
              <p class="amount">₦${formatCurrency(reminder.nextdueamount)}</p>
              <div class="due-date">Due Date: ${formatDate(reminder.nextdue)}</div>
            </div>

            <h3 style="color: #1f2937; margin: 30px 0 15px;">Coverage Summary</h3>
            <table class="plan-table">
              <thead>
                <tr>
                  <th>Plan Name</th>
                  <th style="text-align: right;">Premium (₦)</th>
                  <th style="text-align: center;">Lives Covered</th>
                </tr>
              </thead>
              <tbody>
                ${planRows}
              </tbody>
            </table>

            <div class="payment-box">
              <h3>💳 Payment Instructions</h3>
              <p>Please make payment to:</p>
              <div class="bank-details">
                <p><strong>Account Name:</strong> ${reminder.AccountName}</p>
                <p><strong>Bank:</strong> ${reminder.BankName}</p>
                <p><strong>Account Number:</strong> ${reminder.BankVirtualAccount}</p>
                <p><strong>Reference:</strong> ${reminder.receiptnumber}</p>
              </div>
              <p style="margin-top: 12px;"><strong>Important:</strong> Please quote the receipt number <strong>${reminder.receiptnumber}</strong> as your payment reference.</p>
            </div>

            <p style="margin-top: 30px; color: #4b5563;">If you have already made this payment, please disregard this reminder. For any questions or concerns, feel free to contact us.</p>
          </div>

          <div class="footer">
            <p><strong>Leadway Health Limited</strong></p>
            <p>121, Funsho Williams Avenue, Iponri, Lagos, Nigeria</p>
            <div class="contact-info">
              <p>📧 Email: <strong>healthpartnerships@leadway.com</strong></p>
              <p>📞 Phone: <strong>+234 700 700 5050</strong></p>
              <p>🌐 Website: <strong>www.leadwayhealth.com</strong></p>
            </div>
            <p style="margin-top: 15px; font-size: 12px;">© ${new Date().getFullYear()} Leadway Health Limited. RC No. 738998 | NHIA Accredited HMO</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const sendInvoiceReminderEmail = async (
  reminder: InvoiceReminder
): Promise<void> => {
  const currentUser = authStore.get();

  try {
    const emailPayload: EmailPayload = {
      EmailAddress: reminder.EmailAdd,
      CC: reminder.ContactEmail || "healthpartnerships@leadway.com",
      BCC: "healthfinance@leadway.com",
      Subject: `PAYMENT REMINDER - ${reminder.receiptnumber} - ${reminder.GROUP_NAME}`,
      MessageBody: getInvoiceReminderTemplate(reminder),
      Attachments: [],
      Category: "Invoice Reminder",
      UserId: Number(currentUser.user?.User_id) || 0,
      ProviderId: 0,
      ServiceId: 0,
      Reference: reminder.receiptnumber,
      TransactionType: "Reminder",
    };

    const response = await fetch(`${API_URL}/EnrolleeProfile/SendEmailAlert`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    toast.success(`Reminder email sent to ${reminder.EmailAdd}`);
  } catch (err) {
    toast.error("Failed to send reminder email");
    console.error("Email error:", err);
    throw err;
  }
};
