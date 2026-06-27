import { useState, useRef } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import toast from "react-hot-toast";
import {
  ChevronDown,
  FileText,
  MinusCircle,
  CalendarClock,
} from "lucide-react";

import { CompanyGroup, getCompanyGroups } from "@/lib/services/lists-service";
import {
  getClientInvoice,
  getClientInvoiceExisting,
  getClientInvoiceSchedule,
} from "@/lib/services/invoice-service";
import {
  getInvoiceReceiptHistory,
  insertInvoiceForDownload,
  insertInvoiceReceiptHistory,
  InvoiceReceiptHistory,
} from "@/lib/services/invoice-receipt-service";
import {
  DownloadIcon,
  InfoIcon,
  NoteIcon,
  WarningIcon,
} from "@/components/icons";
import InvoicePDF from "@/components/invoices/invoice-template";
import { generateInvoicePDF } from "@/lib/helpers/invoices/generate-pdf";
import { generateInvoiceExcel } from "@/lib/helpers/invoices/generate-excel";
import { generateScheduleExcel } from "@/lib/helpers/invoices/generate-schedule-excel";
import ScheduleModal from "@/components/invoices/schedule-modal";
import OutstandingWarningModal from "@/components/invoices/outstanding-modal";
import { InvoiceLineItem, InvoiceScheduleItem } from "@/types";
import { generateInvoiceRefNo } from "@/lib/helpers";

type Frequency = "monthly" | "quarterly" | "bi-annually" | "annually" | "";
type GenerateMode = "normal" | "excNeg" | "nextQuarter";

const frequencyOptions = [
  { key: "monthly", label: "Monthly", divisor: 12, months: 1 },
  { key: "quarterly", label: "Quarterly", divisor: 4, months: 3 },
  { key: "bi-annually", label: "Bi-Annually", divisor: 2, months: 6 },
  { key: "annually", label: "Annually", divisor: 1, months: 12 },
];

const generateMenuItems = [
  {
    key: "normal" as GenerateMode,
    label: "Generate Invoice",
    description: "Standard invoice with all premiums",
    icon: <FileText size={16} />,
  },
  {
    key: "excNeg" as GenerateMode,
    label: "Generate Exc Neg",
    description: "Exclude negative premium & population columns",
    icon: <MinusCircle size={16} />,
  },
  {
    key: "nextQuarter" as GenerateMode,
    label: "Generate Next Quarter",
    description: "Preview next quarter's invoice",
    icon: <CalendarClock size={16} />,
  },
];

