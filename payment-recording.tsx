import { useState, useRef } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import toast from "react-hot-toast";
import { useChunkValue } from "stunk/react";

import { CompanyGroup, getCompanyGroups } from "@/lib/services/lists-service";
import {
  getInvoiceReceiptHistoryDetails,
  insertInvoicePayment,
  deleteReceiptNumber,
  canDeleteReceipts,
  InvoiceReceiptHistoryDetail,
} from "@/lib/services/payment-rec-service";
import { authStore } from "@/lib/store/auth";
import { fileToBase64 } from "@/lib/helpers";
import { sendPaymentEmail } from "@/lib/services/send-payment-email";
import { DeleteIcon } from "@/components/icons";

export default function PaymentRecordingPage() {
  const authState = useChunkValue(authStore);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("");

  // Receipt number parts
  const [receiptLastPart, setReceiptLastPart] = useState("");

  // Payment form
  const [transactionId, setTransactionId] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  // History modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<
    InvoiceReceiptHistoryDetail[]
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Delete state
  const [deletingReceiptId, setDeletingReceiptId] = useState<number | null>(
    null,
  );
  const [confirmDeleteItem, setConfirmDeleteItem] =
    useState<InvoiceReceiptHistoryDetail | null>(null);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive delete permission from logged-in user's email
  const userEmail = authState.user?.Email ?? "";
  const allowDelete = canDeleteReceipts(userEmail);

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

  // Build full receipt number
  const getFullReceiptNumber = (): string => {
    if (!selectedCompany || !receiptLastPart) return "";

    return `LWH/INV/${selectedCompany}/${receiptLastPart}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      const validTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/pdf",
      ];

      if (!validTypes.includes(file.type)) {
        toast.error("Please upload a JPEG, PNG, or PDF file");

        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");

        return;
      }

      setEvidenceFile(file);
    }
  };

  const handleViewHistory = async () => {
    if (!selectedCompany) {
      toast.error("Please select a company");

      return;
    }

    const fullReceiptNumber = getFullReceiptNumber();

    if (!fullReceiptNumber) {
      toast.error("Please enter complete receipt number");

      return;
    }

    setIsLoadingHistory(true);
    setIsHistoryModalOpen(true);

    try {
      const history = await getInvoiceReceiptHistoryDetails(
        parseInt(selectedCompany),
        fullReceiptNumber,
        transactionId || undefined,
      );

      setPaymentHistory(history);

      if (history.length === 0) {
        toast.success("No payment history found for this receipt");
      }
    } catch (error) {
      toast.error((error as Error).message);
      setIsHistoryModalOpen(false);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteItem) return;

    setDeletingReceiptId(confirmDeleteItem.id);
    try {
      if (confirmDeleteItem.AmountPaid > 0) {
        toast.error("Cannot delete receipt with recorded payment amount");

        return;
      }
      await deleteReceiptNumber(confirmDeleteItem.ReceiptNumber);
      toast.success(
        `Receipt ${confirmDeleteItem.ReceiptNumber} deleted successfully`,
      );
      setPaymentHistory((prev) =>
        prev.filter((p) => p.id !== confirmDeleteItem.id),
      );
      setConfirmDeleteItem(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDeletingReceiptId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCompany) {
      toast.error("Please select a company");

      return;
    }

    const fullReceiptNumber = getFullReceiptNumber();

    if (!fullReceiptNumber) {
      toast.error("Please enter complete receipt number");

      return;
    }

    if (!transactionId.trim()) {
      toast.error("Please enter transaction ID");

      return;
    }

    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      toast.error("Please enter a valid amount");

      return;
    }

    setIsSubmitting(true);

    try {
      let evidenceBase64 = "";

      if (evidenceFile) {
        evidenceBase64 = await fileToBase64(evidenceFile);
      }

      const payload = {
        TransactionId: transactionId,
        InputtedBy: authState.user?.UserName || "Unknown",
        ReceiptNumber: fullReceiptNumber,
        AmountPaid: parseFloat(amountPaid),
        NextDue: null,
        IsEvidenceUpload: evidenceFile ? 1 : 0,
        GroupId: parseInt(selectedCompany),
      };

      const result = await insertInvoicePayment(payload);

      if (result.status === 200 && result.result.Success) {
        toast.success("Payment recorded successfully!");

        const selectedCompanyData = companies.find(
          (c) => c.GROUP_ID.toString() === selectedCompany,
        );

        await sendPaymentEmail({
          transactionId: transactionId,
          receiptNumber: fullReceiptNumber,
          amountPaid: parseFloat(amountPaid),
          groupId: parseInt(selectedCompany),
          companyName: selectedCompanyData?.GROUP_NAME || "Unknown Company",
          evidenceFile: evidenceFile,
          evidenceBase64: evidenceBase64,
        });

        setReceiptLastPart("");
        setTransactionId("");
        setAmountPaid("");
        setEvidenceFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fullReceiptNumber = getFullReceiptNumber();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Record Invoice Payment
        </h1>
        <p className="text-gray-600">
          Record payments made against invoices by uploading proof of payment
        </p>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 mb-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Company Selection */}
            <Autocomplete
              isRequired
              className="w-full"
              defaultItems={companies}
              isLoading={isLoadingCompanies}
              label="Select Company"
              placeholder="Search or select company"
              radius="sm"
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

            {/* Receipt Number Builder */}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">
                Receipt Number
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1 bg-gray-50 rounded-lg p-3 border-2 border-gray-200">
                  <span className="text-gray-600 font-medium">LWH/INV/</span>
                  {selectedCompany && (
                    <span className="text-orange-600 font-bold">
                      {selectedCompany}/
                    </span>
                  )}
                  <Input
                    isRequired
                    className="flex-1"
                    placeholder="001"
                    radius="sm"
                    size="sm"
                    value={receiptLastPart}
                    variant="underlined"
                    onChange={(e) => setReceiptLastPart(e.target.value)}
                  />
                </div>

                <Button
                  className="bg-purple-600 text-white font-semibold"
                  isDisabled={!fullReceiptNumber}
                  onPress={handleViewHistory}
                >
                  View History
                </Button>
              </div>
              {fullReceiptNumber && (
                <p className="text-sm text-gray-600 mt-2">
                  Full Receipt:{" "}
                  <span className="font-semibold text-orange-600">
                    {fullReceiptNumber}
                  </span>
                </p>
              )}
            </div>

            {/* Transaction ID and Amount Paid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                isRequired
                label="Transaction ID"
                placeholder="TXN-20260214-001"
                radius="sm"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />

              <Input
                isRequired
                label="Amount Paid (₦)"
                min="0"
                placeholder="5000.00"
                radius="sm"
                step="0.01"
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>

            {/* Evidence Upload */}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">
                Payment Evidence (Optional)
              </p>
              <input
                ref={fileInputRef}
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                type="file"
                onChange={handleFileChange}
              />
              {evidenceFile && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ {evidenceFile.name} ({(evidenceFile.size / 1024).toFixed(2)}{" "}
                  KB)
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Supported: JPEG, PNG, PDF (Max 5MB)
              </p>
            </div>

            {/* Submit Button */}
            <Button
              className="bg-[#F15A24] text-white font-semibold"
              isLoading={isSubmitting}
              type="submit"
            >
              Record Payment
            </Button>
          </div>
        </form>
      </div>

      {/* Payment History Modal */}
      <Modal
        backdrop="blur"
        isDismissable={false}
        isOpen={isHistoryModalOpen}
        scrollBehavior="inside"
        size="3xl"
        onClose={() => setIsHistoryModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-semibold">Payment History</h2>
          </ModalHeader>
          <ModalBody>
            {isLoadingHistory ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading payment history...</p>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No payment records found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentHistory.map((payment) => (
                  <div
                    key={payment.id}
                    className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200"
                  >
                    {/* Card header: receipt number + delete button */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded">
                        {payment.ReceiptNumber}
                      </span>

                      {allowDelete && (
                        <Button
                          isIconOnly
                          className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 min-w-unit-8 w-8 h-8"
                          isDisabled={deletingReceiptId === payment.id}
                          isLoading={deletingReceiptId === payment.id}
                          radius="sm"
                          size="sm"
                          title={`Delete receipt ${payment.ReceiptNumber}`}
                          variant="flat"
                          onPress={() => setConfirmDeleteItem(payment)}
                        >
                          {deletingReceiptId !== payment.id && <DeleteIcon />}
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">Transaction ID</p>
                        <p className="font-semibold">{payment.TransactionId}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Amount Paid</p>
                        <p className="font-semibold text-green-700">
                          ₦
                          {payment.AmountPaid.toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Next Due</p>
                        <p className="font-semibold">
                          {payment.NextDue
                            ? new Date(payment.NextDue).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Recorded By</p>
                        <p className="font-semibold">{payment.InputtedBy}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Recorded On</p>
                        <p className="font-semibold">{payment.InputtedOn}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Parent Next Due</p>
                        <p className="font-semibold">
                          {payment.ParentNextDue
                            ? new Date(
                                payment.ParentNextDue,
                              ).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Evidence</p>
                        <p className="font-semibold">
                          {payment.IsEvidenceUpload ? (
                            <span className="text-green-600">✓ Uploaded</span>
                          ) : (
                            <span className="text-gray-400">Not uploaded</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              size="sm"
              onPress={() => setIsHistoryModalOpen(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        backdrop="blur"
        isOpen={!!confirmDeleteItem}
        placement="center"
        size="sm"
        onClose={() => !deletingReceiptId && setConfirmDeleteItem(null)}
      >
        <ModalContent>
          <ModalHeader className="text-red-600">Delete Receipt</ModalHeader>
          <ModalBody>
            <p className="text-gray-700">
              Are you sure you want to delete receipt{" "}
              <span className="font-semibold text-gray-900">
                {confirmDeleteItem?.ReceiptNumber}
              </span>
              ?
            </p>
            <p className="text-sm text-gray-500 mt-1">
              This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              className="font-semibold"
              isDisabled={!!deletingReceiptId}
              variant="flat"
              onPress={() => setConfirmDeleteItem(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white font-semibold"
              isLoading={!!deletingReceiptId}
              onPress={handleConfirmDelete}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
