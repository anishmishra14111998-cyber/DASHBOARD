// Meta WhatsApp Cloud API — sends an approved template message.
//
// Automated/business-initiated WhatsApp messages MUST use a pre-approved
// template (Meta blocks free-form scheduled sends). The template defines
// the fixed text + numbered {{1}}, {{2}}, … placeholders; we fill those
// placeholders at send time via the `variables` array (order matters).
//
// Required env (set in Vercel):
//   WHATSAPP_PHONE_NUMBER_ID   - the "Phone number ID" from the API setup page
//   WHATSAPP_ACCESS_TOKEN      - permanent system-user token (or 24h test token)
//   WHATSAPP_RECIPIENTS        - comma-separated E.164 numbers w/o "+",
//                                e.g. "919876543210,14155551234"
//   WHATSAPP_TEMPLATE_NAME     - default "founder_daily_update"
//   WHATSAPP_TEMPLATE_LANG     - default "en"

const GRAPH_API_VERSION = "v21.0";

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  recipients: string[];
  templateName: string;
  languageCode: string;
}

// Reads + validates env. Returns null when not configured so callers can
// silently skip WhatsApp without erroring.
export function readWhatsAppConfig(): WhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipientsRaw = process.env.WHATSAPP_RECIPIENTS;
  if (!phoneNumberId || !accessToken || !recipientsRaw) return null;

  const recipients = recipientsRaw
    .split(",")
    .map((s) => s.trim().replace(/[^\d]/g, "")) // strip "+", spaces, dashes
    .filter(Boolean);
  if (recipients.length === 0) return null;

  return {
    phoneNumberId,
    accessToken,
    recipients,
    templateName: process.env.WHATSAPP_TEMPLATE_NAME ?? "founder_daily_update",
    languageCode: process.env.WHATSAPP_TEMPLATE_LANG ?? "en",
  };
}

async function sendOne(
  cfg: WhatsAppConfig,
  to: string,
  variables: string[],
): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${cfg.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: cfg.templateName,
        language: { code: cfg.languageCode },
        components: [
          {
            type: "body",
            parameters: variables.map((text) => ({ type: "text", text })),
          },
        ],
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json as { error?: unknown }).error) {
    const err = (json as { error?: { message?: string } }).error;
    throw new Error(`WhatsApp send to ${to} failed: ${err?.message ?? res.status}`);
  }
}

// Sends the template to every configured recipient. Returns per-recipient
// results so the caller can log partial failures without aborting the rest.
export async function sendWhatsAppToAll(
  cfg: WhatsAppConfig,
  variables: string[],
): Promise<{ to: string; ok: boolean; error?: string }[]> {
  const results: { to: string; ok: boolean; error?: string }[] = [];
  for (const to of cfg.recipients) {
    try {
      await sendOne(cfg, to, variables);
      results.push({ to, ok: true });
    } catch (err) {
      results.push({ to, ok: false, error: (err as Error).message });
    }
  }
  return results;
}
