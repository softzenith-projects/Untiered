import type { PackageStatus } from "@untiered/shared";

/** Campus module 14: how packages read on screen. Dates arrive as India dates, YYYY-MM-DD. */

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** 9900000 paise → "₹99,000". */
export function formatInr(paise: number): string {
  return INR.format(paise / 100);
}

/** "2027-05-31" → "31 May 2027", the same on every machine whatever its time zone. */
export function formatDay(isoDate: string): string {
  return DAY.format(new Date(`${isoDate}T00:00:00Z`));
}

/** "99,000.50" or "99000" → 9900050 paise; null when it is not an amount. */
export function rupeesToPaise(value: string): number | null {
  const clean = value.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number.parseFloat(clean) * 100);
}

export function paiseToRupees(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export const PACKAGE_STATUS_LABEL: Record<PackageStatus, string> = {
  draft: "Draft",
  invoiced: "Invoiced, unpaid",
  paid: "Paid",
  void: "Void",
};

export const PACKAGE_STATUS_TONE: Record<PackageStatus, "info" | "highlight" | "positive" | "danger"> = {
  draft: "info",
  invoiced: "highlight",
  paid: "positive",
  void: "danger",
};

export function perStudentText(limit: number | null): string {
  return limit === null ? "No limit" : `${limit} per student`;
}
