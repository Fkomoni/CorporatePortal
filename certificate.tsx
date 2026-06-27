import { useState, useRef, useEffect } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import CertificatePDF from "@/components/certificate-template";
import { CompanyGroup, getCompanyGroups } from "@/lib/services/lists-service";
import { NoteIcon } from "@/components/icons";

export default function CertificatePage() {
  const certificateRef = useRef<HTMLDivElement>(null);

  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedCompanyData, setSelectedCompanyData] =
    useState<CompanyGroup | null>(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Load companies on mount
  useEffect(() => {
    const loadCompanies = async () => {
      setIsLoadingCompanies(true);
      try {
        const res = await getCompanyGroups();

        if (res.status === 200 && res.result) {
          setCompanies(res.result);
        }
      } catch (error) {
        toast.error(`Failed to load companies: ${(error as Error).message}`);
      } finally {
        setIsLoadingCompanies(false);
      }
    };

    loadCompanies();
  }, []);

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);

    if (isNaN(d.getTime())) return "N/A";

    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleGenerateCertificate = () => {
    if (!selectedCompany || !companies.length) {
      toast.error("Please select a company");

      return;
    }

    // Find the selected company data from the already loaded companies
    const companyData = companies.find(
      (company) => company.GROUP_ID.toString() === selectedCompany,
    );

    if (!companyData) {
      toast.error("Company data not found");

      return;
    }

    setSelectedCompanyData(companyData);
    toast.success("Certificate generated successfully");
  };

  const handleDownloadPDF = async () => {
    if (!certificateRef.current || !selectedCompanyData) return;

    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(
        `Certificate_${selectedCompanyData.PolicyNumber || selectedCompanyData.GROUP_CODE}.pdf`,
      );
      toast.success("Certificate downloaded successfully");
    } catch (err) {
      toast.error("Failed to generate PDF");
      console.error(err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Certificate of Health Insurance
        </h1>
        <p className="text-gray-600">
          Select a company to generate and download their certificate of
          insurance
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Autocomplete
              className="w-full"
              defaultItems={companies}
              isLoading={isLoadingCompanies}
              label="Select Company"
              placeholder="Search or select company"
              radius="sm"
              selectedKey={selectedCompany}
              onSelectionChange={(key) => {
                setSelectedCompany(key as string);
                setSelectedCompanyData(null); // Clear certificate when new company is selected
              }}
            >
              {(company) => (
                <AutocompleteItem key={company.GROUP_ID.toString()}>
                  {company.GROUP_NAME}
                </AutocompleteItem>
              )}
            </Autocomplete>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Button
              className="bg-[#F15A24] text-white font-semibold"
              isDisabled={!selectedCompany}
              radius="sm"
              onPress={handleGenerateCertificate}
            >
              Generate Certificate
            </Button>

            {selectedCompanyData && (
              <Button
                className="bg-green-600 text-white font-semibold"
                isDisabled={isGeneratingPDF}
                isLoading={isGeneratingPDF}
                radius="sm"
                onPress={handleDownloadPDF}
              >
                Download PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Certificate Preview */}
      {selectedCompanyData && (
        <CertificatePDF
          certificateRef={certificateRef}
          coverFrom={formatDate(selectedCompanyData.Accepton)}
          coverTo={formatDate(selectedCompanyData.Termdate)}
          policyHolderName={selectedCompanyData.GROUP_NAME}
          policyNumber={
            selectedCompanyData.PolicyNumber || selectedCompanyData.GROUP_CODE
          }
          signedDate={formatDate(new Date().toISOString())}
        />
      )}

      {/* Empty state */}
      {!selectedCompanyData && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
          <NoteIcon />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No Certificate Generated
          </h3>
          <p className="text-gray-500">
            Select a company, then click &quot;Generate Certificate&quot; to get
            started
          </p>
        </div>
      )}
    </>
  );
}
