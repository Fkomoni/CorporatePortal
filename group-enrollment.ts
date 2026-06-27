import { chunk } from "stunk";

export type TPlan = {
  schemeID: number;
  name: string;
  price: number;
  basePrice: number;
  memberType: string;
  ageLimit: number;
  maxFamilySize: number;
  memberTypeCat: string;
  quantity: number;
};

export type IdentityType = "NIN";
// | "snrcitizen" | "mrcare"
export type PolicyType = "corporate" | "indretail" | "";

export interface GroupEnrollmentState {
  step: number;
  data: {
    // Policy Type Selection
    policyType: PolicyType;
    policyTypeLabel: string;
    planSelectionType: "single" | "multiple" | "";

    // Corporate Fields
    companyName: string;
    address: string;
    email: string;
    rcNumber: string;
    tin: string;
    contactName: string;
    contactNo: string;
    contactEmail: string;
    sector: string;
    sectorId: string;

    // Retail Identity Fields
    identityType: IdentityType | "";
    nin: string;
    firstName: string;
    lastName: string;
    dob: string;
    gender: string;

    // Plans
    plans: TPlan[];

    // Documents
    cac: File | null;
    uploadMembers: File | null;
    passport: File | null;
    benefitSchedule: File | null;
  };
}

export const groupEnrollmentChunk = chunk<GroupEnrollmentState>({
  step: 1,
  data: {
    policyType: "",
    policyTypeLabel: "",
    planSelectionType: "",
    companyName: "",
    address: "",
    email: "",
    rcNumber: "",
    tin: "",
    contactName: "",
    contactNo: "",
    contactEmail: "",
    sector: "",
    sectorId: "",
    identityType: "",
    nin: "",
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    plans: [],
    cac: null,
    uploadMembers: null,
    passport: null,
    benefitSchedule: null
  },
});

export const updateField = (
  prev: GroupEnrollmentState,
  updates: Partial<GroupEnrollmentState["data"]>
): GroupEnrollmentState => {
  return {
    ...prev,
    data: { ...prev.data, ...updates },
  };
};

export const nextStep = () => {
  groupEnrollmentChunk.set((prev) => ({
    ...prev,
    step: prev.step + 1,
  }));
};

export const prevStep = () => {
  groupEnrollmentChunk.set((prev) => ({
    ...prev,
    step: prev.step - 1,
  }));
};

export const resetWizard = () => {
  groupEnrollmentChunk.reset();
};
