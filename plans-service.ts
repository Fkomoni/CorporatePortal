import { API_URL, getAuthHeaders } from "../helpers";
import { groupEnrollmentChunk } from "../store/group-enrollment";

export type Plan = {
  schemeName: string;
  SchemeID: number;
  SchemeCode: string;
  SchemeStatus: string;
  SchemeMemberTypeCategory: string;
  SchemeDependantAgeLimit: number;
  SchemeMaximumFamilySize: number;
  SchemeCapitationDisabled: boolean;
  BaseAmount: number;
  MemberType: string;
  IsTelemedicine: boolean;
};

export const getPlans = async (): Promise<Plan[]> => {
  const policyType = groupEnrollmentChunk.get().data.policyType
  const isRetail = policyType === "indretail";

  try {
    const response = await fetch(
      `${API_URL}/ListValues/GetPlans?IsRetail=${isRetail}&IsStandardPlan=false`, {
      headers: await getAuthHeaders()
    }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch plans: ${response.statusText}`);
    }

    const json: { result: Plan[] } = await response.json();

    return json.result;
  } catch (error) {
    throw new Error(`Error fetching corporate plans: ${error}`);
  }
};
