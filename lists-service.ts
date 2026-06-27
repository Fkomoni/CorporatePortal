import { API_URL, getAuthHeaders } from "../helpers";

export interface CompanyGroup {
  GROUP_ID: number;
  GROUP_CODE: string;
  GROUP_NAME: string;
  INDUSTRY_ID: number;
  EmailAdd: string;
  Phone1: string;
  Contact_name: string;
  Paddress: string;
  Status_id: number;
  PolicyNumber: string;
  Accepton: string;
  Termdate: string;
}

export interface Gender {
  Sex_id: number;
  Sex: string;
}

export interface MaritalStatus {
  Marital_statusid: number;
  MaritalStatus: string;
}

export interface Relationship {
  Disabled: boolean;
  Group: string | null;
  Selected: boolean;
  Text: string;
  Value: string;
}

export interface Title {
  title_id: number;
  title: string;
}

export interface State {
  Disabled: boolean;
  Group: string | null;
  Selected: boolean;
  Text: string;
  Value: string;
}

export interface City {
  Disabled: boolean;
  Group: string | null;
  Selected: boolean;
  Text: string;
  Value: string;
}

export interface Scheme {
  policynumber: string;
  ClientName: string;
  PlanName: string;
  ExpiryDate: string;
  NoOfPrincipals: number;
  NoOfDependants: number;
  dateIssued: string;
  PlanID: number;
  Group_id: number;
  PrincipalSchemeID: number;
}

export interface ApiResponse<T> {
  status: number;
  result: T;
  ErrorMessage?: string;
}

/**
 * Fetch all company groups from the API
 */
export const getCompanyGroups = async (): Promise<ApiResponse<CompanyGroup[]>> => {
  try {
    const response = await fetch(`${API_URL}/ListValues/GetGroups`, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    const data = await response.json();

    return {
      status: response.status,
      result: data.result || data,
      ErrorMessage: data.ErrorMessage,
    };
  } catch (error) {
    return {
      status: 500,
      result: [],
      ErrorMessage: (error as Error).message || "Failed to fetch company groups",
    };
  }
};

/**
 * Fetch gender options
 */
export const getGenders = async (): Promise<ApiResponse<Gender[]>> => {
  try {
    const response = await fetch(`${API_URL}/ListValues/GetGender`, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    const data = await response.json();

    return {
      status: response.status,
      result: data.result || data,
      ErrorMessage: data.ErrorMessage,
    };
  } catch (error) {
    return {
      status: 500,
      result: [],
      ErrorMessage: (error as Error).message || "Failed to fetch genders",
    };
  }
};

/**
 * Fetch marital status options
 */
export const getMaritalStatuses = async (): Promise<ApiResponse<MaritalStatus[]>> => {
  try {
    const response = await fetch(`${API_URL}/ListValues/GetMaritalStatus`, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    const data = await response.json();

    return {
      status: response.status,
      result: data.result || data,
      ErrorMessage: data.ErrorMessage,
    };
  } catch (error) {
    return {
      status: 500,
      result: [],
      ErrorMessage: (error as Error).message || "Failed to fetch marital statuses",
    };
  }
};

/**
 * Fetch beneficiary relationship options
 */
export const getRelationships = async (): Promise<ApiResponse<Relationship[]>> => {
  try {
    const response = await fetch(`${API_URL}/ListValues/GetBeneficiaryRelationship`, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    const data = await response.json();

    return {
      status: response.status,
      result: data.result || data,
      ErrorMessage: data.ErrorMessage,
    };
  } catch (error) {
    return {
      status: 500,
      result: [],
      ErrorMessage: (error as Error).message || "Failed to fetch relationships",
    };
  }
};

/**
 * Fetch title options
 */
export const getTitles = async (): Promise<ApiResponse<Title[]>> => {
  try {
    const response = await fetch(`${API_URL}/ListValues/GetTitles`, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    const data = await response.json();

    return {
      status: 200,
      result: data.result || data,
      ErrorMessage: data.ErrorMessage,
    };
  } catch (error) {
    return {
      status: 500,
      result: [],
      ErrorMessage: (error as Error).message || "Failed to fetch titles",
    };
  }
};

/**
 * Fetch all states
 */
export const getStates = async (): Promise<ApiResponse<State[]>> => {
  try {
    const response = await fetch(`${API_URL}/ListValues/GetStates`, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    const data = await response.json();

    return {
      status: response.status,
      result: data.result || data,
      ErrorMessage: data.ErrorMessage,
    };
  } catch (error) {
    return {
      status: 500,
      result: [],
      ErrorMessage: (error as Error).message || "Failed to fetch states",
    };
  }
};

/**
 * Fetch cities by state
 */
export const getCitiesByState = async (stateValue: string): Promise<ApiResponse<City[]>> => {
  try {
    const response = await fetch(`${API_URL}/ListValues/GetCitiesByStates?state=${stateValue}`, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    const data = await response.json();

    return {
      status: response.status,
      result: data.result || data,
      ErrorMessage: data.ErrorMessage,
    };
  } catch (error) {
    return {
      status: 500,
      result: [],
      ErrorMessage: (error as Error).message || "Failed to fetch cities",
    };
  }
};

/**
 * Fetch scheme/plan coverage by company group ID
 */
export const getSchemesByCompany = async (groupId: string): Promise<ApiResponse<Scheme[]>> => {
  try {
    const response = await fetch(`${API_URL}/CorporateProfile/ClientPlanCoverageProfile?group_id=${groupId}`, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    const data = await response.json();

    return {
      status: response.status,
      result: data.result || data,
      ErrorMessage: data.ErrorMessage,
    };
  } catch (error) {
    return {
      status: 500,
      result: [],
      ErrorMessage: (error as Error).message || "Failed to fetch schemes",
    };
  }
};
