import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Contact",
  description: `Get help with your ${LEGAL.productName} account, a mock interview, or a privacy request. Write to ${LEGAL.contactEmail}.`,
  path: "/contact",
});

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      intro="Get help with your account, learning progress, a mock interview, or a privacy request."
      eyebrow="Untiered · Support"
      showUpdated={false}
    >
      <LegalSection id="email" title="Email">
        <p>
          <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent hover:underline">
            {LEGAL.contactEmail}
          </a>
        </p>
        <p>
          If something went wrong in an interview, include the date and the company you were
          practising for. Please do not include a recording, your resume, or your password in
          your email. We will never ask for any password.
        </p>
      </LegalSection>

      <LegalSection id="data" title="Data requests and complaints">
        <p>
          To see, correct or delete your data, or to make a complaint, write to our Grievance
          Officer, {LEGAL.grievanceOfficer}, at {LEGAL.contactEmail}. We reply within 30 days. You can
          also delete interviews or your whole account yourself from your profile. See the{" "}
          <Link href="/privacy" className="font-medium text-accent hover:underline">
            privacy policy
          </Link>{" "}
          for your rights.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
