import { useRef, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { useChunkValue } from "stunk/react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

import { authStore } from "@/lib/store/auth";
import {
  terminateUsers,
  TerminationResult,
} from "@/lib/services/termination-service";
import {
  DeleteIcon,
  DownloadIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/icons";

const uid = () => Math.random().toString(36).slice(2, 9);

const statusChip = (status: TerminationResult["status"]) => {
  const map = {
    pending: { color: "warning", label: "Pending" },
    success: { color: "success", label: "Success" },
    failed: { color: "danger", label: "Failed" },
  } as const;
  const s = map[status];

  return (
    <Chip color={s.color} size="sm" variant="flat">
      {s.label}
    </Chip>
  );
};

type ManualRow = Omit<TerminationResult, "TerminatedBy">;

const emptyRow = (): ManualRow => ({
  id: uid(),
  EnrolleeId: "",
  FirstName: "",
  LastName: "",
  TermReason: "",
  status: "pending",
});

export default function TerminationPage() {
  const { user } = useChunkValue(authStore);
  const terminatedBy = String(user?.User_id ?? "");

  const [manualRows, setManualRows] = useState<ManualRow[]>([emptyRow()]);
  const [bulkRows, setBulkRows] = useState<TerminationResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateManualRow = (id: string, field: string, value: string) =>
    setManualRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );

  const addManualRow = () => setManualRows((prev) => [...prev, emptyRow()]);

  const removeManualRow = (id: string) =>
    setManualRows((prev) => prev.filter((r) => r.id !== id));

  const handleSubmitManual = async () => {
    const invalid = manualRows.find(
      (r) => !r.EnrolleeId.trim() || !r.TermReason.trim(),
    );

    if (invalid) {
      toast.error(
        "Enrollee ID and Termination Reason are required for every row.",
      );

      return;
    }

    setIsSubmittingManual(true);
    try {
      const payload = manualRows.map((r) => ({
        EnrolleeId: r.EnrolleeId.trim(),
        TerminatedBy: terminatedBy,
        FirstName: r.FirstName.trim(),
        LastName: r.LastName.trim(),
        TermReason: r.TermReason.trim(),
      }));

      const res = await terminateUsers(payload);
      const allItems = [
        ...(res.result?.Succeeded ?? []),
        ...(res.result?.Failed ?? []),
      ];

      setManualRows((prev) =>
        prev.map((r) => {
          const item = allItems.find((s) => s.EnrolleeId === r.EnrolleeId);
          const dataEntry = item?.Data?.[0];
          const isError = !item || dataEntry?.Status === "ERROR";

          return {
            ...r,
            status: isError ? ("failed" as const) : ("success" as const),
            errorMessage: isError
              ? (dataEntry?.Message ?? "Unknown error")
              : undefined,
          };
        }),
      );

      const failCount = manualRows.filter((r) => {
        const item = allItems.find((s) => s.EnrolleeId === r.EnrolleeId);

        return !item || item.Data?.[0]?.Status === "ERROR";
      }).length;
      const successCount = manualRows.length - failCount;

      if (failCount === 0) {
        toast.success(`${successCount} enrollee(s) terminated successfully.`);
        setManualRows([emptyRow()]);
      } else if (successCount === 0) {
        const firstFailed = allItems.find(
          (item) => item.Data?.[0]?.Status === "ERROR",
        );
        const msg = firstFailed?.Data?.[0]?.Message ?? "Termination failed.";

        toast.error(msg);
      } else {
        toast.success(`${successCount} succeeded, ${failCount} failed.`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["EnrolleeId", "FirstName", "LastName", "TermReason"],
      ["12345/01", "John", "Doe", "Resigned"],
    ]);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Terminations");
    XLSX.writeFile(wb, "Termination_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;
    setIsUploading(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
        defval: "",
      });

      if (raw.length === 0) {
        toast.error("Excel file is empty.");

        return;
      }

      const rows: TerminationResult[] = raw.map((r) => ({
        id: uid(),
        EnrolleeId:
          r["EnrolleeId"] || r["enrolleeid"] || r["Enrollee Id"] || "",
        TerminatedBy: terminatedBy,
        FirstName: r["FirstName"] || r["firstname"] || r["First Name"] || "",
        LastName: r["LastName"] || r["lastname"] || r["Last Name"] || "",
        TermReason:
          r["TermReason"] ||
          r["termreason"] ||
          r["Term Reason"] ||
          r["Reason"] ||
          "",
        status: "pending",
      }));

      const missing = rows.filter(
        (r) => !r.EnrolleeId || !r.FirstName || !r.LastName || !r.TermReason,
      );

      if (missing.length > 0) {
        toast.error(
          `${missing.length} row(s) are missing required fields. Please fix the Excel file.`,
        );
        setBulkRows(rows);

        return;
      }

      setBulkRows(rows);
      toast.success(`${rows.length} row(s) loaded from Excel.`);
    } catch (err) {
      toast.error("Failed to parse Excel: " + (err as Error).message);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmitBulk = async () => {
    const valid = bulkRows.filter(
      (r) => r.EnrolleeId && r.FirstName && r.LastName && r.TermReason,
    );

    if (valid.length === 0) {
      toast.error("No valid rows to submit.");

      return;
    }

    setIsSubmittingBulk(true);

    let successCount = 0;
    let failCount = 0;
    let collectedErrors: string[] = [];

    const BATCH = 20;

    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH);

      const payload = batch.map((r) => ({
        EnrolleeId: r.EnrolleeId,
        TerminatedBy: terminatedBy,
        FirstName: r.FirstName,
        LastName: r.LastName,
        TermReason: r.TermReason,
      }));

      try {
        const res = await terminateUsers(payload);

        const allItems = [
          ...(res.result?.Succeeded ?? []),
          ...(res.result?.Failed ?? []),
        ];

        setBulkRows((prev) =>
          prev.map((r) => {
            const inBatch = batch.find((b) => b.id === r.id);

            if (!inBatch) return r;

            const item = allItems.find(
              (s) => String(s.EnrolleeId) === String(r.EnrolleeId),
            );

            if (!item) {
              failCount++;
              collectedErrors.push(
                `No API response for Enrollee ID ${r.EnrolleeId}`,
              );

              return {
                ...r,
                status: "failed" as const,
                errorMessage: "No API response returned for this ID",
              };
            }

            const errorEntry = item.Data?.find((d) => d.Status === "ERROR");

            if (errorEntry) {
              failCount++;
              collectedErrors.push(errorEntry.Message);

              return {
                ...r,
                status: "failed" as const,
                errorMessage: errorEntry.Message,
              };
            }

            successCount++;

            return {
              ...r,
              status: "success" as const,
              errorMessage: undefined,
            };
          }),
        );
      } catch (err) {
        failCount += batch.length;

        batch.forEach(() => collectedErrors.push((err as Error).message));

        setBulkRows((prev) =>
          prev.map((r) => {
            const inBatch = batch.find((b) => b.id === r.id);

            if (!inBatch) return r;

            return {
              ...r,
              status: "failed" as const,
              errorMessage: (err as Error).message,
            };
          }),
        );
      }
    }

    exportBulkResults();

    if (failCount === 0) {
      exportBulkResults();
      toast.success(`${successCount} enrollee(s) terminated successfully.`);
      setBulkRows([]);
    } else if (successCount === 0) {
      toast.error(collectedErrors.join("\n"));
    } else {
      toast.success(`Done — Success: ${successCount}, Failed: ${failCount}`);
    }

    setIsSubmittingBulk(false);
  };

  const exportBulkResults = () => {
    const rows = bulkRows.map((r) => ({
      EnrolleeId: r.EnrolleeId,
      FirstName: r.FirstName,
      LastName: r.LastName,
      TermReason: r.TermReason,
      TerminatedBy: r.TerminatedBy,
      Status: r.status,
      Error: r.errorMessage || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(
      wb,
      `Termination_Results_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Termination</h1>
        <p className="text-gray-600">
          Terminate enrollees manually or via bulk Excel upload
        </p>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-700">Manual Entry</h2>
          <Chip color="default" size="sm" variant="flat">
            Terminated By:&nbsp;<strong>{terminatedBy || "—"}</strong>
          </Chip>
        </div>

        <Table
          aria-label="Manual termination entries"
          classNames={{
            wrapper: "shadow-none p-0 border border-gray-200 rounded-xl",
          }}
        >
          <TableHeader>
            <TableColumn>ENROLLEE ID</TableColumn>
            <TableColumn>FIRST NAME</TableColumn>
            <TableColumn>LAST NAME</TableColumn>
            <TableColumn>REASON *</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn> </TableColumn>
          </TableHeader>
          <TableBody>
            {manualRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Input
                    classNames={{
                      inputWrapper: "shadow-none border border-gray-200 h-9",
                    }}
                    placeholder="e.g. 12345/01"
                    radius="sm"
                    size="sm"
                    value={row.EnrolleeId}
                    onChange={(e) =>
                      updateManualRow(row.id, "EnrolleeId", e.target.value)
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    classNames={{
                      inputWrapper: "shadow-none border border-gray-200 h-9",
                    }}
                    placeholder="First name"
                    radius="sm"
                    size="sm"
                    value={row.FirstName}
                    onChange={(e) =>
                      updateManualRow(row.id, "FirstName", e.target.value)
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    classNames={{
                      inputWrapper: "shadow-none border border-gray-200 h-9",
                    }}
                    placeholder="Last name"
                    radius="sm"
                    size="sm"
                    value={row.LastName}
                    onChange={(e) =>
                      updateManualRow(row.id, "LastName", e.target.value)
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    classNames={{
                      inputWrapper: "shadow-none border border-gray-200 h-9",
                    }}
                    placeholder="Reason for termination"
                    radius="sm"
                    size="sm"
                    value={row.TermReason}
                    onChange={(e) =>
                      updateManualRow(row.id, "TermReason", e.target.value)
                    }
                  />
                </TableCell>
                <TableCell>{statusChip(row.status)}</TableCell>
                <TableCell>
                  <Button
                    isIconOnly
                    className="text-red-500"
                    isDisabled={manualRows.length === 1}
                    radius="sm"
                    size="sm"
                    variant="light"
                    onPress={() => removeManualRow(row.id)}
                  >
                    <DeleteIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex gap-3 flex-wrap mt-4">
          <Button
            radius="sm"
            size="sm"
            variant="bordered"
            onPress={addManualRow}
          >
            + Add Row
          </Button>
          <Button
            className="bg-[#C44915] text-white font-semibold"
            isDisabled={isSubmittingManual}
            isLoading={isSubmittingManual}
            radius="sm"
            size="sm"
            onPress={handleSubmitManual}
          >
            Submit Terminations
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-5">
          Bulk Upload via Excel
        </h2>

        <div className="flex flex-wrap gap-3 mb-4">
          <Button
            className="bg-green-600 text-white font-semibold"
            radius="sm"
            size="sm"
            startContent={<DownloadIcon />}
            onPress={downloadTemplate}
          >
            Download Template
          </Button>
          <Button
            className="bg-blue-600 text-white font-semibold"
            isLoading={isUploading}
            radius="sm"
            size="sm"
            startContent={!isUploading && <UploadIcon className="h-5 w-5" />}
            onPress={() => fileInputRef.current?.click()}
          >
            Upload Excel
          </Button>
          <input
            ref={fileInputRef}
            accept=".xlsx,.xls"
            className="hidden"
            type="file"
            onChange={handleFileUpload}
          />
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 items-center mb-5">
          <WarningIcon className="text-amber-800 h-4 w-4" />
          <p className="text-[13px] text-amber-800 mb-0">
            Excel must have columns:{" "}
            <strong>EnrolleeId, FirstName, LastName, TermReason</strong>.
            Download the template to get started.
          </p>
        </div>

        {bulkRows.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">
                {bulkRows.length} row(s) loaded
              </span>
              <div className="flex gap-2">
                <Button
                  radius="sm"
                  size="sm"
                  startContent={<DownloadIcon />}
                  variant="bordered"
                  onPress={exportBulkResults}
                >
                  Export Results
                </Button>
                <Button
                  className="bg-red-500 text-white font-semibold"
                  radius="sm"
                  size="sm"
                  startContent={<DeleteIcon />}
                  onPress={() => setBulkRows([])}
                >
                  Clear
                </Button>
                <Button
                  className="bg-[#C44915] text-white font-semibold"
                  isDisabled={isSubmittingBulk}
                  isLoading={isSubmittingBulk}
                  radius="sm"
                  size="sm"
                  onPress={handleSubmitBulk}
                >
                  Submit All
                </Button>
              </div>
            </div>

            <Table
              aria-label="Bulk termination rows"
              classNames={{
                wrapper: "shadow-none border border-gray-200 rounded-xl",
              }}
            >
              <TableHeader>
                <TableColumn>#</TableColumn>
                <TableColumn>ENROLLEE ID</TableColumn>
                <TableColumn>FIRST NAME</TableColumn>
                <TableColumn>LAST NAME</TableColumn>
                <TableColumn>REASON</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ERROR</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent="No rows loaded"
                loadingContent={<Spinner size="sm" />}
              >
                {bulkRows.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="text-xs text-gray-400">{idx + 1}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-sm">
                        {row.EnrolleeId}
                      </span>
                    </TableCell>
                    <TableCell>{row.FirstName}</TableCell>
                    <TableCell>{row.LastName}</TableCell>
                    <TableCell>
                      <span
                        className="text-sm block"
                        style={{
                          maxWidth: "200px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.TermReason}
                      </span>
                    </TableCell>
                    <TableCell>{statusChip(row.status)}</TableCell>
                    <TableCell>
                      <span className="text-xs text-red-500">
                        {row.errorMessage || "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-400">
              No data yet — upload an Excel file to preview rows here
            </p>
          </div>
        )}
      </div>
    </>
  );
}
