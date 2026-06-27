import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function generateInvoicePDF(
  invoiceRef: HTMLDivElement,
  refNo: string
): Promise<void> {
  if (!invoiceRef) {
    throw new Error("Invoice reference not found");
  }

  const canvas = await html2canvas(invoiceRef, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: invoiceRef.scrollWidth,
    windowHeight: invoiceRef.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.85);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Calculate how many pages we need
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= pdfHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pdfHeight;
  }

  pdf.save(`Invoice_${refNo.replace(/\//g, "_")}.pdf`);
}
