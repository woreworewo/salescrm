export const STAGES = [
  "discovery",
  "proposal-sent",
  "negotiation",
  "won",
  "lost",
] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  discovery: "Discovery",
  "proposal-sent": "Proposal Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};
export type Profile = {
  id: string;
  full_name: string;
};
export type AccessRole = "tenant-admin" | "property-admin" | "sales";
export const ACCESS_ROLE_LABELS: Record<AccessRole, string> = {
  "tenant-admin": "Tenant Admin",
  "property-admin": "Property Admin",
  sales: "Sales",
};
export type Tenant = { id: string; name: string };
export type Property = {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  timezone: "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura";
  currency: "IDR";
};
export type PropertyOption = Property & {
  tenant_name: string;
  access_role: AccessRole;
};
export type Company = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  fax: string;
  account_type: string;
  owner_id: string;
  created_at: string;
};
export type Contact = {
  id: string;
  tenant_id: string;
  company_id: string;
  title: string;
  first_name: string;
  last_name: string;
  position: string;
  mobile: string;
  email: string;
};
export type Opportunity = {
  id: string;
  tenant_id: string;
  property_id: string;
  company_id: string;
  owner_id: string;
  name: string;
  offering_type: "room" | "meeting" | "package";
  estimated_value: string | number;
  stage: Stage;
  target_close: string;
  next_action: string;
  follow_up_date: string;
  stage_entered_at: string;
  version: number;
  lost_reason: string | null;
};
export type Task = {
  id: string;
  tenant_id: string;
  property_id: string;
  company_id: string;
  owner_id: string;
  title: string;
  due_date: string;
  completed: boolean;
  version: number;
};
export type Workspace = {
  demo: boolean;
  profile: Profile;
  tenant: Tenant;
  property: Property;
  accessRole: AccessRole;
  propertyOptions: PropertyOption[];
  companies: Company[];
  contacts: Contact[];
  opportunities: Opportunity[];
  tasks: Task[];
  profiles: Profile[];
};
export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
};
export const INITIAL_STATE: ActionState = { status: "idle", message: "" };
