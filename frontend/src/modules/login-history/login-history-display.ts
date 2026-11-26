import type { LoginHistoryItem } from "../../lib/api/types";

export function loginActorLabel(item: LoginHistoryItem): string {
  if (item.user) {
    return `${item.user.firstName} ${item.user.lastName}`.trim() || item.user.email;
  }
  return "Identité inconnue";
}

export function loginActorSecondary(item: LoginHistoryItem): string | null {
  if (item.user) {
    return item.user.email;
  }
  return "E-mail inexistant ou non reconnu";
}

export function loginOutcomeLabel(success: boolean): string {
  return success ? "Connexion réussie" : "Échec";
}

export function loginOutcomeTone(success: boolean): "success" | "danger" {
  return success ? "success" : "danger";
}

export function formatLoginWhen(iso: string): string {
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return iso;
  }
}

export function summarizeUserAgent(raw: string | null): string {
  if (!raw?.trim()) {
    return "Navigateur non renseigné";
  }
  const ua = raw.trim();
  if (ua.length <= 72) {
    return ua;
  }
  return `${ua.slice(0, 69)}…`;
}

export function parseClientHint(userAgent: string | null): { browser: string; os: string } {
  if (!userAgent) {
    return { browser: "—", os: "—" };
  }
  const ua = userAgent;

  let browser = "Navigateur";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  let os = "Système";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return { browser, os };
}