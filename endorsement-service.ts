import { API_URL, getAuthHeaders } from "../helpers";

import { InvoiceLineItem, InvoiceResponse } from "@/types";

export const getClientInvoiceEndorsement = async (
  groupId: string | number,
  fromDate: string,
  toDate: string
): Promise<InvoiceLineItem[]> => {
  try {
    const response = await fetch(
      `${API_URL}/Pharmacy/GetClientInvoice_Existing?GroupId=${groupId}&fromdate=${fromDate}&todate=${toDate}`, {
      headers: await getAuthHeaders()
    }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch endorsement invoice: ${response.statusText}`);
    }

    const json: InvoiceResponse = await response.json();

    if (json.status !== 200 || !json.result) {
      throw new Error("No endorsement invoice data found");
    }

    return json.result;
  } catch (error) {
    throw new Error(
      `Error fetching endorsement invoice: ${(error as Error).message}`
    );
  }
};
