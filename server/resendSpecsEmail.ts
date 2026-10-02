import { Resend } from "resend";

const DEFAULT_FROM = "Tony Bianco Reports <reports@tonybianco.info>";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MIME = "text/csv";
const MAX_EMAIL_ATTACHMENT_BYTES = 30 * 1024 * 1024;

type EmailAttachment = {
  filename: string;
  base64: string;
  contentType?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getResendSpecsEmailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
  return {
    apiKey,
    from,
    enabled: process.env.DISABLE_EMAIL !== "true" && apiKey.length > 0,
  };
}

export function buildSpecsEmailHtml(input: {
  style: string;
  last: string;
  category: string;
  season: string;
  message?: string;
  additionalAttachmentCount?: number;
}): string {
  const optionalMessage = input.message?.trim()
    ? `<div style="margin:0 0 20px;padding:12px 16px;background:#f8f3e9;border-left:3px solid #9a621d;border-radius:4px;font-size:14px;color:#3b2a1b;white-space:pre-wrap">${escapeHtml(input.message.trim())}</div>`
    : "";
  const additionalAttachmentNote = input.additionalAttachmentCount
    ? `<p style="font-size:14px;line-height:1.55;margin:0 0 16px">${input.additionalAttachmentCount} additional file${input.additionalAttachmentCount === 1 ? "" : "s"} ${input.additionalAttachmentCount === 1 ? "is" : "are"} included with this specification sheet.</p>`
    : "";

  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:28px 24px;color:#21120d">
  <div style="border-bottom:2px solid #21120d;padding-bottom:14px;margin-bottom:20px">
    <p style="font-size:11px;letter-spacing:1.8px;font-weight:700;margin:0 0 7px">TONY BIANCO</p>
    <h1 style="font-size:22px;line-height:1.2;margin:0">Product specification sheet</h1>
  </div>
  ${optionalMessage}
  <p style="font-size:14px;line-height:1.55;margin:0 0 16px">The attached Excel file contains the current specification sheet for <strong>${escapeHtml(input.style.toUpperCase())}</strong>.</p>
  ${additionalAttachmentNote}
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 20px">
    <tr><td style="padding:8px 0;border-top:1px solid #e5ded3;font-weight:700;width:110px">STYLE</td><td style="padding:8px 0;border-top:1px solid #e5ded3">${escapeHtml(input.style.toUpperCase())}</td></tr>
    <tr><td style="padding:8px 0;border-top:1px solid #e5ded3;font-weight:700">LAST</td><td style="padding:8px 0;border-top:1px solid #e5ded3">${escapeHtml(input.last.toUpperCase())}</td></tr>
    <tr><td style="padding:8px 0;border-top:1px solid #e5ded3;font-weight:700">CATEGORY</td><td style="padding:8px 0;border-top:1px solid #e5ded3">${escapeHtml(input.category)}</td></tr>
    <tr><td style="padding:8px 0;border-top:1px solid #e5ded3;font-weight:700">SEASON</td><td style="padding:8px 0;border-top:1px solid #e5ded3">${escapeHtml(input.season)}</td></tr>
  </table>
  <p style="font-size:12px;line-height:1.45;color:#6e6257;margin:0">This email and attachment were sent from SKU Dash.</p>
</div>`;
}

export function buildDashboardExportEmailHtml(input: {
  exportType: string;
  exportScope: string;
  season: string;
  message?: string;
}): string {
  const optionalMessage = input.message?.trim()
    ? `<div style="margin:0 0 20px;padding:12px 16px;background:#f8f3e9;border-left:3px solid #9a621d;border-radius:4px;font-size:14px;color:#3b2a1b;white-space:pre-wrap">${escapeHtml(input.message.trim())}</div>`
    : "";

  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:28px 24px;color:#21120d">
  <div style="border-bottom:2px solid #21120d;padding-bottom:14px;margin-bottom:20px">
    <p style="font-size:11px;letter-spacing:1.8px;font-weight:700;margin:0 0 7px">TONY BIANCO</p>
    <h1 style="font-size:22px;line-height:1.2;margin:0">${escapeHtml(input.exportType)}</h1>
  </div>
  ${optionalMessage}
  <p style="font-size:14px;line-height:1.55;margin:0 0 16px">The attached file contains the current <strong>${escapeHtml(input.exportType)}</strong> from SKU Dash.</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 20px">
    <tr><td style="padding:8px 0;border-top:1px solid #e5ded3;font-weight:700;width:110px">REPORT</td><td style="padding:8px 0;border-top:1px solid #e5ded3">${escapeHtml(input.exportType)}</td></tr>
    <tr><td style="padding:8px 0;border-top:1px solid #e5ded3;font-weight:700">SCOPE</td><td style="padding:8px 0;border-top:1px solid #e5ded3">${escapeHtml(input.exportScope)}</td></tr>
    <tr><td style="padding:8px 0;border-top:1px solid #e5ded3;font-weight:700">SEASON</td><td style="padding:8px 0;border-top:1px solid #e5ded3">${escapeHtml(input.season)}</td></tr>
  </table>
  <p style="font-size:12px;line-height:1.45;color:#6e6257;margin:0">This email and attachment were sent from SKU Dash.</p>
</div>`;
}

