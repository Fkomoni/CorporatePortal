import toast from "react-hot-toast";

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

interface PaymentEmailData {
  transactionId: string;
  receiptNumber: string;
  amountPaid: number;
  groupId: number;
  companyName: string;
  evidenceFile?: File | null;
  evidenceBase64?: string;
}

const getPaymentEmailTemplate = (data: PaymentEmailData): string => {
  return `
    <html>
      <head>
        <style>
          body { font-family: Inter, sans-serif; line-height: 1.6; color: #242424; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F15A24; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .info-box { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #F15A24; }
          .label { font-weight: bold; color: #666; }
          .value { color: #333; }
          .amount { font-size: 24px; color: #F15A24; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Recorded Successfully</h1>
          </div>
          <div class="content">
            <p>Dear Team,</p>
            <p>A new payment has been recorded for <strong>${data.companyName}</strong>.</p>

            <div class="info-box">
              <p><span class="label">Receipt Number:</span> <span class="value">${data.receiptNumber}</span></p>
              <p><span class="label">Transaction ID:</span> <span class="value">${data.transactionId}</span></p>
              <p><span class="label">Group ID:</span> <span class="value">${data.groupId}</span></p>
            </div>

            <div class="info-box">
              <p><span class="label">Amount Paid:</span></p>
              <p class="amount">₦${data.amountPaid.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}</p>
            </div>

            <div class="info-box">
              <p><span class="label">Payment Evidence:</span> <span class="value">${data.evidenceFile ? "Attached" : "Not provided"
    }</span></p>
              <p><span class="label">Date Recorded:</span> <span class="value">${new Date().toLocaleString()}</span></p>
            </div>

            <p>Please review the payment details and update the records accordingly.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Leadway Health. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const sendPaymentEmail = async (
  data: PaymentEmailData
): Promise<void> => {
  const currentUser = authStore.get();

  try {
    const attachments: Attachment[] = [];

    // Add evidence file if provided
    if (data.evidenceFile && data.evidenceBase64) {
      attachments.push({
        FileName: data.evidenceFile.name,
        ContentType: data.evidenceFile.type,
        Base64Data: data.evidenceBase64,
      });
    }

    const emailPayload: EmailPayload = {
      EmailAddress: "Healthsales@leadway.com",
      CC: "Healthpartnership@leadway.com",
      BCC: "Healthfinance@leadway.com",
      Subject: `PAYMENT RECORDED - ${data.receiptNumber} - ${data.companyName}`,
      MessageBody: getPaymentEmailTemplate(data),
      Attachments: attachments,
      Category: "Payment",
      UserId: Number(currentUser.user?.User_id) || 0,
      ProviderId: 0,
      ServiceId: 0,
      Reference: data.receiptNumber,
      TransactionType: "Payment",
    };

    const response = await fetch(`${API_URL}/EnrolleeProfile/SendEmailAlert`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    toast.success("Payment confirmation email sent");
  } catch (err) {
    toast.error("Failed to send payment email");
    console.error("Email error:", err);
    // Don't throw - email failure shouldn't block payment recording
  }
};
