"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Columns3,
  ListChecks,
  FileText,
  Settings2,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
const ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/tasks", label: "Follow-up tasks", icon: ListChecks },
  { href: "/activities", label: "Activities", icon: ClipboardList },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings2 },
];
export function Navigation({ tenantAdmin }: { tenantAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi utama"
      className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:px-4 lg:py-6"
    >
      {[
        ...ITEMS,
        ...(tenantAdmin
          ? [
              {
                href: "/portfolio",
                label: "Property overview",
                icon: Building2,
              },
            ]
          : []),
      ].map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-emerald-50 text-emerald-900"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <Icon size={18} strokeWidth={1.7} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
