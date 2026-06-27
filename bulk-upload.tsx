import { useEffect, useState } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import { useDisclosure } from "@heroui/modal";
import toast from "react-hot-toast";

import EditRowModal from "@/components/bulk-upload/edit-row-modal";
import BulkUploadTable from "@/components/bulk-upload/bulk-upload-table";
import SchemeTable from "@/components/bulk-upload/scheme-table";
import ClearDataModal from "@/components/bulk-upload/clear-data-modal";
import {
  BulkUploadRow,
  downloadBulkUploadTemplate,
  parseExcelFile,
  exportResultsToExcel,
  findMatchingOption,
  normalizeText,
  rowsToExcelBase64,
} from "@/lib/helpers/bulk-upload-utils";
import {
  CompanyGroup,
  Gender,
  getCompanyGroups,
  getGenders,
  getMaritalStatuses,
  getRelationships,
  getSchemesByCompany,
  getStates,
  getTitles,
  getCitiesByState,
  MaritalStatus,
  Relationship,
  Scheme,
  State,
  Title,
  City,
} from "@/lib/services/lists-service";
import {
  addBeneficiaryList,
  BeneficiaryPayload,
} from "@/lib/services/enrollment-service";
import {
  DeleteIcon,
  DownloadIcon,
  EmptyUploadIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/icons";
import { sendBulkUploadNotification } from "@/lib/services/email-temples";

export default function BulkUploadPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isClearModalOpen,
    onOpen: onClearModalOpen,
    onClose: onClearModalClose,
  } = useDisclosure();
  const [uploadedRows, setUploadedRows] = useState<BulkUploadRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<BulkUploadRow | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // List values state
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isLoadingSchemes, setIsLoadingSchemes] = useState(false);
  const [maritalStatuses, setMaritalStatuses] = useState<MaritalStatus[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [allCities, setAllCities] = useState<City[]>([]); // Cache all cities

  // Company selection
  const [selectedCompany, setSelectedCompany] = useState("");

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

          // Fetch cities for all states to build a lookup map
          const allCitiesPromises = statesRes.result.map((state) =>
            getCitiesByState(state.Value),
          );
          const allCitiesResults = await Promise.all(allCitiesPromises);
          const citiesFlat = allCitiesResults
            .filter((res) => res.status === 200 && res.result)
            .flatMap((res) => res.result!);

          setAllCities(citiesFlat);
        }
      } catch (error) {
        throw new Error(`Failed to fetch list values: ${error}`);
      } finally {
        setIsLoadingCompanies(false);
        setIsLoadingLists(false);
      }
    };

    loadAllListValues();
  }, []);

  // Fetch schemes when company changes
  useEffect(() => {
    const fetchSchemes = async () => {
      if (selectedCompany) {
        setIsLoadingSchemes(true);
        try {
          const schemesRes = await getSchemesByCompany(selectedCompany);

          if (schemesRes.status === 200 && schemesRes.result) {
            setSchemes(schemesRes.result);
          }
        } catch (error) {
          throw new Error(`Failed to fetch schemes: ${error}`);
        } finally {
          setIsLoadingSchemes(false);
        }
      } else {
        setSchemes([]);
      }
    };

    fetchSchemes();
  }, [selectedCompany]);

  const handleDownloadTemplate = () => {
    downloadBulkUploadTemplate();
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!selectedCompany) {
      toast.error("Please select Company first");

      return;
    }

    setIsUploading(true);

    try {
      const rows = await parseExcelFile(file);

      // Validate schemes exist for the selected company
      const uniqueSchemes = [...new Set(rows.map((r) => r.scheme))];
      const invalidSchemes: string[] = [];

      uniqueSchemes.forEach((schemeName) => {
        const schemeExists = schemes.some(
          (s) => normalizeText(s.PlanName) === normalizeText(schemeName),
        );

        if (!schemeExists) {
          invalidSchemes.push(schemeName);
        }
      });

      if (invalidSchemes.length > 0) {
        toast.error(
          `Invalid scheme(s) for selected company: ${invalidSchemes.join(", ")}. Please check your Excel.`,
        );
        setIsUploading(false);
        event.target.value = "";

        return;
      }

      setUploadedRows(rows);
      toast.success(`Successfully uploaded ${rows.length} rows`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const handleEditRow = (row: BulkUploadRow) => {
    setSelectedRow(row);
    onOpen();
  };

  const handleSaveRow = (updatedRow: BulkUploadRow) => {
    setUploadedRows(
      uploadedRows.map((row) => (row.id === updatedRow.id ? updatedRow : row)),
    );
  };

  const handleDeleteRow = (id: string) => {
    if (confirm("Are you sure you want to delete this row?")) {
      setUploadedRows(uploadedRows.filter((row) => row.id !== id));
    }
  };

  const handleClearAll = () => {
    setUploadedRows([]);
    toast.success("All rows cleared");
  };

  const handleDownloadResults = () => {
    if (uploadedRows.length === 0) {
      toast.error("No data to download");

      return;
    }
    exportResultsToExcel(uploadedRows);
    toast.success("Results downloaded successfully");
  };

  const handleSubmitAll = async () => {
    if (!selectedCompany) {
      toast.error("Please select Company");

      return;
    }

    setIsSubmitting(true);

    try {
      // Group rows by employee number (principal and their dependants)
      const groupedRows: { [key: string]: BulkUploadRow[] } = {};

      uploadedRows.forEach((row) => {
        if (row.memberDependantIndicator?.toUpperCase() === "M") {
          // Principal - use employee number as key
          const empNo = row.employeeNumber || row.id;

          if (!groupedRows[empNo]) {
            groupedRows[empNo] = [];
          }
          groupedRows[empNo].push(row);
        }
      });

      // Add dependants to their principals (match by employee number)
      uploadedRows.forEach((row) => {
        if (row.memberDependantIndicator?.toUpperCase() === "D") {
          const empNo = row.employeeNumber;

          if (empNo && groupedRows[empNo]) {
            groupedRows[empNo].push(row);
          } else {
            // Dependant without matching principal - mark as error
            const rowIndex = uploadedRows.findIndex((r) => r.id === row.id);

            if (rowIndex !== -1) {
              uploadedRows[rowIndex] = {
                ...row,
                status: "failed",
                errorMessage: `No principal found with Employee Number: ${empNo}`,
              };
            }
          }
        }
      });

      let updatedRows = [...uploadedRows];
      let successCount = 0;
      let failCount = 0;

      // Process each principal and their dependants
      for (const empNo of Object.keys(groupedRows)) {
        const group = groupedRows[empNo];
        const principal = group[0]; // First is always principal
        const dependants = group.slice(1); // Rest are dependants

        // Update principal status to pending
        const principalIndex = updatedRows.findIndex(
          (r) => r.id === principal.id,
        );

        updatedRows[principalIndex] = { ...principal, status: "pending" };
        setUploadedRows([...updatedRows]);

        try {
          // Convert date format from dd/mm/yyyy to yyyy-mm-dd
          const convertDate = (dateStr: string) => {
            if (!dateStr) return "";
            const parts = dateStr.split("/");

            if (parts.length === 3) {
              return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            return dateStr;
          };

          // Find matching values for selects
          const titleMatch = findMatchingOption(principal.title, titles);
          const genderMatch = findMatchingOption(principal.gender, genders);
          const maritalStatusMatch = findMatchingOption(
            principal.maritalStatus,
            maritalStatuses,
          );
          const stateMatch = states.find(
            (s) => normalizeText(s.Text) === normalizeText(principal.state),
          );

          // Find scheme from row data
          const principalScheme = schemes.find(
            (s) =>
              normalizeText(s.PlanName) === normalizeText(principal.scheme),
          );

          if (!principalScheme) {
            updatedRows[principalIndex] = {
              ...principal,
              status: "failed",
              errorMessage: `Scheme "${principal.scheme}" not found for this company`,
            };
            setUploadedRows([...updatedRows]);
            failCount++;
            continue;
          }

          // Find city Value from city name
          const cityMatch = allCities.find(
            (c) => normalizeText(c.Text) === normalizeText(principal.city),
          );

          // Build principal payload
          const principalPayload: BeneficiaryPayload = {
            titleid: titleMatch?.title_id || 0,
            registrationsource: "Bulk Upload",
            startdate: convertDate(principal.startDateOfMember),
            groupid: parseInt(selectedCompany),
            MemberShipNo: "",
            Parent_Cif: 0,
            Cif_number: 0,
            OfflineID: "",
            employeecode: principal.employeeNumber || "",
            FirstName: principal.firstname,
            Surname: principal.surname,
            othernames: principal.otherName,
            DateOfBirth: convertDate(principal.dateOfBirth),
            Sex_ID: genderMatch?.Sex_id.toString() || "",
            MaritalStatus:
              maritalStatusMatch?.Marital_statusid.toString() || "",
            EmailAdress: principal.email,
            Home_Phone: "",
            Work_Phone: "",
            Mobile: principal.contacts,
            Mobile2: "",
            Hospital: "",
            Scheme: principalScheme.PlanName,
            schemeid: principalScheme.PlanID,
            regionid: stateMatch ? parseInt(stateMatch.Value) : 0,
            Postal_Phone: "",
            Physical_Add1: principal.address,
            Postal_Town_ID: cityMatch?.Value || principal.city,
            Relationship_ID: "30", // Main member
            BloodGroup: "",
            genotype: "",
            PreExistingCondition: null,
            cadre: "",
            EnrolleePictureType: "",
            EnrolleePicture: "",
          };

          // Submit principal
          console.log("Submitting principal:", principalPayload);
          const principalResponse = await addBeneficiaryList({
            AddBeneficiary: [principalPayload],
          });

          console.log("Principal response:", principalResponse);

          // Check for errors
          if (
            principalResponse.status === 500 ||
            (principalResponse.result &&
              principalResponse.result[0]?.ErrorMessage)
          ) {
            const errorMsg =
              principalResponse.result?.[0]?.ErrorMessage ||
              "Failed to create principal";

            updatedRows[principalIndex] = {
              ...principal,
              status: "failed",
              errorMessage: errorMsg,
            };
            setUploadedRows([...updatedRows]);
            failCount++;
            toast.error(`Principal ${principal.surname} failed: ${errorMsg}`);
            continue; // Skip dependants if principal fails
          }

          // Principal succeeded
          const principalResult = principalResponse.Enrollee_Numbers?.[0];

          if (!principalResult || principalResult.ErrorMessage) {
            const errorMsg =
              principalResult?.ErrorMessage || "No membership number returned";

            updatedRows[principalIndex] = {
              ...principal,
              status: "failed",
              errorMessage: errorMsg,
            };
            setUploadedRows([...updatedRows]);
            failCount++;
            continue;
          }

          const membershipNo = principalResult.Membershipno || "";
          const cifNumber = principalResult.CifNumber || 0;

          updatedRows[principalIndex] = {
            ...principal,
            status: "success",
            membershipNo: membershipNo,
          };
          setUploadedRows([...updatedRows]);
          successCount++;
          toast.success(`Principal ${principal.surname} enrolled successfully`);

          // Process dependants
          for (const dependant of dependants) {
            const dependantIndex = updatedRows.findIndex(
              (r) => r.id === dependant.id,
            );

            updatedRows[dependantIndex] = { ...dependant, status: "pending" };
            setUploadedRows([...updatedRows]);

            try {
              const depGenderMatch = findMatchingOption(
                dependant.gender,
                genders,
              );
              const depMaritalMatch = findMatchingOption(
                dependant.maritalStatus,
                maritalStatuses,
              );
              const depRelationshipMatch = relationships.find(
                (r) =>
                  normalizeText(r.Text) ===
                  normalizeText(dependant.relationshipToMainMember),
              );

              // Find city Value from city name for dependant
              const depCityMatch = allCities.find(
                (c) => normalizeText(c.Text) === normalizeText(dependant.city),
              );

              // Use principal's scheme for dependant
              const dependantScheme = schemes.find(
                (s) =>
                  normalizeText(s.PlanName) === normalizeText(principal.scheme),
              );

              const dependantPayload: BeneficiaryPayload = {
                titleid: 0,
                registrationsource: "Bulk Upload",
                startdate: convertDate(dependant.startDateOfMember),
                groupid: parseInt(selectedCompany),
                MemberShipNo: membershipNo,
                Parent_Cif: cifNumber,
                Cif_number: 0,
                OfflineID: "",
                employeecode: "",
                FirstName: dependant.firstname,
                Surname: dependant.surname,
                othernames: dependant.otherName,
                DateOfBirth: convertDate(dependant.dateOfBirth),
                Sex_ID: depGenderMatch?.Sex_id.toString() || "",
                MaritalStatus:
                  depMaritalMatch?.Marital_statusid.toString() || "",
                EmailAdress: dependant.email,
                Home_Phone: "",
                Work_Phone: "",
                Mobile: dependant.contacts,
                Mobile2: "",
                Hospital: "",
                Scheme: dependantScheme?.PlanName || principal.scheme,
                schemeid: dependantScheme?.PlanID || 0,
                regionid: stateMatch ? parseInt(stateMatch.Value) : 0,
                Postal_Phone: "",
                Physical_Add1: dependant.address,
                Postal_Town_ID: depCityMatch?.Value || dependant.city,
                Relationship_ID: depRelationshipMatch?.Value || "0",
                BloodGroup: "",
                genotype: "",
                PreExistingCondition: null,
                cadre: "",
                EnrolleePictureType: "",
                EnrolleePicture: "",
              };

              console.log("Submitting dependant:", dependantPayload);
              const dependantResponse = await addBeneficiaryList({
                AddBeneficiary: [dependantPayload],
              });

              console.log("Dependant response:", dependantResponse);

              if (
                dependantResponse.status === 500 ||
                (dependantResponse.result &&
                  dependantResponse.result[0]?.ErrorMessage)
              ) {
                const errorMsg =
                  dependantResponse.result?.[0]?.ErrorMessage ||
                  "Failed to create dependant";

                updatedRows[dependantIndex] = {
                  ...dependant,
                  status: "failed",
                  errorMessage: errorMsg,
                };
                setUploadedRows([...updatedRows]);
                failCount++;
                continue;
              }

              const dependantResult = dependantResponse.Enrollee_Numbers?.[0];

              if (!dependantResult || dependantResult.ErrorMessage) {
                const errorMsg =
                  dependantResult?.ErrorMessage ||
                  "No membership number returned";

                updatedRows[dependantIndex] = {
                  ...dependant,
                  status: "failed",
                  errorMessage: errorMsg,
                };
                setUploadedRows([...updatedRows]);
                failCount++;
                continue;
              }

              updatedRows[dependantIndex] = {
                ...dependant,
                status: "success",
                membershipNo: dependantResult.UniqueMembershipNo || "",
              };
              setUploadedRows([...updatedRows]);
              successCount++;
            } catch (error) {
              updatedRows[dependantIndex] = {
                ...dependant,
                status: "failed",
                errorMessage: (error as Error).message,
              };
              setUploadedRows([...updatedRows]);
              failCount++;
            }
          }
        } catch (error) {
          updatedRows[principalIndex] = {
            ...principal,
            status: "failed",
            errorMessage: (error as Error).message,
          };
          setUploadedRows([...updatedRows]);
          failCount++;
        }
      }

      // Auto-download results
      exportResultsToExcel(updatedRows);

      try {
        const excelBase64 = rowsToExcelBase64(updatedRows); // add this helper to bulk-upload-utils.ts

        await sendBulkUploadNotification({
          totalCount: uploadedRows.length,
          successCount,
          failCount,
          companyName:
            companies.find((c) => c.GROUP_ID.toString() === selectedCompany)
              ?.GROUP_NAME ?? selectedCompany,
          excelBase64,
          excelFileName: `BulkUpload_Results_${new Date().toISOString().slice(0, 10)}.xlsx`,
        });
      } catch (emailErr) {
        console.error("Failed to send bulk upload notification:", emailErr);
      }

      // Show summary
      toast.success(
        `Enrollment complete! Success: ${successCount}, Failed: ${failCount}`,
      );
    } catch (error) {
      toast.error("Submission error: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Bulk Upload</h1>
        <p className="text-gray-600">
          Upload Excel file with multiple enrollees and dependants
        </p>
      </div>

      {/* Company Selection */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 md:p-8 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Select Company
        </h2>
        <Autocomplete
          className="max-w-md"
          defaultItems={companies}
          isLoading={isLoadingCompanies}
          label="Company"
          placeholder="Search or select company"
          radius="lg"
          selectedKey={selectedCompany}
          onSelectionChange={(key) => {
            setSelectedCompany(key as string);
          }}
        >
          {(company) => (
            <AutocompleteItem key={company.GROUP_ID.toString()}>
              {company.GROUP_NAME}
            </AutocompleteItem>
          )}
        </Autocomplete>
        <p className="text-sm text-gray-600 mt-3">
          Schemes will be validated from your Excel file
        </p>

        {/* Scheme Table */}
        {selectedCompany && (
          <div className="mt-6">
            <SchemeTable isLoading={isLoadingSchemes} schemes={schemes} />
          </div>
        )}
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 md:p-8 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Upload Excel File
        </h2>

        <div className="flex flex-wrap gap-4 mb-6">
          {/* Download Template Button */}
          <Button
            className="bg-green-500 text-white hover:bg-green-600 font-semibold"
            radius="lg"
            startContent={<DownloadIcon />}
            onPress={handleDownloadTemplate}
          >
            Download Template
          </Button>

          {/* Upload Button */}
          <Button
            className="bg-blue-500 text-white hover:bg-blue-600 font-semibold"
            isDisabled={!selectedCompany || isUploading}
            isLoading={isUploading}
            radius="lg"
            startContent={!isUploading && <UploadIcon className="h-5 w-5" />}
            onPress={() => document.getElementById("excel-upload")?.click()}
          >
            Upload Excel File
          </Button>
          <input
            accept=".xlsx,.xls"
            className="hidden"
            id="excel-upload"
            type="file"
            onChange={handleFileUpload}
          />
        </div>

        {!selectedCompany && (
          <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 flex gap-2 items-center">
              <WarningIcon />
              <span>Please select Company and Scheme before uploading</span>
            </p>
          </div>
        )}
      </div>

      {/* Uploaded Data Table */}
      {uploadedRows.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 md:p-8 mb-6">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-700">
              Uploaded Data ({uploadedRows.length} rows)
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button
                className="bg-green-500 text-white hover:bg-green-600 font-semibold"
                isDisabled={isSubmitting}
                radius="lg"
                startContent={<DownloadIcon />}
                onPress={handleDownloadResults}
              >
                Download Excel
              </Button>
              <Button
                className="bg-red-500 text-white hover:bg-red-600 font-semibold"
                isDisabled={isSubmitting}
                radius="lg"
                startContent={<DeleteIcon />}
                onPress={onClearModalOpen}
              >
                Clear All
              </Button>
              <Button
                className="bg-gradient-to-r from-[#F15A24] to-[#c61531] text-white hover:opacity-90 font-semibold"
                isDisabled={isSubmitting}
                isLoading={isSubmitting}
                radius="lg"
                onPress={handleSubmitAll}
              >
                Submit All Records
              </Button>
            </div>
          </div>

          <BulkUploadTable
            rows={uploadedRows}
            onDelete={handleDeleteRow}
            onEdit={handleEditRow}
          />
        </div>
      )}

      {/* Empty State */}
      {uploadedRows.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
          <EmptyUploadIcon />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No data uploaded yet
          </h3>
          <p className="text-gray-500">
            Download the template, fill it out, and upload to get started
          </p>
        </div>
      )}

      {/* Edit Row Modal */}
      <EditRowModal
        genders={genders}
        isLoading={isLoadingLists}
        isOpen={isOpen}
        maritalStatuses={maritalStatuses}
        relationships={relationships}
        row={selectedRow}
        states={states}
        titles={titles}
        onClose={onClose}
        onSave={handleSaveRow}
      />

      {/* Clear Data Confirmation Modal */}
      <ClearDataModal
        isOpen={isClearModalOpen}
        rowCount={uploadedRows.length}
        onClose={onClearModalClose}
        onConfirm={handleClearAll}
      />
    </>
  );
}
