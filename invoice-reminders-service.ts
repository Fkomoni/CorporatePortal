import { API_URL, getAuthHeaders } from "../helpers";

export interface InvoiceReminder {
  GROUP_NAME: string;
  Paddress: string;
  EmailAdd: string;
  ContactEmail: string | null;
  Contact_name: string;
  BankVirtualAccount: string;
  AccountName: string;
  BankName: string;
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
}

export interface InvoiceRemindersResponse {
  status: number;
  result: InvoiceReminder[];
}

export const getInvoiceReminders = async (): Promise<InvoiceReminder[]> => {
  try {
    const response = await fetch(
      `${API_URL}/Pharmacy/GetInvoiceReminders`, {
      headers: await getAuthHeaders()
    }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch invoice reminders: ${response.statusText}`);
    }

    const json: InvoiceRemindersResponse = await response.json();

    if (json.status !== 200 || !json.result) {
      throw new Error("No invoice reminders found");
    }

    return json.result;
  } catch (error) {
    throw new Error(
      `Error fetching invoice reminders: ${(error as Error).message}`
    );
  }
};
