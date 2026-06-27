import { API_URL, getAuthHeaders } from "@/lib/helpers";

export interface CreateAccountData {
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

export interface ApiResponse {
  status: number;
  Message?: string;
  VirtualAccount?: string;
  GroupId?: string;
}

export const createAccount = async (
  data: CreateAccountData
): Promise<ApiResponse> => {
  const response = await fetch(`${API_URL}/CRM/CreateCorporateClient`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok || result.status >= 400) {
    throw new Error(result.Message || `HTTP error! Status: ${response.status}`);
  }

  return result;
};
