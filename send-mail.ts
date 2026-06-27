import toast from "react-hot-toast";

import { ApiResponse } from "./create-account";

import { API_URL, fileToBase64, getAuthHeaders } from "@/lib/helpers";
import { authStore } from "@/lib/store/auth";
import { GroupEnrollmentState } from "@/lib/store/group-enrollment";


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

interface CreateAccountData {
  AcceptBy: string;
  CompanyName: string;
  Address: string;
  Email: string;
  RCNumber: string;
  TIN: string;
  ContactName: string;
  ContactNumber: string;
  ContactEmail: string;
  BusinessSector: string;
}

const getEmailTemplate = (
  formData: CreateAccountData,
  result: ApiResponse
): string => {
  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F15A24; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .info-box { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #F15A24; }
          .label { font-weight: bold; color: #666; }
          .value { color: #333; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Corporate Account Created Successfully</h1>
          </div>
          <div class="content">
            <p>Dear ${formData.ContactName},</p>
            <p>Thank you for choosing Leadway Health. Your corporate account has been successfully created.</p>

            <div class="info-box">
              <p><span class="label">Company Name:</span> <span class="value">${formData.CompanyName}</span></p>
              <p><span class="label">Virtual Account Number:</span> <span class="value">${result.VirtualAccount || "N/A"}</span></p>
              <p><span class="label">Group ID:</span> <span class="value">${result.GroupId || "N/A"}</span></p>
            </div>

            <div class="info-box">
              <h3>Contact Information</h3>
              <p><span class="label">Contact Person:</span> <span class="value">${formData.ContactName}</span></p>
              <p><span class="label">Email:</span> <span class="value">${formData.ContactEmail}</span></p>
              <p><span class="label">Phone:</span> <span class="value">${formData.ContactNumber}</span></p>
            </div>

            <p>If you have any questions or need assistance, please don't hesitate to contact us at healthpartnerships@leadway.com</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Leadway Health. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const sendEmailAlert = async (
  formData: CreateAccountData,
  result: ApiResponse,
  data: GroupEnrollmentState["data"]
): Promise<void> => {
  const currentUser = authStore.get();

  try {
    const attachments: Attachment[] = [];

    // Add CAC if uploaded
    if (data.cac) {
      const base64Data = await fileToBase64(data.cac);

      attachments.push({
        FileName: data.cac.name,
        ContentType: data.cac.type || "image/jpeg",
        Base64Data: base64Data,
      });
    }

    // Add Members List if uploaded
    if (data.uploadMembers) {
      const base64Data = await fileToBase64(data.uploadMembers);

      attachments.push({
        FileName: data.uploadMembers.name,
        ContentType:
          data.uploadMembers.type || "application/vnd.ms-excel",
        Base64Data: base64Data,
      });
    }

    const emailPayload: EmailPayload = {
      EmailAddress: formData.Email,
      CC: `healthpartnerships@leadway.com, ${String(currentUser.user?.Email)}, ${formData.ContactEmail}, healthenrol@leadway.com`,
      BCC: "",
      Subject: `ONBOARDING INFORMATION - ${formData.CompanyName}`,
      MessageBody: getEmailTemplate(formData, result),
      Attachments: attachments,
      Category: "",
      UserId: 0,
      ProviderId: 0,
      ServiceId: 0,
      Reference: "",
      TransactionType: "",
    };

    const response = await fetch(`${API_URL}/EnrolleeProfile/SendEmailAlert`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    toast.success("Confirmation email sent successfully");
  } catch (err) {
    toast.error("Failed to send confirmation email");
    console.error("Email error:", err);
    // Don't throw - email failure shouldn't block account creation
  }
};
