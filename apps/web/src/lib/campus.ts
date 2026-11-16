import { LEGAL } from "@/lib/legal";

/**
 * Untiered Campus: the college partnership (docs/campus-v1-spec.md).
 *
 * A college registers interest with the form on /colleges (contract Module 13), which
 * creates a lead for a platform admin to review; a college is still onboarded by hand. The
 * mailto below is the fallback when that form is switched off, and the "prefer email" link.
 */
export const CAMPUS_PRODUCT_NAME = "Untiered Campus";

/** The registration form's anchor on /colleges. */
export const CAMPUS_REGISTER_ANCHOR = "register";

const SUBJECT = "Untiered Campus pilot for our college";
const BODY = [
  "College name and city:",
  "Your name and role (TPO, faculty, admin):",
  "Batches you would like to start with (e.g. CSE 2027):",
  "Roughly how many students:",
  "",
].join("\n");

export const CAMPUS_CONTACT_HREF = `mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`;