export async function sendSpecsEmail(input: {
  recipients: string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  message?: string;
  style: string;
  last: string;
  category: string;
  season: string;
  attachment: EmailAttachment;
  additionalAttachments?: EmailAttachment[];
}): Promise<{ id: string | undefined }> {
  const config = getResendSpecsEmailConfiguration();
  if (!config.enabled) {
    throw new Error("Email is not configured. Add the Resend API key in the project secrets before sending.");
  }

  const workbookContent = Buffer.from(input.attachment.base64, "base64");
  if (workbookContent.length === 0) {
    throw new Error("The Specs attachment could not be prepared.");
  }
  const additionalAttachments = (input.additionalAttachments ?? []).map((attachment) => ({
    filename: attachment.filename,
    content: Buffer.from(attachment.base64, "base64"),
    contentType: attachment.contentType?.trim() || "application/octet-stream",
  }));
  if (additionalAttachments.some((attachment) => attachment.content.length === 0)) {
    throw new Error("One of the additional attachments could not be prepared.");
  }
  const totalAttachmentBytes = workbookContent.length
    + additionalAttachments.reduce((total, attachment) => total + attachment.content.length, 0);
  if (totalAttachmentBytes > MAX_EMAIL_ATTACHMENT_BYTES) {
    throw new Error("The combined email attachments are too large to send. Keep them under 30 MB in total.");
  }

  const resend = new Resend(config.apiKey);
  const { data, error } = await resend.emails.send({
    from: config.from,
    to: input.recipients,
    cc: input.cc?.length ? input.cc : undefined,
    replyTo: input.replyTo?.trim() || undefined,
    subject: input.subject,
    html: buildSpecsEmailHtml({ ...input, additionalAttachmentCount: additionalAttachments.length }),
    attachments: [{
      filename: input.attachment.filename,
      content: workbookContent,
      contentType: XLSX_MIME,
    }, ...additionalAttachments],
  });

  if (error) {
    throw new Error(`Resend delivery failed: ${error.message}`);
  }
  return { id: data?.id };
}

export async function sendDashboardExportEmail(input: {
  recipients: string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  message?: string;
  exportType: string;
  exportScope: string;
  season: string;
  attachment: { filename: string; base64: string };
}): Promise<{ id: string | undefined }> {
  const config = getResendSpecsEmailConfiguration();
  if (!config.enabled) {
    throw new Error("Email is not configured. Add the Resend API key in the project secrets before sending.");
  }

  const attachmentContent = Buffer.from(input.attachment.base64, "base64");
  if (attachmentContent.length === 0) throw new Error("The report attachment could not be prepared.");
  if (attachmentContent.length > 30 * 1024 * 1024) throw new Error("The report attachment is too large to send by email.");

  const resend = new Resend(config.apiKey);
  const contentType = /\.csv$/i.test(input.attachment.filename) ? CSV_MIME : XLSX_MIME;
  const { data, error } = await resend.emails.send({
    from: config.from,
    to: input.recipients,
    cc: input.cc?.length ? input.cc : undefined,
    replyTo: input.replyTo?.trim() || undefined,
    subject: input.subject,
    html: buildDashboardExportEmailHtml(input),
    attachments: [{ filename: input.attachment.filename, content: attachmentContent, contentType }],
  });
  if (error) throw new Error(`Resend delivery failed: ${error.message}`);
  return { id: data?.id };
}
