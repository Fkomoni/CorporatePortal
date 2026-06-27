
import toast from "react-hot-toast";
import { chunk } from "stunk";
import { withPersistence } from "stunk/middleware";

import { authStore } from "../store/auth";
import { API_URL, getAuthHeaders } from "../helpers";

import { BaseForm, LoginResponse } from "@/types";


type ApiTokenState = {
  token: string | null;
  expires: string | null;
};

/**
 * Authenticates a user with email and password.
 * @param formData - Object containing email and password.
 * @returns A promise resolving to the login response, including error details if the API returns an error.
 */
export const loginLeadway = async (
  formData: BaseForm
): Promise<LoginResponse> => {
  try {
    authStore.set((state) => ({
      ...state,
      isLoading: true,
    }));

    const apiUrl = `${API_URL}/Account/ExternalPortalLogin`;

    const apiPayload = {
      email: formData.email,
      password: formData.password,
      LogInSource: "PharmacyApp",
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(apiPayload),
    });

    const data = (await response.json()) as LoginResponse;

    const standardizedResponse: LoginResponse = {
      status: response.status,
      result: data.result || null,
      ErrorMessage:
        data.ErrorMessage ||
        `Login failed: ${response.status} ${response.statusText}`,
    };

    authStore.set((state) => ({
      ...state,
      isLoading: false,
      user: data.result && data.result[0] ? data.result[0] : null,
    }));

    if (!response.ok) {
      return standardizedResponse;
    }

    if (data.result && data.result[0]) {
      toast.success("Login successfully");
    }

    return standardizedResponse;
  } catch (error) {
    const err = error as Error;

    authStore.set((state) => ({
      ...state,
      isLoading: false,
    }));

    toast.error(err.message);

    return {
      status: 0,
      result: null,
      ErrorMessage: "Failed to connect to the server",
    };
  }
};

export const loginProvider = async (
  formData: BaseForm
): Promise<LoginResponse> => {
  try {
    authStore.set((state) => ({
      ...state,
      isLoading: true,
    }));

    const apiUrl = `${API_URL}/ProviderNetwork/ProviderLogIn`;

    const apiPayload = {
      Email: formData.email,
      Password: formData.password,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(apiPayload),
    });

    const data = (await response.json()) as LoginResponse;

    const standardizedResponse: LoginResponse = {
      status: response.status,
      result: data.result || null,
      ErrorMessage:
        data.ErrorMessage ||
        `Login failed: ${response.status} ${response.statusText}`,
    };

    authStore.set((state) => ({
      ...state,
      isLoading: false,
      user: data.result && data.result[0] ? data.result[0] : null,
    }));

    if (!response.ok) {
      return standardizedResponse;
    }

    if (data.result && data.result[0]) {
      toast.success("Login successfully");
    }

    return standardizedResponse;
  } catch (error) {
    const err = error as Error;

    authStore.set((state) => ({
      ...state,
      isLoading: false,
    }));

    toast.error(err.message);

    return {
      status: 0,
      result: null,
      ErrorMessage: "Failed to connect to the server",
    };
  }
};

export const apiTokenStore = withPersistence(chunk<ApiTokenState>({
  token: null,
  expires: null,
}), { key: "data_token" });
