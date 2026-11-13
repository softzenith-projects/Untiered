import { LEGAL } from "@/lib/legal";

/**
 * Untiered Campus: the college partnership (docs/campus-v1-spec.md).
 *
 * Onboarding a college is done by hand for now (spec §1), so the only way in is to write
 * to us. A mailto rather than a form keeps a college's contact details out of any new
 * system until there is one built to hold them: no new service, nothing to retain.
 */
export const CAMPUS_PRODUCT_NAME = "Untiered Campus";

const SUBJECT = "Untiered Campus pilot for our college";
const BODY = [
  "College name and city:",
  "Your name and role (TPO, faculty, admin):",
  "Batches you would like to start with (e.g. CSE 2027):",
  "Roughly how many students:",
  "",
].join("\n");

export const CAMPUS_CONTACT_HREF = `mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`;
