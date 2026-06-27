import { useChunk } from "stunk/react";

import { groupEnrollmentChunk } from "@/lib/store/group-enrollment";
import GroupPolicyTypeSelect from "@/components/group-enrollment/policy-select";
import GroupStepOne from "@/components/group-enrollment/group-step-one";
import GroupStepTwo from "@/components/group-enrollment/group-step-two";
import GroupStepThree from "@/components/group-enrollment/group-step-three";
import GroupStepFour from "@/components/group-enrollment/group-step-four";
import GroupIdentitySelect from "@/components/group-enrollment/retail/identity-select";
import GroupDownloadPassport from "@/components/group-enrollment/retail/download-passport";
import GroupAddPrincipalAndDependent from "@/components/group-enrollment/retail/add-principal-dependant";
import GroupContactDetails from "@/components/group-enrollment/retail/contact-details";

export default function GroupEnrollmentPage() {
  const [wizard] = useChunk(groupEnrollmentChunk);

  const isCorporate = wizard.data.policyType === "corporate";
  const isRetail = ["indretail", "snrcitizen", "mrcare"].includes(
    wizard.data.policyType,
  );
  const isMultiple = wizard.data.planSelectionType === "multiple";

  // Corporate Flow (5 steps)
  if (isCorporate) {
    return (
      <div>
        {wizard.step === 1 && <GroupPolicyTypeSelect />}
        {wizard.step === 2 && <GroupStepOne />}
        {wizard.step === 3 && <GroupStepTwo />}
        {wizard.step === 4 && <GroupStepThree />}
        {wizard.step === 5 && <GroupStepFour />}
      </div>
    );
  }

  // Retail Flow (6-7 steps)
  if (isRetail) {
    const maxSteps = isMultiple ? 7 : 6;

    return (
      <div>
        {wizard.step === 1 && <GroupPolicyTypeSelect />}
        {wizard.step === 2 && <GroupIdentitySelect />}
        {wizard.step === 3 && <GroupStepTwo />}
        {wizard.step === 4 && <GroupDownloadPassport />}
        {wizard.step === 5 && <GroupContactDetails />}
        {isMultiple && wizard.step === 6 && <GroupAddPrincipalAndDependent />}
        {wizard.step === maxSteps && <GroupStepFour />}
      </div>
    );
  }

  return (
    <div>
      <GroupPolicyTypeSelect />
    </div>
  );
}
