import { useEffect, useMemo, useState } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import { DatePicker } from "@heroui/date-picker";
import { Input } from "@heroui/input";
import { useDisclosure } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import toast from "react-hot-toast";

import DependantModal, {
  Dependant,
  DependantFormData,
} from "@/components/dependant-modal";
import DependantsTable from "@/components/dependant-table";
import ResultModal, { EnrollmentResult } from "@/components/result-modal";
import {
  addBeneficiaryList,
  BeneficiaryPayload,
  getEnrolleeBioData,
  getFirstAvailableEmail,
  getFirstAvailablePhone,
  EnrolleeBioData,
} from "@/lib/services/enrollment-service";
import {
  City,
  CompanyGroup,
  Gender,
  getCitiesByState,
  getCompanyGroups,
  getGenders,
  getMaritalStatuses,
  getRelationships,
  getSchemesByCompany,
  getStates,
  getTitles,
  MaritalStatus,
  Relationship,
  Scheme,
  State,
  Title,
} from "@/lib/services/lists-service";
import { AddIcon, DeleteIcon, ImageIcon } from "@/components/icons";
import { fileToBase64, getFileExtension } from "@/lib/helpers";
import { sendEnrollmentNotification } from "@/lib/services/email-temples";

export default function EnrollmentPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [dependants, setDependants] = useState<Dependant[]>([]);
  const [dependantsRawData, setDependantsRawData] = useState<
    DependantFormData[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setPrincipalMembershipNo] = useState<string>("");
  const [, setPrincipalCifNumber] = useState<number>(0);

  const [, setEditingDependantId] = useState<number | null>(null);
  const [editingDependant, setEditingDependant] = useState<Dependant | null>(
    null,
  );

  // Dependant-only enrollment mode
  const [isDependantOnlyMode, setIsDependantOnlyMode] = useState(false);
  const [enrolleeId, setEnrolleeId] = useState("");
  const [principalBioData, setPrincipalBioData] =
    useState<EnrolleeBioData | null>(null);
  const [isLoadingBioData, setIsLoadingBioData] = useState(false);

  // Result modal state
  const [showResultModal, setShowResultModal] = useState(false);
  const [enrollmentResult, setEnrollmentResult] =
    useState<EnrollmentResult | null>(null);

  // List values state
  const [cities, setCities] = useState<City[]>([]);
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isLoadingSchemes, setIsLoadingSchemes] = useState(false);
  const [maritalStatuses, setMaritalStatuses] = useState<MaritalStatus[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);

  // Fetch all list values on mount
  useEffect(() => {
    const loadAllListValues = async () => {
      setIsLoadingCompanies(true);
      setIsLoadingLists(true);

      try {
        const [
          companiesRes,
          titlesRes,
          gendersRes,
          maritalRes,
          relationshipsRes,
          statesRes,
        ] = await Promise.all([
          getCompanyGroups(),
          getTitles(),
          getGenders(),
          getMaritalStatuses(),
          getRelationships(),
          getStates(),
        ]);

        if (companiesRes.status === 200 && companiesRes.result) {
          setCompanies(companiesRes.result);
        }

        if (titlesRes.status === 200 && titlesRes.result) {
          setTitles(titlesRes.result);
        }

        if (gendersRes.status === 200 && gendersRes.result) {
          setGenders(gendersRes.result);
        }

        if (maritalRes.status === 200 && maritalRes.result) {
          setMaritalStatuses(maritalRes.result);
        }

        if (relationshipsRes.status === 200 && relationshipsRes.result) {
          setRelationships(relationshipsRes.result);
        }

        if (statesRes.status === 200 && statesRes.result) {
          setStates(statesRes.result);
        }
      } catch (error) {
        throw new Error(
          `Failed to fetch list values: ${(error as Error).message}`,
        );
      } finally {
        setIsLoadingCompanies(false);
        setIsLoadingLists(false);
      }
    };

    loadAllListValues();
  }, []);

  // Main form state
  const [formData, setFormData] = useState({
    address: "",
    city: "",
    company: "",
    dateOfBirth: null as any,
    emailAddress: "",
    firstName: "",
    gender: "",
    maritalStatus: "",
    middleName: "",
    passportImage: null as File | null,
    phoneNumber: "",
    scheme: "",
    staffNo: "",
    startDate: null as any,
    state: "",
    surname: "",
    title: "",
  });

  // Form validation
  const isFormValid = useMemo(() => {
    // In dependant-only mode, we only need enrolleeId and at least one dependant
    if (isDependantOnlyMode) {
      return enrolleeId.trim() !== "" && dependants.length > 0;
    }

    // In normal mode, validate all principal fields (passport is now optional)
    return (
      formData.company &&
      formData.scheme &&
      formData.title &&
      formData.surname &&
      formData.firstName &&
      formData.staffNo &&
      formData.maritalStatus &&
      formData.dateOfBirth &&
      formData.gender &&
      formData.state &&
      formData.city &&
      formData.address &&
      formData.emailAddress &&
      formData.phoneNumber &&
      formData.startDate
      // Removed: && formData.passportImage
    );
  }, [formData, isDependantOnlyMode, enrolleeId, dependants.length]);

  // Fetch principal bio data when enrollee ID is entered
  const handleFetchPrincipalData = async () => {
    if (!enrolleeId.trim()) {
      toast.error("Please enter an Enrollee ID");

      return;
    }

    setIsLoadingBioData(true);
    try {
      const response = await getEnrolleeBioData(enrolleeId);

      if (response.status === 200 && response.result) {
        setPrincipalBioData(response.result);
        setPrincipalMembershipNo(response.result.Member_EnrolleeID);
        setPrincipalCifNumber(response.result.Member_ParentMemberUniqueID);
        toast.success("Principal data loaded successfully!");
      } else {
        toast.error(
          response.ErrorMessage ||
            "Failed to fetch enrollee data. Please check the Enrollee ID.",
        );
      }
    } catch (error) {
      toast.error("Error fetching enrollee data: " + (error as Error).message);
    } finally {
      setIsLoadingBioData(false);
    }
  };

  // Fetch cities when state changes
  useEffect(() => {
    const fetchCities = async () => {
      if (formData.state) {
        setIsLoadingCities(true);
        try {
          const citiesRes = await getCitiesByState(formData.state);

          if (citiesRes.status === 200 && citiesRes.result) {
            setCities(citiesRes.result);
          }
        } catch (error) {
          throw new Error(`Failed to fetch cities: ${error}`);
        } finally {
          setIsLoadingCities(false);
        }
      } else {
        setCities([]);
      }
    };

    fetchCities();
  }, [formData.state]);

  // Fetch schemes when company changes
  useEffect(() => {
    const fetchSchemes = async () => {
      if (formData.company) {
        setIsLoadingSchemes(true);
        try {
          const schemesRes = await getSchemesByCompany(formData.company);

          if (schemesRes.status === 200 && schemesRes.result) {
            setSchemes(schemesRes.result);
          }
        } catch (error) {
          throw new Error(`Failed to fetch schemes:${error}`);
        } finally {
          setIsLoadingSchemes(false);
        }
      } else {
        setSchemes([]);
      }
    };

    fetchSchemes();
  }, [formData.company]);

  const handleAddDependant = (dependantFormData: DependantFormData) => {
    // Get the gender text
    const selectedGender = genders.find(
      (g) => g.Sex_id.toString() === dependantFormData.gender,
    );

    // Get the relationship text
    const selectedRelationship = relationships.find(
      (r) => r.Value === dependantFormData.relationship,
    );

    // Format date as YYYY-MM-DD
    const dateObj = dependantFormData.dateOfBirth;
    const formattedDate = `${dateObj.year}-${String(dateObj.month).padStart(2, "0")}-${String(dateObj.day).padStart(2, "0")}`;

    const newDependant: Dependant = {
      dateOfBirth: formattedDate,
      firstName: dependantFormData.firstName,
      gender: dependantFormData.gender,
      genderText: selectedGender?.Sex || "",
      id: Date.now(),
      image: dependantFormData.passportImage
        ? URL.createObjectURL(dependantFormData.passportImage)
        : null,
      otherName: dependantFormData.otherName,
      email: dependantFormData.email,
      relationship: dependantFormData.relationship,
      relationshipText: selectedRelationship?.Text || "",
      surname: dependantFormData.surname,
      maritalStatus: dependantFormData.maritalStatus,
      phoneNumber: dependantFormData.phoneNumber,
    };

    setDependants([...dependants, newDependant]);
    // Store raw data for API submission
    setDependantsRawData([...dependantsRawData, dependantFormData]);
    onClose();
  };

  // NEW: Handle updating an existing dependant
  const handleUpdateDependant = (
    id: number,
    dependantFormData: DependantFormData,
  ) => {
    const indexToUpdate = dependants.findIndex((dep) => dep.id === id);

    if (indexToUpdate === -1) return;

    // Get the gender text
    const selectedGender = genders.find(
      (g) => g.Sex_id.toString() === dependantFormData.gender,
    );

    // Get the relationship text
    const selectedRelationship = relationships.find(
      (r) => r.Value === dependantFormData.relationship,
    );

    // Format date as YYYY-MM-DD
    const dateObj = dependantFormData.dateOfBirth;
    const formattedDate = `${dateObj.year}-${String(dateObj.month).padStart(2, "0")}-${String(dateObj.day).padStart(2, "0")}`;

    const updatedDependant: Dependant = {
      dateOfBirth: formattedDate,
      firstName: dependantFormData.firstName,
      gender: dependantFormData.gender,
      genderText: selectedGender?.Sex || "",
      id: id,
      image: dependantFormData.passportImage
        ? URL.createObjectURL(dependantFormData.passportImage)
        : dependants[indexToUpdate].image, // Keep existing image if no new one
      otherName: dependantFormData.otherName,
      email: dependantFormData.email,
      relationship: dependantFormData.relationship,
      relationshipText: selectedRelationship?.Text || "",
      surname: dependantFormData.surname,
      maritalStatus: dependantFormData.maritalStatus,
      phoneNumber: dependantFormData.phoneNumber,
    };

    // Update both arrays
    const newDependants = [...dependants];

    newDependants[indexToUpdate] = updatedDependant;
    setDependants(newDependants);

    const newRawData = [...dependantsRawData];

    newRawData[indexToUpdate] = dependantFormData;
    setDependantsRawData(newRawData);

    // Clear edit state
    setEditingDependantId(null);
    setEditingDependant(null);
    onClose();
  };

  const handleEditDependant = (id: number) => {
    const dependant = dependants.find((dep) => dep.id === id);

    if (dependant) {
      setEditingDependantId(id);
      setEditingDependant(dependant);
      onOpen();
    }
  };

  const handleRemoveDependant = (id: number) => {
    const indexToRemove = dependants.findIndex((dep) => dep.id === id);

    setDependants(dependants.filter((dep) => dep.id !== id));

    // Also remove from raw data
    if (indexToRemove !== -1) {
      const newRawData = [...dependantsRawData];

      newRawData.splice(indexToRemove, 1);
      setDependantsRawData(newRawData);
    }
  };

  // NEW: Handle modal close (clears edit state)
  const handleCloseModal = () => {
    setEditingDependantId(null);
    setEditingDependant(null);
    onClose();
  };

  const handleSubmitAll = async () => {
    setIsSubmitting(true);

    try {
      // DEPENDANT-ONLY MODE
      if (isDependantOnlyMode) {
        if (!principalBioData) {
          toast.error("Please fetch principal data first");
          setIsSubmitting(false);

          return;
        }

        // Prepare result object
        const result: EnrollmentResult = {
          success: true,
          dependants: {
            successful: [],
            failed: [],
          },
        };

        // Submit dependants using principal's bio data
        const dependantsPayload: BeneficiaryPayload[] = await Promise.all(
          dependantsRawData.map(async (dep) => {
            const depDateObj = dep.dateOfBirth;
            const depFormattedDOB = depDateObj
              ? `${depDateObj.year}-${String(depDateObj.month).padStart(2, "0")}-${String(depDateObj.day).padStart(2, "0")}`
              : "";

            // Format start date (today)
            const depStartDateObj = dep.startDate;
            const depFormattedStartDate = depStartDateObj
              ? `${depStartDateObj.year}-${String(depStartDateObj.month).padStart(2, "0")}-${String(depStartDateObj.day).padStart(2, "0")}`
              : "";

            // Convert dependant passport image to base64 if exists
            let depEnrolleePicture = "";
            let depEnrolleePictureType = "";

            if (dep.passportImage) {
              depEnrolleePicture = await fileToBase64(dep.passportImage);
              depEnrolleePictureType = getFileExtension(dep.passportImage);
            }

            const cleanedMembershipNo =
              principalBioData.Member_EnrolleeID.replace(/\/\d+$/, "");

            return {
              titleid: 0,
              registrationsource: "Upload App",
              startdate:
                depFormattedStartDate || principalBioData.Member_Effectivedate,
              groupid: principalBioData.Client_GroupID,
              MemberShipNo: cleanedMembershipNo,
              Parent_Cif: principalBioData.Member_ParentMemberUniqueID,
              Cif_number: 0,
              OfflineID: "",
              employeecode: formData.staffNo || "",
              FirstName: dep.firstName,
              Surname: dep.surname,
              othernames: dep.otherName,
              DateOfBirth: depFormattedDOB,
              Sex_ID: dep.gender,
              MaritalStatus: dep.maritalStatus,
              EmailAdress: getFirstAvailableEmail(principalBioData),
              Home_Phone: "",
              Work_Phone: "",
              Mobile: getFirstAvailablePhone(principalBioData),
              Mobile2: "",
              Hospital: "",
              Scheme: principalBioData.Member_Plan,
              schemeid: principalBioData.Member_PlanID,
              regionid: parseInt(principalBioData.Client_StateOfOrigin),
              Postal_Phone: "",
              Physical_Add1: principalBioData.Member_Location,
              Postal_Town_ID: principalBioData.Client_LGAOfOrigin,
              Relationship_ID: dep.relationship,
              BloodGroup: "",
              genotype: "",
              PreExistingCondition: null,
              cadre: "",
              EnrolleePictureType: depEnrolleePictureType,
              EnrolleePicture: depEnrolleePicture,
            };
          }),
        );

        console.log("Submitting dependants only:", dependantsPayload);
        const dependantsResponse = await addBeneficiaryList({
          AddBeneficiary: dependantsPayload,
        });

        console.log("Dependants response:", dependantsResponse);

        // Handle dependants response
        if (dependantsResponse.status === 500) {
          // Error case - check result array
          if (
            dependantsResponse.result &&
            dependantsResponse.result.length > 0
          ) {
            dependantsResponse.result.forEach((r, idx) => {
              if (r.ErrorMessage) {
                result.dependants?.failed.push({
                  name: `${dependantsRawData[idx]?.firstName || "Unknown"} ${dependantsRawData[idx]?.surname || ""}`,
                  error: r.ErrorMessage,
                });
              }
            });
          }

          // Check if all dependants failed
          if (
            result.dependants &&
            result.dependants.failed.length > 0 &&
            result.dependants.successful.length === 0
          ) {
            result.success = false;
            result.error = `Failed to enroll dependants: ${result.dependants.failed[0].error}`;
          }
        } else if (dependantsResponse.status === 200) {
          // Success case - check Enrollee_Numbers array
          if (
            dependantsResponse.Enrollee_Numbers &&
            dependantsResponse.Enrollee_Numbers.length > 0
          ) {
            dependantsResponse.Enrollee_Numbers.forEach((r, idx) => {
              if (r.ErrorMessage) {
                result.dependants?.failed.push({
                  name: `${dependantsRawData[idx]?.firstName || "Unknown"} ${dependantsRawData[idx]?.surname || ""}`,
                  error: r.ErrorMessage,
                });
              } else {
                result.dependants?.successful.push({
                  membershipNo: r.Membershipno || "",
                  enrolleeName: r.EnrolleeName || "",
                  uniqueMembershipNo: r.UniqueMembershipNo || "",
                  suffix: r.suffix || "",
                });
              }
            });
          }
        }

        await sendEnrollmentNotification({
          companyName: principalBioData?.Client_ClientName,
          principal: undefined,
          dependants: (result.dependants?.successful ?? []).map((d) => ({
            enrolleeName: d.enrolleeName,
            memberNumber: d.membershipNo,
          })),
        }).catch(console.error);

        // Show result modal
        setEnrollmentResult(result);
        setShowResultModal(true);

        // Reset form
        if (result.success) {
          setDependants([]);
          setDependantsRawData([]);
          setEnrolleeId("");
          setPrincipalBioData(null);
        }

        setIsSubmitting(false);

        return;
      }

      // NORMAL MODE (Principal + Dependants)
      // Step 1: Format and submit principal (main form)
      const dateObj = formData.dateOfBirth;
      const formattedDOB = dateObj
        ? `${dateObj.year}-${String(dateObj.month).padStart(2, "0")}-${String(dateObj.day).padStart(2, "0")}`
        : "";

      const startDateObj = formData.startDate;
      const formattedStartDate = startDateObj
        ? `${startDateObj.year}-${String(startDateObj.month).padStart(2, "0")}-${String(startDateObj.day).padStart(2, "0")}`
        : "";

      // Get the selected scheme details
      const selectedScheme = schemes.find(
        (s) => s.PlanID.toString() === formData.scheme,
      );

      // Convert passport image to base64 if exists
      let enrolleePicture = "";
      let enrolleePictureType = "";

      if (formData.passportImage) {
        enrolleePicture = await fileToBase64(formData.passportImage);
        enrolleePictureType = getFileExtension(formData.passportImage);
      }

      const principalPayload: BeneficiaryPayload = {
        titleid: formData.title ? parseInt(formData.title) : 0,
        registrationsource: "Upload App",
        startdate: formattedStartDate,
        groupid: formData.company ? parseInt(formData.company) : 0,
        MemberShipNo: "",
        Parent_Cif: 0,
        Cif_number: 0,
        OfflineID: "",
        employeecode: formData.staffNo,
        FirstName: formData.firstName,
        Surname: formData.surname,
        othernames: formData.middleName,
        DateOfBirth: formattedDOB,
        Sex_ID: formData.gender,
        MaritalStatus: formData.maritalStatus,
        EmailAdress: formData.emailAddress,
        Home_Phone: "",
        Work_Phone: "",
        Mobile: formData.phoneNumber,
        Mobile2: "",
        Hospital: "",
        Scheme: selectedScheme?.PlanName || "",
        schemeid: selectedScheme?.PlanID || 0,
        regionid: formData.state ? parseInt(formData.state) : 0,
        Postal_Phone: "",
        Physical_Add1: formData.address,
        Postal_Town_ID: formData.city,
        Relationship_ID: "0", // Principal always has relationship 0
        BloodGroup: "",
        genotype: "",
        PreExistingCondition: null,
        cadre: "",
        EnrolleePictureType: enrolleePictureType,
        EnrolleePicture: enrolleePicture,
      };

      // Submit principal
      console.log("Submitting principal:", principalPayload);
      const principalResponse = await addBeneficiaryList({
        AddBeneficiary: [principalPayload],
      });

      console.log("Principal response:", principalResponse);

      // Check if response has error status
      if (principalResponse.status === 500) {
        // Error case - check result array for error message
        if (principalResponse.result && principalResponse.result.length > 0) {
          const errorMessage = principalResponse.result[0].ErrorMessage;

          setEnrollmentResult({
            success: false,
            error:
              errorMessage || "Failed to submit principal. Please try again.",
          });
          setShowResultModal(true);
        } else {
          setEnrollmentResult({
            success: false,
            error: "Failed to submit principal. Please try again.",
          });
          setShowResultModal(true);
        }
        setIsSubmitting(false);

        return;
      }

      // Success case - check Enrollee_Numbers array
      if (
        principalResponse.status === 200 &&
        principalResponse.Enrollee_Numbers &&
        principalResponse.Enrollee_Numbers.length > 0
      ) {
        const principalResult = principalResponse.Enrollee_Numbers[0];

        // Even with status 200, check if there's an error message in Enrollee_Numbers
        if (principalResult.ErrorMessage) {
          setEnrollmentResult({
            success: false,
            error: principalResult.ErrorMessage,
          });
          setShowResultModal(true);
          setIsSubmitting(false);

          return;
        }

        console.log(principalResult);

        let cifNumber = 0;

        const membershipNo = principalResult.UniqueMembershipNo || "";

        try {
          const bioDataResponse = await getEnrolleeBioData(membershipNo);

          if (bioDataResponse.status === 200 && bioDataResponse.result) {
            cifNumber = bioDataResponse.result.Member_ParentMemberUniqueID;
            console.log("Re-fetched CIF number:", cifNumber);
          } else {
            // Fallback to the value from the submission response
            cifNumber = principalResult.CifNumber || 0;
            console.warn(
              "Could not re-fetch bio data, falling back to submission CIF:",
              cifNumber,
            );
          }
        } catch (bioError) {
          // Fallback to the value from the submission response
          cifNumber = principalResult.CifNumber || 0;
          console.warn(
            "Error re-fetching bio data, falling back to submission CIF:",
            cifNumber,
          );
        }

        // Store the membership number and CIF for dependants

        setPrincipalMembershipNo(membershipNo);
        setPrincipalCifNumber(cifNumber);

        // Prepare result object
        const result: EnrollmentResult = {
          success: true,
          principal: {
            membershipNo: principalResult.Membershipno || "",
            enrolleeName: principalResult.EnrolleeName || "",
            uniqueMembershipNo: principalResult.UniqueMembershipNo || "",
          },
          dependants: {
            successful: [],
            failed: [],
          },
        };

        await sendEnrollmentNotification({
          companyName:
            companies.find((c) => c.GROUP_ID.toString() === formData.company)
              ?.GROUP_NAME ?? "",
          principal: result.principal
            ? {
                enrolleeName: result.principal.enrolleeName,
                memberNumber: result.principal.membershipNo,
              }
            : undefined,
          dependants: (result.dependants?.successful ?? []).map((d) => ({
            enrolleeName: d.enrolleeName,
            memberNumber: d.membershipNo,
          })),
        }).catch(console.error);

        // Step 2: Submit dependants if any exist
        if (dependantsRawData.length > 0) {
          const dependantsPayload: BeneficiaryPayload[] = await Promise.all(
            dependantsRawData.map(async (dep) => {
              const depDateObj = dep.dateOfBirth;
              const depFormattedDOB = depDateObj
                ? `${depDateObj.year}-${String(depDateObj.month).padStart(2, "0")}-${String(depDateObj.day).padStart(2, "0")}`
                : "";

              // Format start date
              const depStartDateObj = dep.startDate;
              const depFormattedStartDate = depStartDateObj
                ? `${depStartDateObj.year}-${String(depStartDateObj.month).padStart(2, "0")}-${String(depStartDateObj.day).padStart(2, "0")}`
                : "";

              // Convert dependant passport image to base64 if exists
              let depEnrolleePicture = "";
              let depEnrolleePictureType = "";

              if (dep.passportImage) {
                depEnrolleePicture = await fileToBase64(dep.passportImage);
                depEnrolleePictureType = getFileExtension(dep.passportImage);
              }

              const cleanedMembershipNo = membershipNo.replace(/\/\d+$/, "");

              return {
                titleid: 0,
                registrationsource: "Upload App",
                startdate: depFormattedStartDate,
                groupid: formData.company ? parseInt(formData.company) : 0,
                MemberShipNo: cleanedMembershipNo, // Use principal's membership number
                Parent_Cif: cifNumber, // Use principal's CIF number
                Cif_number: 0,
                OfflineID: "",
                employeecode: formData.staffNo || "",
                FirstName: dep.firstName,
                Surname: dep.surname,
                othernames: dep.otherName,
                DateOfBirth: depFormattedDOB,
                Sex_ID: dep.gender,
                MaritalStatus: dep.maritalStatus,
                EmailAdress: dep.email,
                Home_Phone: "",
                Work_Phone: "",
                Mobile: "",
                Mobile2: "",
                Hospital: "",
                Scheme: selectedScheme?.PlanName || "",
                schemeid: selectedScheme?.PlanID || 0,
                regionid: formData.state ? parseInt(formData.state) : 0,
                Postal_Phone: "",
                Physical_Add1: formData.address,
                Postal_Town_ID: formData.city,
                Relationship_ID: dep.relationship, // Use actual relationship ID
                BloodGroup: "",
                genotype: "",
                PreExistingCondition: null,
                cadre: "",
                EnrolleePictureType: depEnrolleePictureType,
                EnrolleePicture: depEnrolleePicture,
              };
            }),
          );

          // Submit all dependants
          console.log("Submitting dependants:", dependantsPayload);
          const dependantsResponse = await addBeneficiaryList({
            AddBeneficiary: dependantsPayload,
          });

          console.log("Dependants response:", dependantsResponse);

          // Handle dependants response errors
          if (dependantsResponse.status === 500) {
            // Error case - check result array
            if (
              dependantsResponse.result &&
              dependantsResponse.result.length > 0
            ) {
              dependantsResponse.result.forEach((r, idx) => {
                if (r.ErrorMessage) {
                  result.dependants?.failed.push({
                    name: `${dependantsRawData[idx].firstName} ${dependantsRawData[idx].surname}`,
                    error: r.ErrorMessage,
                  });
                }
              });
            }
          } else if (dependantsResponse.status === 200) {
            // Success case - check Enrollee_Numbers array
            if (
              dependantsResponse.Enrollee_Numbers &&
              dependantsResponse.Enrollee_Numbers.length > 0
            ) {
              dependantsResponse.Enrollee_Numbers.forEach((r, idx) => {
                if (r.ErrorMessage) {
                  result.dependants?.failed.push({
                    name: `${dependantsRawData[idx]?.firstName || "Unknown"} ${dependantsRawData[idx]?.surname || ""}`,
                    error: r.ErrorMessage,
                  });
                } else {
                  result.dependants?.successful.push({
                    membershipNo: r.Membershipno || "",
                    enrolleeName: r.EnrolleeName || "",
                    uniqueMembershipNo: r.UniqueMembershipNo || "",
                    suffix: r.suffix || "",
                  });
                }
              });
            }
          }
        }

        // Show result modal
        setEnrollmentResult(result);
        setShowResultModal(true);

        // Reset form after successful principal submission
        if (result.success) {
          setFormData({
            address: "",
            city: "",
            company: "",
            dateOfBirth: null,
            emailAddress: "",
            firstName: "",
            gender: "",
            maritalStatus: "",
            middleName: "",
            passportImage: null,
            phoneNumber: "",
            scheme: "",
            staffNo: "",
            startDate: null,
            state: "",
            surname: "",
            title: "",
          });
          setDependants([]);
          setDependantsRawData([]);
        }
      } else {
        setEnrollmentResult({
          success: false,
          error: "Failed to submit principal. Please try again.",
        });
        setShowResultModal(true);
      }
    } catch (error) {
      setEnrollmentResult({
        success: false,
        error: (error as Error).message,
      });
      setShowResultModal(true);
      throw new Error(`Submission error: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Enrollment Form
        </h1>
        <p className="text-gray-600">
          Please fill the form below. Passport images are optional.
        </p>
      </div>

      {/* Enrollment Mode Toggle */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 mb-6">
        <Switch
          isSelected={isDependantOnlyMode}
          size="sm"
          onValueChange={(value) => {
            setIsDependantOnlyMode(value);
            // Reset forms when switching modes
            setFormData({
              address: "",
              city: "",
              company: "",
              dateOfBirth: null,
              emailAddress: "",
              firstName: "",
              gender: "",
              maritalStatus: "",
              middleName: "",
              passportImage: null,
              phoneNumber: "",
              scheme: "",
              staffNo: "",
              startDate: null,
              state: "",
              surname: "",
              title: "",
            });
            setDependants([]);
            setDependantsRawData([]);
            setEnrolleeId("");
            setPrincipalBioData(null);
          }}
        >
          <span className="text-lg font-semibold text-gray-800">
            Dependant-Only Enrollment Mode
          </span>
        </Switch>
        <p className="text-sm text-gray-600 mt-2">
          {isDependantOnlyMode
            ? "Enter the principal's Enrollee ID to add dependants only"
            : "Fill in principal details and optionally add dependants"}
        </p>
      </div>

      {/* Dependant-Only Mode: Enrollee ID Input */}
      {isDependantOnlyMode && (
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 md:p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Principal Enrollee Information
          </h2>
          <div className="flex gap-4 items-center">
            <Input
              className="flex-1"
              classNames={{ base: "max-w-sm" }}
              label="Enrollee ID"
              placeholder="Enter principal's Enrollee ID (e.g., 21123456/0)"
              radius="lg"
              value={enrolleeId}
              onChange={(e) => setEnrolleeId(e.target.value)}
            />
            <Button
              className="bg-blue-500 text-white hover:bg-blue-600 font-semibold"
              isLoading={isLoadingBioData}
              radius="lg"
              onPress={handleFetchPrincipalData}
            >
              Fetch Principal Data
            </Button>
          </div>

          {principalBioData && (
            <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-4 text-xl">
                Principal Data Loaded
              </h3>
              <div className="text-sm text-gray-700 space-y-3">
                <p>
                  <strong>Enrollee Name:</strong>{" "}
                  {`${principalBioData.Member_Surname} ${principalBioData.Member_FirstName} ${principalBioData.Member_othernames}`}
                </p>
                <p>
                  <strong>Enrollee ID:</strong>{" "}
                  {principalBioData.Member_EnrolleeID}
                </p>
                <p>
                  <strong>Plan:</strong> {principalBioData.Member_Plan}
                </p>
                <p>
                  <strong>Location:</strong> {principalBioData.Member_Location}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Form Card - Only show in normal mode */}
      {!isDependantOnlyMode && (
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 md:p-8 mb-6">
          {/* Company and Scheme */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Autocomplete
              classNames={{
                base: "w-full",
              }}
              defaultItems={companies}
              isLoading={isLoadingCompanies}
              label="Company"
              placeholder="Search or select company"
              radius="lg"
              selectedKey={formData.company}
              onSelectionChange={(key) =>
                setFormData({
                  ...formData,
                  company: key as string,
                  scheme: "",
                })
              }
            >
              {(company) => (
                <AutocompleteItem key={company.GROUP_ID.toString()}>
                  {company.GROUP_NAME}
                </AutocompleteItem>
              )}
            </Autocomplete>

            <Autocomplete
              classNames={{
                base: "w-full",
              }}
              defaultItems={schemes}
              isDisabled={!formData.company}
              isLoading={isLoadingSchemes}
              label="Scheme"
              placeholder={
                formData.company
                  ? "Search or select scheme"
                  : "Select company first"
              }
              radius="lg"
              selectedKey={formData.scheme}
              onSelectionChange={(key) =>
                setFormData({ ...formData, scheme: key as string })
              }
            >
              {(scheme) => (
                <AutocompleteItem key={scheme.PlanID.toString()}>
                  {scheme.PlanName}
                </AutocompleteItem>
              )}
            </Autocomplete>
          </div>

          {/* Personal Details Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
              Kindly enter your personal details below
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Title */}
              <Select
                isDisabled={isLoadingLists}
                label="Title"
                placeholder="Select title"
                radius="lg"
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              >
                {titles.map(({ title, title_id }) => (
                  <SelectItem key={title_id.toString()}>{title}</SelectItem>
                ))}
              </Select>

              {/* Surname */}
              <Input
                label="Surname"
                placeholder="Enter Surname"
                radius="lg"
                value={formData.surname}
                onChange={(e) =>
                  setFormData({ ...formData, surname: e.target.value })
                }
              />

              {/* Middle Name */}
              <Input
                label="Middle Name"
                placeholder="Enter Middle Name"
                radius="lg"
                value={formData.middleName}
                onChange={(e) =>
                  setFormData({ ...formData, middleName: e.target.value })
                }
              />

              {/* First Name */}
              <Input
                label="First Name"
                placeholder="Enter First Name"
                radius="lg"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
              />

              {/* Staff No */}
              <Input
                label="Staff No."
                placeholder="Enter Staff Number"
                radius="lg"
                value={formData.staffNo}
                onChange={(e) =>
                  setFormData({ ...formData, staffNo: e.target.value })
                }
              />

              {/* Marital Status */}
              <Select
                isDisabled={isLoadingLists}
                label="Marital Status"
                placeholder="Select status"
                radius="lg"
                onChange={(e) =>
                  setFormData({ ...formData, maritalStatus: e.target.value })
                }
              >
                {maritalStatuses.map((status) => (
                  <SelectItem key={status.Marital_statusid.toString()}>
                    {status.MaritalStatus}
                  </SelectItem>
                ))}
              </Select>

              {/* Date of Birth */}
              <DatePicker
                showMonthAndYearPickers
                classNames={{
                  base: "w-full",
                }}
                label="Date of Birth"
                radius="lg"
                value={formData.dateOfBirth}
                onChange={(date) =>
                  setFormData({ ...formData, dateOfBirth: date })
                }
              />

              {/* Start Date */}
              <DatePicker
                showMonthAndYearPickers
                classNames={{
                  base: "w-full",
                }}
                label="Start Date"
                radius="lg"
                value={formData.startDate}
                onChange={(date) =>
                  setFormData({ ...formData, startDate: date })
                }
              />

              {/* Gender */}
              <Select
                isDisabled={isLoadingLists}
                label="Gender"
                placeholder="Select gender"
                radius="lg"
                onChange={(e) =>
                  setFormData({ ...formData, gender: e.target.value })
                }
              >
                {genders.map((gender) => (
                  <SelectItem key={gender.Sex_id.toString()}>
                    {gender.Sex}
                  </SelectItem>
                ))}
              </Select>

              {/* State */}
              <Autocomplete
                classNames={{
                  base: "w-full",
                }}
                defaultItems={states}
                isLoading={isLoadingLists}
                label="State"
                placeholder="Search or select state"
                radius="lg"
                selectedKey={formData.state}
                onSelectionChange={(key) =>
                  setFormData({ ...formData, state: key as string, city: "" })
                }
              >
                {(state) => (
                  <AutocompleteItem key={state.Value}>
                    {state.Text}
                  </AutocompleteItem>
                )}
              </Autocomplete>

              {/* City */}
              <Autocomplete
                classNames={{
                  base: "w-full",
                }}
                defaultItems={cities}
                isDisabled={!formData.state}
                isLoading={isLoadingCities}
                label="City"
                placeholder={
                  formData.state
                    ? "Search or select city"
                    : "Select state first"
                }
                radius="lg"
                selectedKey={formData.city}
                onSelectionChange={(key) =>
                  setFormData({ ...formData, city: key as string })
                }
              >
                {(city) => (
                  <AutocompleteItem key={city.Value}>
                    {city.Text}
                  </AutocompleteItem>
                )}
              </Autocomplete>

              {/* Address */}
              <Input
                label="Address"
                placeholder="Enter Address"
                radius="lg"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />

              {/* Email Address */}
              <Input
                label="Email Address"
                placeholder="Enter Email Address"
                radius="lg"
                type="email"
                value={formData.emailAddress}
                onChange={(e) =>
                  setFormData({ ...formData, emailAddress: e.target.value })
                }
              />

              {/* Phone Number */}
              <Input
                label="Phone Number"
                placeholder="Enter Phone Number"
                radius="lg"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
              />

              {/* Passport Image Upload - UPDATED: Now optional */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-700">
                  Passport Image{" "}
                  <span className="text-gray-500">(Optional)</span>
                </p>
                {formData.passportImage ? (
                  <div className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                    <img
                      alt="Passport preview"
                      className="h-12 w-12 rounded-full object-cover border-2 border-[#F15A24]"
                      src={URL.createObjectURL(formData.passportImage)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {formData.passportImage.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formData.passportImage.type
                          .split("/")[1]
                          .toUpperCase()}{" "}
                        • {(formData.passportImage.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Button
                      isIconOnly
                      className="bg-red-100 text-red-600 hover:bg-red-200"
                      radius="lg"
                      size="sm"
                      variant="flat"
                      onPress={() =>
                        setFormData({ ...formData, passportImage: null })
                      }
                    >
                      <DeleteIcon />
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="border-2 border-dashed border-gray-300 bg-gray-50 hover:border-[#F15A24] h-auto py-4"
                    radius="lg"
                    onPress={() =>
                      document.getElementById("passport-upload")?.click()
                    }
                  >
                    <div className="flex flex-col items-center gap-1">
                      <ImageIcon />
                      <span className="text-sm font-medium text-gray-600">
                        Select Passport Image
                      </span>
                      <span className="text-xs text-gray-500">
                        PNG, JPG up to 5MB
                      </span>
                    </div>
                  </Button>
                )}
                <input
                  accept="image/*"
                  className="hidden"
                  id="passport-upload"
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];

                    if (file) {
                      setFormData({ ...formData, passportImage: file });
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dependants Section */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 md:p-8 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          {isDependantOnlyMode
            ? "Add dependants for the principal"
            : "Kindly add your dependants below"}
        </h2>

        <DependantsTable
          dependants={dependants}
          onEdit={handleEditDependant}
          onRemove={handleRemoveDependant}
        />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4">
          <Button
            className="bg-blue-500 text-white hover:bg-blue-600 font-semibold"
            isDisabled={isDependantOnlyMode && !principalBioData}
            radius="lg"
            startContent={<AddIcon />}
            onPress={onOpen}
          >
            Add New Dependant
          </Button>

          <Button
            className="bg-gradient-to-r from-[#F15A24] to-[#c61531] text-white hover:opacity-90 font-semibold"
            isDisabled={isSubmitting || !isFormValid}
            isLoading={isSubmitting}
            radius="lg"
            onPress={handleSubmitAll}
          >
            {isDependantOnlyMode ? "Submit Dependants" : "Submit All Records"}
          </Button>
        </div>
      </div>

      {/* Add Dependant Modal - UPDATED: with edit support */}
      <DependantModal
        editingDependant={editingDependant}
        genders={genders}
        isLoading={isLoadingLists}
        isOpen={isOpen}
        maritalStatuses={maritalStatuses}
        principalBioData={principalBioData}
        relationships={relationships}
        onAddDependant={handleAddDependant}
        onClose={handleCloseModal}
        onUpdateDependant={handleUpdateDependant}
      />

      {/* Result Modal */}
      <ResultModal
        isOpen={showResultModal}
        result={enrollmentResult}
        onClose={() => setShowResultModal(false)}
      />
    </>
  );
}
