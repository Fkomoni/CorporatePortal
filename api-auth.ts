import { API_URL, getAuthHeaders } from "../helpers";

import { apiTokenStore } from "./auth-service";


const API_CREDENTIALS = {
  Username: "oshoala.opeyemi@gmail.com",
  Password: "Password@123",
};

/**
 * Fetches and caches the API-level token required for all service calls.
 * Skips fetching if a valid non-expired token already exists.
 */
export const getApiToken = async (): Promise<string | null> => {
  const { token, expires } = apiTokenStore.get();

  // Return cached token if still valid
  if (token && expires && new Date(expires) > new Date()) {
    return token;
  }

  try {
    const response = await fetch(`${API_URL}/ApiUsers/Login`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(API_CREDENTIALS),
    });

    if (!response.ok) {
      console.error("API pre-auth failed:", response.statusText);

      return null;
    }

    const data = await response.json();

    if (data.status === "success" && data.token) {
      apiTokenStore.set((state) => ({
        ...state,
        token: data.token,
        expires: data.expires,
      }));

      return data.token;
    }

    return null;
  } catch (error) {
    console.error("API pre-auth error:", error);

    return null;
  }
};
