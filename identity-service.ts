import { updateField } from "../store/group-enrollment";
import { getAuthHeaders, IDENTITY_API } from "../helpers";
import { authStore } from "../store/auth";
import { Principal } from "../store/dependant";
import { groupEnrollmentChunk } from "../store/group-enrollment";

import { AccessTokenResponse, Errors, NINValidationResponse } from "@/types";

const clientId = import.meta.env.VITE_IDENTITY_CLIENT_ID;
const secret = import.meta.env.VITE_IDENTITY_SECRET_KEY;

export const fetchAccessToken = async (): Promise<string> => {
  try {
    const response = await fetch(`${IDENTITY_API}/token`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        clientId,
        secret,
      }),
    });

    if (!response.ok) throw new Error("Failed to fetch access token");
    const data: AccessTokenResponse = await response.json();

    return data.accessToken;
  } catch (error: unknown) {
    throw new Error(
      `Error fetching access token: ${(error as Error).message}`
    );
  }
};

export type PrincipalFormData = Omit<Principal, "photo"> & { photo?: string };

export interface ValidatedNINData {
  firstName: string;
  lastName: string;
  dob: string;
  photo?: string;
  gender: string;
}

export const validateNIN = async <T extends Partial<ValidatedNINData>>(
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setErrors: React.Dispatch<React.SetStateAction<Errors>>,
  nin: string,
  setFormData: React.Dispatch<React.SetStateAction<T>>
): Promise<ValidatedNINData | null> => {
  setLoading(true);
  setErrors((prev) => ({ ...prev, nin: "" }));
  try {
    const token = await fetchAccessToken();
    const response = await fetch(`${IDENTITY_API}/v1/ng/identities/nin/${nin}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data: NINValidationResponse = await response.json();

    authStore.set((prev) => ({
      ...prev,
      ninUser: data,
    }));

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error("Invalid NIN");
      } else if (response.status === 401) {
        throw new Error("Authentication failed");
      } else {
        throw new Error(
          `NIN validation failed: ${data.message || "Unknown error"}`
        );
      }
    }

    if (data.status.status !== "verified") {
      throw new Error(
        `NIN verification failed: ${data.summary.nin_check || data.message || "Unknown error"}`
      );
    }

    const validatedData: ValidatedNINData = {
      firstName: data.nin.firstname || "",
      lastName: data.nin.lastname || "",
      dob: data.nin.birthdate || "",
      photo: data.nin.photo,
      gender: data.nin.gender || "",
    };

    if (data.nin.birthdate) {
      const [day, month, year] = data.nin.birthdate.split("-");
      const formattedDob = `${year}-${month}-${day}`;

      validatedData.dob = formattedDob;
    }

    setFormData((prev) => ({
      ...prev,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      dob: validatedData.dob,
      photo: validatedData.photo,
      gender: validatedData.gender
    }));

    // Update wizardChunk
    const groupUpdates: Record<string, string> = {};

    if (validatedData.dob) groupUpdates.dob = validatedData.dob;
    if (validatedData.firstName) groupUpdates.firstName = validatedData.firstName;
    if (validatedData.lastName) groupUpdates.lastName = validatedData.lastName;
    if (Object.keys(groupUpdates).length > 0) {
      groupEnrollmentChunk.set((prev) => updateField(prev, groupUpdates));
    }

    return validatedData;
  } catch (error: unknown) {
    setErrors((prev) => ({
      ...prev,
      nin: (error as Error).message || "An unexpected error occurred",
    }));

    return null;
  } finally {
    setLoading(false);
  }
};
