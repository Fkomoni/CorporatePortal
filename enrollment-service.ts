import { API_URL, getAuthHeaders } from "../helpers";

export interface BeneficiaryPayload {
  titleid: number;
  registrationsource: string;
  startdate: string;
  groupid: number;
  MemberShipNo: string;
  Parent_Cif: number;
  Cif_number: number;
  OfflineID: string;
  FirstName: string;
  Surname: string;
  othernames: string;
  DateOfBirth: string;
  Sex_ID: string;
  MaritalStatus: string;
  EmailAdress: string;
  Home_Phone: string;
  Work_Phone: string;
  Mobile: string;
  Mobile2: string;
  Hospital: string;
  Scheme: string;
  schemeid: number;
  regionid: number;
  Postal_Phone: string;
  Physical_Add1: string;
  Postal_Town_ID: string;
  Relationship_ID: string;
  BloodGroup: string;
  genotype: string;
  PreExistingCondition: string | null;
  cadre: string;
  EnrolleePictureType: string;
  EnrolleePicture: string;
  employeecode: string;
}

export interface AddBeneficiaryRequest {
  AddBeneficiary: BeneficiaryPayload[];
}

export interface AddBeneficiaryResponseItem {
  Membershipno: string | null;
  suffix: string | null;
  staffcode: string | null;
  ErrorMessage: string | null;
  UniqueMembershipNo: string | null;
  EnrolleeName: string | null;
  CifNumber: number;
}

export interface AddBeneficiaryResponse {
  status: number;
  result: AddBeneficiaryResponseItem[];
  Enrollee_Numbers: AddBeneficiaryResponseItem[];
}

export interface EnrolleeBioData {
  Client_GroupID: number;
  Member_PlanID: number;
  Member_Plan: string;
  Member_ParentMemberUniqueID: number;
  Client_StateOfOrigin: string;
  Client_LGAOfOrigin: string;
  Member_Effectivedate: string;
  Member_Phone_One: string;
  Member_Phone_Two: string;
  Member_Phone_Three: string;
  Member_Phone_Four: string;
  Member_Location: string;
  Member_EmailAddress_One: string;
  Member_EmailAddress_Two: string;
  Member_CIF: number;
  Member_EnrolleeID: string;
  Member_FirstName: string;
  Member_Surname: string;
  Member_othernames: string;
  Client_ClientName: string;
}

export interface EnrolleeBioDataResponse {
  status: number;
  result: EnrolleeBioData | null;
  ErrorMessage?: string;
}

/**
 * Add beneficiary (principal or dependants) to the system
 *
 * Response structure varies based on success/failure:
 *
 * SUCCESS (status: 200):
 * {
 *   status: 200,
 *   result: [],
 *   Enrollee_Numbers: [{ Membershipno, CifNumber, EnrolleeName, ... }]
 * }
 *
 * ERROR (status: 500):
 * {
 *   status: 500,
 *   result: [{ ErrorMessage: "error details", ... }],
 *   Enrollee_Numbers: []
 * }
 */
export const addBeneficiaryList = async (
  payload: AddBeneficiaryRequest
): Promise<AddBeneficiaryResponse> => {
  try {
    const response = await fetch(`${API_URL}/EnrolleeProfile/AddBeneficiaryList`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    return {
      status: data.status || response.status,
      result: data.result || [],
      Enrollee_Numbers: data.Enrollee_Numbers || [],
    };
  } catch (error) {
    throw new Error(
      `Failed to add beneficiary: ${(error as Error).message}`
    );
  }
};

/**
 * Get enrollee bio data by enrollee ID
 */
export const getEnrolleeBioData = async (
  enrolleeId: string
): Promise<EnrolleeBioDataResponse> => {
  try {
    const response = await fetch(
      `${API_URL}/EnrolleeProfile/GetEnrolleeBioDataByDetails?enrolleeid=${enrolleeId}`,
      {
        method: "GET",
        headers: await getAuthHeaders(),
      }
    );

    const data = await response.json();

    // The API returns an array, we need to get the first item
    const bioData = Array.isArray(data) ? data[0] : (data.result?.[0] || data[0] || null);

    return {
      status: response.status,
      result: bioData,
      ErrorMessage: data.ErrorMessage || (!bioData ? "No data found for this enrollee ID" : undefined),
    };
  } catch (error) {
    return {
      status: 500,
      result: null,
      ErrorMessage: (error as Error).message || "Failed to fetch enrollee bio data",
    };
  }
};

/**
 * Extract the first non-empty phone number from enrollee bio data
 */
export const getFirstAvailablePhone = (bioData: EnrolleeBioData): string => {
  const phones = [
    bioData.Member_Phone_One,
    bioData.Member_Phone_Two,
    bioData.Member_Phone_Three,
    bioData.Member_Phone_Four,
  ];

  return phones.find((phone) => phone && phone.trim() !== "") || "";
};

/**
 * Extract the first non-empty email from enrollee bio data
 */
export const getFirstAvailableEmail = (bioData: EnrolleeBioData): string => {
  const emails = [
    bioData.Member_EmailAddress_One,
    bioData.Member_EmailAddress_Two,
  ];

  return emails.find((email) => email && email.trim() !== "") || "";
};
