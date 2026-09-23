import { logger } from "./logger.js";

const GRAPH_VERSION = "v22.0";
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const DEFAULT_COUNTRY_CODE = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "233";

export function isWhatsAppConfigured(): boolean {
  return !!TOKEN && !!PHONE_ID;
}

// Normalize a phone number to E.164 format (e.g. +233241234567)
export function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  let p = phone.replace(/[^\d]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) {
    p = DEFAULT_COUNTRY_CODE + p.slice(1);
  } else if (p.length > 0 && !p.startsWith(DEFAULT_COUNTRY_CODE) && !p.startsWith("1")) {
    // Assume local number belonging to the default country code if not already international
    if (p.length <= 10) p = DEFAULT_COUNTRY_CODE + p;
  }
  if (!p.startsWith(DEFAULT_COUNTRY_CODE)) return null;
  if (p.length < 11) return null;
  return "+" + p;
}

export function formatWhatsAppMessage(notification: {
  title: string;
  message: string;
  link?: string | null;
}): string {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const link = notification.link ? `${frontendUrl}${notification.link}` : frontendUrl;
  return `*${notification.title}*\n\n${notification.message}\n\nOpen: ${link}`;
}

export async function sendWhatsAppMessage(toPhone: string, body: string): Promise<boolean> {
  if (!isWhatsAppConfigured()) {
    logger.info("[WhatsApp] Not configured, skipping message");
    return false;
  }
  const phone = normalizePhone(toPhone);
  if (!phone) {
    logger.info(`[WhatsApp] Invalid phone number, skipping: ${toPhone}`);
    return false;
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_ID}/messages`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body },
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      logger.requestError("POST", "whatsapp/messages", new Error(errText));
      return false;
    }
    logger.info(`[WhatsApp] Sent: ${body.slice(0, 60)} -> ${phone}`);
    return true;
  } catch (error) {
    logger.requestError("POST", "whatsapp/messages", error);
    return false;
  }
}

export async function sendWhatsAppNotification(
  toPhone: string,
  notification: { title: string; message: string; link?: string | null },
): Promise<boolean> {
  return sendWhatsAppMessage(toPhone, formatWhatsAppMessage(notification));
}