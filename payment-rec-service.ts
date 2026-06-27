import { API_URL, getAuthHeaders } from "../helpers";

export interface InvoiceReceiptHistoryDetail {
  id: number;
  TransactionId: string;
  InputtedBy: string;
  InputtedOn: string;
  ReceiptNumber: string;
  AmountPaid: number;
  NextDue: string;
  IsEvidenceUpload: boolean;
  group_id: number;
  frequency: string;
  totalamount: number;
  ParentAmountPaid: number;
  ParentNextDue: string;
  ParentModifiedDate: string;
}

export interface DeleteReceiptResponse {
  status: number;
  result: {
    Success: number;
    Message: string;
  }[];
}

export interface InvoiceReceiptHistoryDetailsResponse {
  status: number;
  result: InvoiceReceiptHistoryDetail[];
}

export interface InsertPaymentPayload {
  TransactionId: string;
  InputtedBy: string;
  ReceiptNumber: string;
  AmountPaid: number;
  NextDue: string | null;
  IsEvidenceUpload: number;
  GroupId: number;
}

export interface InsertPaymentResponse {
  status: number;
  result: {
    Success: boolean;
    NewId: number;
    Message: string;
    Data?: { Success: number; Message: string; NewId: number }[];
  };
}

export const ALLOWED_DELETE_EMAILS = [
  "k-ezeudu@leadway.com",
  "NobleZeez@admin.com",
];

export const canDeleteReceipts = (email: string): boolean => {
  return ALLOWED_DELETE_EMAILS.map((e) => e.toLowerCase()).includes(
    email.toLowerCase()
  );
};

export const getInvoiceReceiptHistoryDetails = async (
  groupId: number,
  receiptNumber: string,
  transactionId?: string
): Promise<InvoiceReceiptHistoryDetail[]> => {
  try {
    const url = new URL(
      `${API_URL}/InvoiceReceipt/GetInvoiceReceiptHistoryDetails`,
    );

    url.searchParams.append("GroupId", groupId.toString());
    url.searchParams.append("ReceiptNumber", receiptNumber);
    if (transactionId) {
      url.searchParams.append("TransactionId", transactionId);
    }

    const response = await fetch(url.toString(), {
      headers: await getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch payment history: ${response.statusText}`
      );
    }

    const json: InvoiceReceiptHistoryDetailsResponse = await response.json();

    if (json.status === 200 && json.result) {
      return json.result;
    }

    return [];
  } catch (error) {
    throw new Error(
      `Error fetching payment history details: ${(error as Error).message}`
    );
  }
};

export const insertInvoicePayment = async (
  payload: InsertPaymentPayload
): Promise<InsertPaymentResponse> => {
  try {
    const response = await fetch(
      `${API_URL}/InvoiceReceipt/InsertInvoiceReceiptHistoryDetails`,
      {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
      }
    );

    const json: InsertPaymentResponse = await response.json();

    if (!response.ok || !json.result.Success) {
      throw new Error(
        json.result?.Message ||
        `Failed to record payment: ${response.statusText}`
      );
    }

    return json;
  } catch (error) {
    throw error;
  }
};

export const deleteReceiptNumber = async (
  receiptNumber: string
): Promise<DeleteReceiptResponse> => {
  try {
    const response = await fetch(
      `${API_URL}/Pharmacy/deleteReceiptNumber?ReceiptNumber=${encodeURIComponent(receiptNumber)}`,
      {
        method: "GET",
        headers: await getAuthHeaders(),
      }
    );

    const json: DeleteReceiptResponse = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to delete receipt: ${response.statusText}`);
    }

    const result = json.result?.[0];

    if (!result || result.Success !== 1) {
      throw new Error(result?.Message || "Failed to delete receipt number");
    }

    return json;
  } catch (error) {
    throw error;
  }
};