export default function InvoicePage() {
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedFrequency, setSelectedFrequency] = useState<Frequency>("");
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceLineItem[] | null>(
    null,
  );
  const [receiptHistory, setReceiptHistory] =
    useState<InvoiceReceiptHistory | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [generateMode, setGenerateMode] = useState<GenerateMode>("normal");

  const [excludeNegative, setExcludeNegative] = useState(false);
  const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);

  const [scheduleData, setScheduleData] = useState<
    InvoiceScheduleItem[] | null
  >(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isGeneratingScheduleExcel, setIsGeneratingScheduleExcel] =
    useState(false);

  const invoiceRef = useRef<HTMLDivElement>(null);

  const [editableAccountName, setEditableAccountName] = useState("");
  const [editableBankName, setEditableBankName] = useState("");
  const [editableBankAccount, setEditableBankAccount] = useState("");

  useState(() => {
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
  });

  const calculateNextDueDate = (frequency: Frequency): string => {
    const config = frequencyOptions.find((f) => f.key === frequency);
    const months = config?.months || 1;
    const nextDue = new Date();

    nextDue.setMonth(nextDue.getMonth() + months);

    return nextDue.toISOString().split("T")[0];
  };

  const handleFetchInvoice = async (mode: GenerateMode = "normal") => {
    if (!selectedCompany) {
      toast.error("Please select a company");

      return;
    }
    if (!selectedFrequency) {
      toast.error("Please select a payment frequency");

      return;
    }

    const excNeg = mode === "excNeg";
    const isNextQuarter = mode === "nextQuarter";

    setGenerateMode(mode);
    setExcludeNegative(excNeg);
    setIsLoadingInvoice(true);

    try {
      const history = await getInvoiceReceiptHistory(selectedCompany);
      const groupId = parseInt(selectedCompany);

      let data: InvoiceLineItem[];
      const excNegConvert = excNeg ? 1 : 0;

      if (isNextQuarter) {
        data = await getClientInvoice(selectedCompany, 0);
      } else if (
        history &&
        history.Success === 1 &&
        history.HasOutstanding === 1
      ) {
        data = await getClientInvoiceExisting(selectedCompany, excNegConvert);
        toast.success(
          "Outstanding balance exists. You can view but not download the invoice until payment is settled.",
        );
      } else {
        data = await getClientInvoice(selectedCompany, excNegConvert);
      }

      const grandTotal = data.reduce((sum, item) => sum + item.TotalPremium, 0);
      const receiptNumber = generateInvoiceRefNo(groupId);
      const frequencyConfig = frequencyOptions.find(
        (f) => f.key === selectedFrequency,
      );

      const effectiveDivisor = isNextQuarter
        ? 4
        : frequencyConfig?.divisor || 1;
      const nextDueAmount = grandTotal / effectiveDivisor;

      const schemes = data.map((item) => item.Member_Plan).join("//");

      const positivePremium = data
        .map((item) => {
          const value =
            typeof item.PositivePremium === "string"
              ? parseFloat(item.PositivePremium)
              : item.PositivePremium;

          return value.toFixed(2);
        })
        .join("//");

      const negativePremium = data
        .map((item) => {
          const value =
            typeof item.NegativePremium === "string"
              ? parseFloat(item.NegativePremium)
              : item.NegativePremium;

          return value.toFixed(2);
        })
        .join("//");

      const positivePop = data
        .map((item) => item.PositiveCount.toString())
        .join("//");
      const negativePop = data
        .map((item) => item.NegativeCount.toString())
        .join("//");

      const hasOutstanding = history?.HasOutstanding ?? 0;
      const existingDownloaded = history?.ExistingDownloaded ?? 0;

      setReceiptHistory({
        Success: 1,
        Message:
          history?.HasOutstanding === 1
            ? "Outstanding balance exists"
            : "New invoice preview",
        HasOutstanding: hasOutstanding,
        TotalAmount: grandTotal,
        AmountPaid: history?.AmountPaid ?? 0,
        OutstandingBalance: history?.OutstandingBalance ?? grandTotal,
        NextDue: history?.NextDue || calculateNextDueDate(selectedFrequency),
        NextDueAmount: history?.NextDueAmount ?? nextDueAmount,
        Frequency: isNextQuarter
          ? "Quarterly"
          : history?.Frequency || frequencyConfig?.label || "Monthly",
        originalReceiptNumber: history?.ReceiptNumber || receiptNumber,
        ReceiptNumber: receiptNumber,
        schemes,
        positivePremium,
        NegativePremium: negativePremium,
        PositivePop: positivePop,
        NegativePop: negativePop,
        ExistingDownloaded: existingDownloaded,
        ReceiptCount: history?.ReceiptCount ?? 0,
        ReceiptTotalAmount: history?.ReceiptTotalAmount ?? 0,
      });

      setInvoiceData(data);
      setEditableAccountName(data[0]?.AccName || "");
      setEditableBankName(data[0]?.BankName || "");
      setEditableBankAccount(data[0]?.BankAcc || "");
      setPreviewData({
        grandTotal,
        nextDueAmount,
        frequencyConfig,
        schemes,
        positivePremium,
        negativePremium,
        positivePop,
        negativePop,
      });

      toast.success("Invoice loaded successfully");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  const [previewData, setPreviewData] = useState<{
    grandTotal: number;
    nextDueAmount: number;
    frequencyConfig?: (typeof frequencyOptions)[0];
    schemes: string;
    positivePremium: string;
    negativePremium: string;
    positivePop: string;
    negativePop: string;
  } | null>(null);

  const handleDownloadFinalPDF = async () => {
    if (!invoiceRef.current || !invoiceData || !receiptHistory) return;

    if (
      receiptHistory.HasOutstanding === 1 &&
      receiptHistory.ExistingDownloaded === 1
    ) {
      toast.error(
        "This invoice has already been downloaded. Please settle the outstanding balance before downloading again.",
      );

      return;
    }

    if (receiptHistory.HasOutstanding === 1) {
      setIsOutstandingModalOpen(true);

      return;
    }

    await performPDFDownload(generateMode);
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current || !invoiceData || !receiptHistory) return;

    setIsGeneratingPDF(true);
    await generateInvoicePDF(
      invoiceRef.current,
      receiptHistory.ReceiptNumber || "",
    );
    toast.success("Invoice downloaded successfully");
    setIsGeneratingPDF(false);
  };

  // mode is passed explicitly so the function always has the correct value,
  // regardless of when React batches the state update for generateMode.
  const performPDFDownload = async (mode: GenerateMode) => {
    if (!invoiceRef.current || !invoiceData || !receiptHistory) return;

    setIsGeneratingPDF(true);
    try {
      const groupId = parseInt(selectedCompany);

      // Step 1: Insert receipt history record — skipped for Next Quarter,
      // which only needs the download record (no new invoice entry).
      if (
        mode !== "nextQuarter" &&
        receiptHistory.HasOutstanding === 0 &&
        previewData
      ) {
        const payload = {
          GroupId: groupId,
          ReceiptNumber: receiptHistory.ReceiptNumber!,
          DatePaid: new Date().toISOString().split("T")[0],
          AmountPaid: 0,
          TotalAmount: previewData.grandTotal,
          nextdueamount: previewData.nextDueAmount,
          NextDue: receiptHistory.NextDue!,
          frequency: receiptHistory.Frequency!,
          schemes: previewData.schemes,
          positivePremium: previewData.positivePremium,
          NegativePremium: previewData.negativePremium,
          PositivePop: previewData.positivePop,
          NegativePop: previewData.negativePop,
        };

        const insertResult = await insertInvoiceReceiptHistory(payload);

        if (insertResult.status !== 200 || !insertResult.result?.Success) {
          throw new Error("Failed to create invoice record");
        }
      }

      // Step 2: Insert download record (all modes including nextQuarter)
      const parentReceiptNumber =
        receiptHistory.HasOutstanding === 1
          ? receiptHistory.originalReceiptNumber || null
          : receiptHistory.ReceiptNumber || null;

      await insertInvoiceForDownload({
        TransactionId: null,
        InputtedBy: null,
        ReceiptNumber: receiptHistory.ReceiptNumber!,
        AmountPaid: 0,
        NextDue: null,
        invoicedamount: receiptHistory.NextDueAmount || 0,
        IsEvidenceUpload: false,
        GroupId: groupId,
        totalPremium: previewData?.grandTotal || 0,
        ParentReceiptNumber: parentReceiptNumber,
        ISENDORSED: 0,
      });

      // Step 3: Generate and download the PDF
      await generateInvoicePDF(
        invoiceRef.current,
        receiptHistory.ReceiptNumber || "",
      );
      toast.success("Invoice downloaded successfully");

      // Step 4: Refresh receipt history to reflect updated ExistingDownloaded
      const updatedHistory = await getInvoiceReceiptHistory(selectedCompany);

      if (updatedHistory) {
        setReceiptHistory({
          ...receiptHistory,
          ExistingDownloaded: updatedHistory.ExistingDownloaded,
        });
      }
    } catch (error) {
      toast.error("Failed to generate PDF: " + (error as Error).message);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleConfirmOutstandingDownload = async () => {
    setIsOutstandingModalOpen(false);
    await performPDFDownload(generateMode);
  };

  const handleDownloadExcel = async () => {
    if (!invoiceData || invoiceData.length === 0 || !receiptHistory) return;

    setIsGeneratingExcel(true);
    try {
      await generateInvoiceExcel(
        invoiceData,
        receiptHistory.ReceiptNumber!,
        receiptHistory.Frequency!,
        amountDueToday,
        paid,
        remaining,
        existingTotalAmount,
      );
      toast.success("Excel invoice downloaded successfully");
    } catch (error) {
      toast.error("Failed to generate Excel: " + (error as Error).message);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const handleViewSchedule = async () => {
    if (!selectedCompany) return;

    setIsLoadingSchedule(true);
    setIsScheduleModalOpen(true);
    try {
      const data = await getClientInvoiceSchedule(selectedCompany);

      setScheduleData(data);
    } catch (error) {
      toast.error("Failed to load schedule: " + (error as Error).message);
      setIsScheduleModalOpen(false);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const handleDownloadScheduleExcel = async () => {
    if (!scheduleData || scheduleData.length === 0) return;

    setIsGeneratingScheduleExcel(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await generateScheduleExcel(scheduleData);
      toast.success("Schedule Excel downloaded successfully");
      handleCloseScheduleModal();
    } catch (error) {
      toast.error(
        "Failed to generate schedule Excel: " + (error as Error).message,
      );
    } finally {
      setIsGeneratingScheduleExcel(false);
    }
  };

  const handleCloseScheduleModal = () => {
    setIsScheduleModalOpen(false);
    setScheduleData(null);
  };

  const grandTotal = invoiceData
    ? invoiceData.reduce((sum, item) => sum + item.TotalPremium, 0)
    : 0;

  const amountDueToday = receiptHistory?.NextDueAmount || 0;
  const paid = receiptHistory?.AmountPaid || 0;
  const remaining = receiptHistory?.OutstandingBalance || grandTotal;
  const existingTotalAmount = receiptHistory?.TotalAmount || grandTotal;
  const isDownloadBlocked =
    receiptHistory?.HasOutstanding === 1 &&
    receiptHistory?.ExistingDownloaded === 1;

  const activeLabel =
    generateMenuItems.find((i) => i.key === generateMode)?.label ??
    "Generate Invoice";

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Generate Invoice
        </h1>
        <p className="text-gray-600">
          Select a company to generate and download their invoice
        </p>
      </div>

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
                setInvoiceData(null);
                setReceiptHistory(null);
                setPreviewData(null);
                setExcludeNegative(false);
                setGenerateMode("normal");

                // Reset editable fields when company changes
                setEditableAccountName("");
                setEditableBankName("");
                setEditableBankAccount("");
              }}
            >
              {(company) => (
                <AutocompleteItem key={company.GROUP_ID.toString()}>
                  {company.GROUP_NAME}
                </AutocompleteItem>
              )}
            </Autocomplete>

            <Select
              className="w-full"
              label="Payment Frequency"
              placeholder="Select frequency"
              radius="sm"
              selectedKeys={[selectedFrequency]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as Frequency;

                setSelectedFrequency(selected);
              }}
            >
              {frequencyOptions.map((option) => (
                <SelectItem key={option.key}>{option.label}</SelectItem>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Dropdown
              isDisabled={
                !selectedCompany || !selectedFrequency || isLoadingInvoice
              }
            >
              <DropdownTrigger>
                <Button
                  className="bg-[#F15A24] text-white font-semibold"
                  endContent={
                    !isLoadingInvoice && (
                      <ChevronDown className="opacity-75 ml-0.5" size={15} />
                    )
                  }
                  isDisabled={
                    !selectedCompany || !selectedFrequency || isLoadingInvoice
                  }
                  isLoading={isLoadingInvoice}
                  radius="sm"
                >
                  {isLoadingInvoice ? "Generating..." : activeLabel}
                </Button>
              </DropdownTrigger>

              <DropdownMenu
                aria-label="Invoice generation options"
                onAction={(key) => handleFetchInvoice(key as GenerateMode)}
              >
                {generateMenuItems.map((item) => (
                  <DropdownItem
                    key={item.key}
                    description={item.description}
                    startContent={
                      <span className="text-[#F15A24]">{item.icon}</span>
                    }
                  >
                    {item.label}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>

            <Button
              className="bg-purple-600 text-white font-semibold"
              isDisabled={!selectedCompany}
              radius="sm"
              onPress={handleViewSchedule}
            >
              View Schedule
            </Button>

            {invoiceData && receiptHistory && (
              <>
                <Button
                  className="bg-green-600 text-white font-semibold"
                  isDisabled={isGeneratingPDF || isDownloadBlocked}
                  isLoading={isGeneratingPDF}
                  radius="sm"
                  startContent={!isGeneratingPDF && <DownloadIcon />}
                  onPress={handleDownloadPDF}
                >
                  Download PDF
                </Button>

                <Button
                  className="bg-emerald-700 text-white font-semibold"
                  isDisabled={isGeneratingPDF || isDownloadBlocked}
                  isLoading={isGeneratingPDF}
                  radius="sm"
                  startContent={!isGeneratingPDF && <DownloadIcon />}
                  onPress={handleDownloadFinalPDF}
                >
                  Download Final PDF
                </Button>

                <Button
                  className="bg-blue-600 text-white font-semibold"
                  isDisabled={isGeneratingExcel}
                  isLoading={isGeneratingExcel}
                  radius="sm"
                  startContent={!isGeneratingExcel && <DownloadIcon />}
                  onPress={handleDownloadExcel}
                >
                  Download Excel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Details Card */}
      {invoiceData && receiptHistory && !isLoadingInvoice && (
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">
            Payment Details
          </h2>
          {receiptHistory.HasOutstanding === 1 && (
            <>
              {receiptHistory.ExistingDownloaded === 1 ? (
                <p className="text-sm mb-4 p-3 bg-yellow-50 text-yellow-700 border-2 border-yellow-200 rounded-lg flex items-start gap-2">
                  <WarningIcon />
                  This invoice has already been downloaded. You cannot download
                  it again until the outstanding payment is settled.
                </p>
              ) : (
                <p className="text-sm mb-4 p-3 bg-yellow-50 text-yellow-700 border-2 border-yellow-200 rounded-lg flex items-start gap-2">
                  <InfoIcon />
                  <span>
                    {`You can download this invoice once. After download, you won't be able to download it again until the outstanding payment is settled.`}
                  </span>
                </p>
              )}
            </>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <p className="text-sm text-gray-600 mb-1">
                Amount Due Today ({receiptHistory.Frequency})
              </p>
              <p className="text-2xl font-bold text-blue-700">
                ₦
                {amountDueToday.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <p className="text-sm text-gray-600 mb-1">Paid</p>
              <p className="text-2xl font-bold text-green-700">
                ₦
                {paid.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
              <p className="text-sm text-gray-600 mb-1">Outstanding</p>
              <p className="text-2xl font-bold text-orange-700">
                ₦
                {remaining.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
              <p className="text-sm text-gray-600 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-purple-700">
                ₦
                {grandTotal.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
              <p className="text-sm text-gray-600 mb-1">Receipt Count</p>
              <p className="text-2xl font-bold text-red-700">
                {receiptHistory.ReceiptCount}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Receipt Amount</p>
              <p className="text-2xl font-bold text-gray-700">
                ₦
                {receiptHistory.ReceiptTotalAmount?.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      <OutstandingWarningModal
        isDownloading={isGeneratingPDF}
        isOpen={isOutstandingModalOpen}
        onClose={() => setIsOutstandingModalOpen(false)}
        onConfirm={handleConfirmOutstandingDownload}
      />

      <ScheduleModal
        isDownloading={isGeneratingScheduleExcel}
        isLoading={isLoadingSchedule}
        isOpen={isScheduleModalOpen}
        scheduleData={scheduleData}
        onClose={handleCloseScheduleModal}
        onDownloadExcel={handleDownloadScheduleExcel}
      />

      {isLoadingInvoice && (
        <div className="text-center">
          <Spinner color="warning" />
        </div>
      )}

      {invoiceData && receiptHistory && !isLoadingInvoice && (
        <InvoicePDF
          amountDueToday={amountDueToday}
          editableAccountName={editableAccountName}
          editableBankAccount={editableBankAccount}
          editableBankName={editableBankName}
          excludeNegative={excludeNegative}
          existingTotalAmount={existingTotalAmount}
          frequency={receiptHistory.Frequency || ""}
          invoiceData={invoiceData}
          invoiceRef={invoiceRef}
          paid={paid}
          receiptNumber={receiptHistory.ReceiptNumber || ""}
          remaining={remaining}
          onAccountNameChange={setEditableAccountName}
          onBankAccountChange={setEditableBankAccount}
          onBankNameChange={setEditableBankName}
        />
      )}

      {!invoiceData && !isLoadingInvoice && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
          <NoteIcon />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No Invoice Generated
          </h3>
          <p className="text-gray-500">
            {`Select a company and payment frequency, then click "Generate Invoice" to get started`}
          </p>
        </div>
      )}
    </>
  );
}
