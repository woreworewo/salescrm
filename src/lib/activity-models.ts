export const COMMUNICATION_TYPES = [
  "whatsapp",
  "direct-call",
  "visit",
  "email",
] as const;
export type CommunicationType = (typeof COMMUNICATION_TYPES)[number];
export const COMMUNICATION_LABELS: Record<CommunicationType, string> = {
  whatsapp: "WhatsApp",
  "direct-call": "Direct Call",
  visit: "Sales Visit / Meeting",
  email: "Email",
};
export const MAX_SELFIE_BYTES = 200 * 1024;
export type SalesActivity = {
  id: string;
  tenant_id: string;
  property_id: string;
  company_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  owner_id: string;
  communication_type: CommunicationType;
  occurred_at: string;
  summary: string;
  outcome: string;
  notes: string;
  next_action: string | null;
  follow_up_date: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  gps_captured_at: string | null;
  photo_path: string | null;
  photo_sha256: string | null;
  status: "draft" | "recorded";
  created_at: string;
  recorded_at: string | null;
};
export type GpsEvidence = {
  latitude: number;
  longitude: number;
  accuracy_m: number;
  gps_captured_at: string;
};
