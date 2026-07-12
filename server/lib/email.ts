import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

const FROM = process.env.SMTP_FROM || "PRRMS <noreply@parliament.gov.gh>";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!process.env.SMTP_HOST) {
      console.log("[Email] SMTP not configured, skipping email:", options.subject);
      return false;
    }
    await transporter.sendMail({ from: FROM, ...options });
    console.log("[Email] Sent:", options.subject, "->", options.to);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return false;
  }
}

// ─── Email Templates ────────────────────────────────────

export function assignmentEmail(officerName: string, requestNumber: string, title: string, deadline: string) {
  const subject = `New Research Assignment: ${requestNumber}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #3a485c; padding: 20px; text-align: center;">
        <h1 style="color: white; font-size: 18px; margin: 0;">PRRMS Assignment Notification</h1>
      </div>
      <div style="padding: 24px; background: #f9fafb;">
        <p>Dear ${officerName},</p>
        <p>You have been assigned a new research request:</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Request:</strong> ${requestNumber}</p>
          <p style="margin: 8px 0 0 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 8px 0 0 0;"><strong>Deadline:</strong> ${deadline}</p>
        </div>
        <p>Please log in to the Research Portal to begin working on this request.</p>
        <a href="${FRONTEND_URL}" style="display: inline-block; background: #0037b0; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">Open Research Portal</a>
        <p style="color: #888; font-size: 11px; margin-top: 24px;">Parliamentary Research Department — PRRMS</p>
      </div>
    </div>`;
  return { subject, html };
}

export function statusChangeEmail(recipientName: string, requestNumber: string, title: string, newStatus: string) {
  const subject = `Request ${requestNumber} status updated to ${newStatus.replace(/_/g, ' ').toLowerCase()}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #3a485c; padding: 20px; text-align: center;">
        <h1 style="color: white; font-size: 18px; margin: 0;">PRRMS Status Update</h1>
      </div>
      <div style="padding: 24px; background: #f9fafb;">
        <p>Dear ${recipientName},</p>
        <p>The status of a research request has been updated:</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Request:</strong> ${requestNumber}</p>
          <p style="margin: 8px 0 0 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 8px 0 0 0;"><strong>New Status:</strong> <span style="color: #0037b0; font-weight: bold;">${newStatus.replace(/_/g, ' ')}</span></p>
        </div>
        <a href="${FRONTEND_URL}" style="display: inline-block; background: #0037b0; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">View in Portal</a>
        <p style="color: #888; font-size: 11px; margin-top: 24px;">Parliamentary Research Department — PRRMS</p>
      </div>
    </div>`;
  return { subject, html };
}

export function draftSubmittedEmail(adminName: string, requestNumber: string, title: string, version: number) {
  const subject = `Draft v${version} submitted for review: ${requestNumber}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #3a485c; padding: 20px; text-align: center;">
        <h1 style="color: white; font-size: 18px; margin: 0;">PRRMS Draft Submission</h1>
      </div>
      <div style="padding: 24px; background: #f9fafb;">
        <p>Dear ${adminName},</p>
        <p>A new draft has been submitted and is ready for your review:</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Request:</strong> ${requestNumber}</p>
          <p style="margin: 8px 0 0 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 8px 0 0 0;"><strong>Version:</strong> v${version}</p>
        </div>
        <a href="${FRONTEND_URL}" style="display: inline-block; background: #0037b0; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">Review Draft</a>
        <p style="color: #888; font-size: 11px; margin-top: 24px;">Parliamentary Research Department — PRRMS</p>
      </div>
    </div>`;
  return { subject, html };
}

export function revisionRequestedEmail(officerName: string, requestNumber: string, title: string, comment: string) {
  const subject = `Revision requested: ${requestNumber}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #3a485c; padding: 20px; text-align: center;">
        <h1 style="color: white; font-size: 18px; margin: 0;">PRRMS Revision Requested</h1>
      </div>
      <div style="padding: 24px; background: #f9fafb;">
        <p>Dear ${officerName},</p>
        <p>A revision has been requested on your draft:</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Request:</strong> ${requestNumber}</p>
          <p style="margin: 8px 0 0 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 8px 0 0 0;"><strong>Feedback:</strong></p>
          <p style="margin: 8px 0 0 0; color: #555; font-style: italic;">"${comment}"</p>
        </div>
        <a href="${FRONTEND_URL}" style="display: inline-block; background: #0037b0; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">Open in Portal</a>
        <p style="color: #888; font-size: 11px; margin-top: 24px;">Parliamentary Research Department — PRRMS</p>
      </div>
    </div>`;
  return { subject, html };
}

export function overdueAlertEmail(recipientName: string, requestNumber: string, title: string, deadline: string) {
  const subject = `OVERDUE: ${requestNumber} — ${title}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ba1a1a; padding: 20px; text-align: center;">
        <h1 style="color: white; font-size: 18px; margin: 0;">PRRMS Overdue Alert</h1>
      </div>
      <div style="padding: 24px; background: #f9fafb;">
        <p>Dear ${recipientName},</p>
        <p style="color: #ba1a1a; font-weight: bold;">The following research request is now overdue:</p>
        <div style="background: white; border: 2px solid #ba1a1a; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Request:</strong> ${requestNumber}</p>
          <p style="margin: 8px 0 0 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 8px 0 0 0; color: #ba1a1a;"><strong>Deadline was:</strong> ${deadline}</p>
        </div>
        <a href="${FRONTEND_URL}" style="display: inline-block; background: #ba1a1a; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">View Request</a>
        <p style="color: #888; font-size: 11px; margin-top: 24px;">Parliamentary Research Department — PRRMS</p>
      </div>
    </div>`;
  return { subject, html };
}
