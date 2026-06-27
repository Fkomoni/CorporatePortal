import { API_URL, getAuthHeaders } from "../helpers";

import { InvoiceLineItem, InvoiceResponse, InvoiceScheduleItem, InvoiceScheduleResponse } from "@/types";


export const getClientInvoice = async (
  groupId: string | number,
  isNeg?: number
): Promise<InvoiceLineItem[]> => {
  try {
    const response = await fetch(
      `${API_URL}/Pharmacy/GetClientInvoice?GroupId=${groupId}&isneg=${isNeg}`, {
      headers: await getAuthHeaders()
    }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch invoice: ${response.statusText}`);
    }

    const json: InvoiceResponse = await response.json();

    if (json.status !== 200 || !json.result) {
      throw new Error("No invoice data found");
    }

    return json.result;
  } catch (error) {
    throw new Error(
      `Error fetching client invoice: ${(error as Error).message}`
    );
  }
};

export const getClientInvoiceExisting = async (
  groupId: string | number,
  isNeg: number = 0
): Promise<InvoiceLineItem[]> => {
  try {
    const response = await fetch(
      `${API_URL}/Pharmacy/GetClientInvoice?groupid=${groupId}&isneg=${isNeg}`, {
      headers: await getAuthHeaders()
    }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch existing invoice: ${response.statusText}`);
    }

    const json: InvoiceResponse = await response.json();

    if (json.status !== 200 || !json.result) {
      throw new Error("No existing invoice data found");
    }

    return json.result;
  } catch (error) {
    throw new Error(
      `Error fetching existing client invoice: ${(error as Error).message}`
    );
  }
};


export const getClientInvoiceSchedule = async (
  groupId: string | number
): Promise<InvoiceScheduleItem[]> => {
  try {
    const response = await fetch(
      `${API_URL}/Pharmacy/GetClienInvoiceSchedule?GroupId=${groupId}`, {
      headers: await getAuthHeaders()
    }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch invoice schedule: ${response.statusText}`);
    }

    const json: InvoiceScheduleResponse = await response.json();

    if (json.status !== 200 || !json.result) {
      throw new Error("No invoice schedule data found");
    }

    return json.result;
  } catch (error) {
    throw new Error(
      `Error fetching client invoice schedule: ${(error as Error).message}`
    );
  }
};

export const getClientInvoiceScheduleWithDates = async (
  groupId: string | number,
  fromDate: string,
  toDate: string
): Promise<InvoiceScheduleItem[]> => {
  try {
    const response = await fetch(
      `${API_URL}/Pharmacy/GetClienInvoiceSchedule_existing?GroupId=${groupId}&fromdate=${fromDate}&todate=${toDate}`, {
      headers: await getAuthHeaders()
    }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch invoice schedule: ${response.statusText}`);
    }

    const json: InvoiceScheduleResponse = await response.json();

    if (json.status !== 200 || !json.result) {
      throw new Error("No invoice schedule data found");
    }

    return json.result;
  } catch (error) {
    throw new Error(
      `Error fetching client invoice schedule: ${(error as Error).message}`
    );
  }
};
