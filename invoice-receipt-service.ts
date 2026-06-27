import { API_URL, getAuthHeaders } from "../helpers";

export interface InvoiceReceiptHistory {
  Success: number;
  Message: string;
  HasOutstanding?: number;
  TotalAmount: number | null;
  AmountPaid: number | null;
  OutstandingBalance: number | null;
  NextDue: string | null;
  NextDueAmount: number | null;
  Frequency: string | null;
  ExistingDownloaded?: number;
  ReceiptNumber?: string;
  schemes?: string;
  positivePremium?: string;
  NegativePremium?: string;
  originalReceiptNumber?: string;
  PositivePop?: string;
  NegativePop?: string;
  ReceiptCount?: number;
  ReceiptTotalAmount?: number;
}

export interface InvoiceReceiptHistoryResponse {
  status: number;
  result: InvoiceReceiptHistory[];
}

// Main invoice creation payload (used in Generate Invoice)
export interface InsertInvoiceReceiptPayload {
  GroupId: number;
  ReceiptNumber: string;
  DatePaid: string;
  AmountPaid: number;
  TotalAmount: number;
  nextdueamount: number;
  NextDue: string;
  frequency: string;
  schemes: string;
  positivePremium: string;
  NegativePremium: string;
  PositivePop: string;
  NegativePop: string;
}

// PDF download payload (used when downloading PDF)
export interface InsertInvoiceDownloadPayload {
  TransactionId: null;
  InputtedBy: null;
  ReceiptNumber: string;
  AmountPaid: number;
  NextDue: null;
  invoicedamount: number;
  IsEvidenceUpload: boolean;
  GroupId: number;
  totalPremium: number;
  ParentReceiptNumber: string | null;
  ISENDORSED: number;
}

export interface InsertInvoiceReceiptResponse {
  status: number;
  result: {
    Success: boolean;
    Message: string;
    Data?: Array<{
      Success: number;
      Message: string;
      id: number;
      group_id: number;
      receiptnumber: string;
      datepaid: string;
      amountpaid: number;
      totalamount: number;
      nextdue: string;
      createddate: string;
      nextdueamount: number;
      modifieddate: string;
      frequency: string;
      schemes: string;
      positivePremium: string;
      NegativePremium: string;
      PositivePop: string;
      NegativePop: string;
    }>;
    ExistingTotalAmount?: number;
    ExistingAmountPaid?: number;
    OutstandingBalance?: number;
    ExistingReceiptNumber?: string;
    NextDueAmount?: number;
  };
}

export const getInvoiceReceiptHistory = async (
  groupId: string | number
): Promise<InvoiceReceiptHistory | null> => {
  try {
    const response = await fetch(
      `${API_URL}/Pharmacy/GetInvoiceReceiptHistory?groupid=${groupId}`, {
      headers: await getAuthHeaders()
    }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch invoice history: ${response.statusText}`);
    }

    const json: InvoiceReceiptHistoryResponse = await response.json();

    if (json.status === 200 && json.result && json.result.length > 0) {
      return json.result[0];
    }

    return null;
  } catch (error) {
    throw new Error(
      `Error fetching invoice receipt history: ${(error as Error).message}`
    );
  }
};

export const insertInvoiceReceiptHistory = async (
  payload: InsertInvoiceReceiptPayload
): Promise<InsertInvoiceReceiptResponse> => {
  try {
    const response = await fetch(
      `${API_URL}/InvoiceReceipt/InsertInvoiceReceiptHistory`,
      {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
      }
    );

    const json: InsertInvoiceReceiptResponse = await response.json();

    if (!response.ok || !json.result.Success) {
      // Handle 400 - existing unbalanced invoice
      if (response.status === 400 && json.result) {
        throw new Error(
          `${json.result.Message}\nExisting Receipt: ${json.result.ExistingReceiptNumber}\nOutstanding: ₦${json.result.OutstandingBalance?.toLocaleString()}`
        );
      }
      throw new Error(
        json.result?.Message || `Failed to insert invoice: ${response.statusText}`
      );
    }

    return json;
  } catch (error) {
    throw error;
  }
};

// NEW: Insert invoice when downloading PDF (with ParentReceiptNumber)
export const insertInvoiceForDownload = async (
  payload: InsertInvoiceDownloadPayload
): Promise<InsertInvoiceReceiptResponse> => {
  try {
    const response = await fetch(
      `${API_URL}/InvoiceReceipt/InsertInvoiceReceiptHistoryDetails`,
      {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
      }
    );

    const json: InsertInvoiceReceiptResponse = await response.json();

    if (!response.ok || !json.result.Success) {
      throw new Error(
        json.result?.Message || `Failed to insert invoice for download: ${response.statusText}`
      );
    }

    return json;
  } catch (error) {
    throw error;
  }
};
