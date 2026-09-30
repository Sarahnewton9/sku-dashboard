import * as XLSX from "xlsx";

export type ExportEmailAttachment = { filename: string; base64: string };

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The export attachment could not be prepared."));
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== "string") return reject(new Error("The export attachment could not be prepared."));
      resolve(value.split(",", 2)[1] ?? "");
    };
    reader.readAsDataURL(blob);
  });
}

export async function workbookToEmailAttachment(workbook: XLSX.WorkBook, filename: string): Promise<ExportEmailAttachment> {
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return {
    filename,
    base64: await blobToBase64(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })),
  };
}

export async function csvToEmailAttachment(csv: string, filename: string): Promise<ExportEmailAttachment> {
  return {
    filename,
    base64: await blobToBase64(new Blob([csv], { type: "text/csv;charset=utf-8" })),
  };
}
