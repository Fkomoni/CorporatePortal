import { API_URL, getAuthHeaders } from "@/lib/helpers";

export interface TerminationPayload {
  EnrolleeId: string;
  TerminatedBy: string;
  FirstName: string;
  LastName: string;
  TermReason: string;
}

export interface TerminationResult extends TerminationPayload {
  id: string;
  status: "pending" | "success" | "failed";
  errorMessage?: string;
}

export interface TerminationApiItemData {
  Status: "SUCCESS" | "ERROR" | string;
  Message: string;
}

export interface TerminationApiItem {
  Success: boolean;
  EnrolleeId: string;
  Message?: string;
  Data?: TerminationApiItemData[];
}

export interface TerminationApiResponse {
  Success: boolean;
  TotalProcessed: number;
  TotalSuccess: number;
  TotalFailed: number;
  Succeeded: TerminationApiItem[];
  Failed: TerminationApiItem[];
}

export async function terminateUsers(
  payload: TerminationPayload[],
): Promise<{ status: number; result: TerminationApiResponse }> {
  const response = await fetch(`${API_URL}/EnrolleeProfile/TerminateUsers`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  return { status: response.status, result: data.result ?? data };
}
