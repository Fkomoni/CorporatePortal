import { useState, useRef } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { DatePicker } from "@heroui/date-picker";
import { parseDate, type DateValue } from "@internationalized/date";
import toast from "react-hot-toast";

import { CompanyGroup, getCompanyGroups } from "@/lib/services/lists-service";
import { getClientInvoiceEndorsement } from "@/lib/services/endorsement-service";
import {
  getInvoiceReceiptHistory,
  insertInvoiceForDownload,
  InvoiceReceiptHistory,
} from "@/lib/services/invoice-receipt-service";
import { DownloadIcon, NoteIcon } from "@/components/icons";
import InvoicePDF from "@/components/invoices/invoice-template";
import { generateInvoicePDF } from "@/lib/helpers/invoices/generate-pdf";
import { InvoiceLineItem, InvoiceScheduleItem } from "@/types";
import { generateInvoiceRefNo } from "@/lib/helpers";
import ScheduleModal from "@/components/invoices/schedule-modal";
import { getClientInvoiceScheduleWithDates } from "@/lib/services/invoice-service";
import { generateScheduleExcel } from "@/lib/helpers/invoices/generate-schedule-excel";

export default function EndorsementPage() {
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceLineItem[] | null>(
    null,
  );
  const [receiptHistory, setReceiptHistory] =
    useState<InvoiceReceiptHistory | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [previewData, setPreviewData] = useState<{ grandTotal: number } | null>(
    null,
  );

  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isGeneratingScheduleExcel, setIsGeneratingScheduleExcel] =
    useState(false);
  const [scheduleData, setScheduleData] = useState<
    InvoiceScheduleItem[] | null
  >(null);

  // Separate date pickers — fromDate cannot be future
  const todayDate = parseDate(new Date().toISOString().split("T")[0]);
  const [fromDate, setFromDate] = useState<DateValue>(todayDate);
  const [toDate, setToDate] = useState<DateValue>(todayDate);

  const invoiceRef = useRef<HTMLDivElement>(null);

  const [editableAccountName, setEditableAccountName] = useState("");
  const [editableBankName, setEditableBankName] = useState("");
  const [editableBankAccount, setEditableBankAccount] = useState("");

  // Load companies on mount
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

  // Format CalendarDate → "YYYY-MM-DD"
  const formatDate = (calDate: any): string => {
    const y = calDate.year;
    const m = String(calDate.month).padStart(2, "0");
    const d = String(calDate.day).padStart(2, "0");

    return `${y}-${m}-${d}`;
  };

  const handleFetchInvoice = async () => {
    if (!selectedCompany) {
      toast.error("Please select a company");

      return;
    }
    if (!fromDate || !toDate) {
      toast.error("Please select a date range");

      return;
    }

    const fromDateStr = formatDate(fromDate);
    const todayStr = new Date().toISOString().split("T")[0];

    if (fromDateStr > todayStr) {
      toast.error("From date cannot be a future date");

      return;
    }

    const toDateStr = formatDate(toDate);

    if (toDateStr < fromDateStr) {
      toast.error("To date cannot be earlier than from date");

      return;
    }

    setIsLoadingInvoice(true);
    setInvoiceData(null);
    setReceiptHistory(null);

    try {
      const groupId = parseInt(selectedCompany);

      const [data, history] = await Promise.all([
        getClientInvoiceEndorsement(selectedCompany, fromDateStr, toDateStr),
        getInvoiceReceiptHistory(selectedCompany),
      ]);

      const grandTotal = data.reduce((sum, item) => sum + item.TotalPremium, 0);
      const receiptNumber = generateInvoiceRefNo(groupId);

      setInvoiceData(data);
      setEditableAccountName(data[0]?.AccName || "");
      setEditableBankName(data[0]?.BankName || "");
      setEditableBankAccount(data[0]?.BankAcc || "");
      setPreviewData({ grandTotal });
      setReceiptHistory({
        Success: 1,
        Message: "Endorsement invoice preview",
        HasOutstanding: history?.HasOutstanding ?? 0,
        TotalAmount: grandTotal,
        AmountPaid: history?.AmountPaid ?? 0,
        OutstandingBalance: history?.OutstandingBalance ?? grandTotal,
        NextDue: history?.NextDue ?? null,
        NextDueAmount: history?.NextDueAmount ?? grandTotal,
        Frequency: history?.Frequency ?? "Monthly",
        originalReceiptNumber: history?.ReceiptNumber || receiptNumber,
        ReceiptNumber: receiptNumber,
        ExistingDownloaded: history?.ExistingDownloaded ?? 0,
        ReceiptCount: history?.ReceiptCount ?? 0,
        ReceiptTotalAmount: history?.ReceiptTotalAmount ?? 0,
      });

      toast.success("Endorsement invoice loaded successfully");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current || !invoiceData || !receiptHistory) return;

    setIsGeneratingPDF(true);
    try {
      const groupId = parseInt(selectedCompany);

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
        ISENDORSED: 1,
      });

      await generateInvoicePDF(
        invoiceRef.current,
        receiptHistory.ReceiptNumber || "",
      );
      toast.success("Endorsement invoice downloaded successfully");
    } catch (error) {
      toast.error("Failed to download PDF: " + (error as Error).message);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleViewSchedule = async () => {
    if (!selectedCompany) return;

    setIsLoadingSchedule(true);
    setIsScheduleModalOpen(true);
    try {
      const data = await getClientInvoiceScheduleWithDates(
        selectedCompany,
        formatDate(fromDate),
        formatDate(toDate),
      );

      setScheduleData(data);
    } catch (error) {
      toast.error("Failed to load schedule: " + (error as Error).message);
      setIsScheduleModalOpen(false);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const handleCloseScheduleModal = () => {
    setIsScheduleModalOpen(false);
    setScheduleData(null);
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

  const grandTotal = invoiceData
    ? invoiceData.reduce((sum, item) => sum + item.TotalPremium, 0)
    : 0;

  const amountDueToday = receiptHistory?.NextDueAmount || 0;
  const paid = receiptHistory?.AmountPaid || 0;
  const remaining = receiptHistory?.OutstandingBalance || grandTotal;
  const existingTotalAmount = receiptHistory?.TotalAmount || grandTotal;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Endorsement</h1>
        <p className="text-gray-600">
          Generate and download endorsement invoices by date range
        </p>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 gap-4">
          {/* Company + From Date + To Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* From Date — future dates blocked via validation on submit */}
            <DatePicker
              className="w-full"
              label="From Date"
              radius="sm"
              value={fromDate}
              onChange={(val) => {
                if (val) setFromDate(val);
              }}
            />

            {/* To Date — no upper limit */}
            <DatePicker
              className="w-full"
              label="To Date"
              radius="sm"
              value={toDate}
              onChange={(val) => {
                if (val) setToDate(val);
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <>
              <Button
                className="bg-[#F15A24] text-white font-semibold"
                isDisabled={
                  !selectedCompany || !fromDate || !toDate || isLoadingInvoice
                }
                isLoading={isLoadingInvoice}
                radius="sm"
                onPress={handleFetchInvoice}
              >
                Generate Invoice
              </Button>

              {invoiceData && receiptHistory && (
                <Button
                  className="bg-green-600 text-white font-semibold"
                  isDisabled={isGeneratingPDF}
                  isLoading={isGeneratingPDF}
                  radius="sm"
                  startContent={!isGeneratingPDF && <DownloadIcon />}
                  onPress={handleDownloadPDF}
                >
                  Download PDF
                </Button>
              )}
            </>

            <Button
              className="bg-purple-600 text-white font-semibold"
              isDisabled={!selectedCompany}
              radius="sm"
              onPress={handleViewSchedule}
            >
              View Schedule
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Details Card */}
      {invoiceData && receiptHistory && !isLoadingInvoice && (
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">
            Payment Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <p className="text-sm text-gray-600 mb-1">
                Amount Due ({receiptHistory.Frequency})
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
                {existingTotalAmount.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoadingInvoice && (
        <div className="text-center">
          <Spinner color="warning" />
        </div>
      )}

      <ScheduleModal
        isDownloading={isGeneratingScheduleExcel}
        isLoading={isLoadingSchedule}
        isOpen={isScheduleModalOpen}
        scheduleData={scheduleData}
        onClose={handleCloseScheduleModal}
        onDownloadExcel={handleDownloadScheduleExcel}
      />

      {invoiceData && receiptHistory && !isLoadingInvoice && (
        <InvoicePDF
          amountDueToday={amountDueToday}
          editableAccountName={editableAccountName}
          editableBankAccount={editableBankAccount}
          editableBankName={editableBankName}
          excludeNegative={false}
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
            {` Select a company and date range, then click "Generate Invoice" to
            get started`}
          </p>
        </div>
      )}
    </>
  );
}
