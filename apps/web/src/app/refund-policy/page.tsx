import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { RefundTerms } from "@/components/refund-terms";
import { CONTACT_EMAIL_DISPLAY, LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cancellation and refund policy",
  description: `How cancellations and refunds work for ${LEGAL.productName} purchases.`,
};

/** The refund terms on a page of their own, as payment providers ask for. Same text as /terms. */
export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Cancellation and refund policy"
      intro={`${LEGAL.productName} is operated by ${LEGAL.operatorName}. This page explains what happens to a purchase if you change your mind or something goes wrong. It is the same as the payments section of our terms of use.`}
    >
      <LegalSection id="cancellation" title="Cancellation">
        <p>
          Every purchase is a one-off payment. There is no subscription, so there is nothing to
          cancel and you will never be charged again unless you choose to buy again.
        </p>
      </LegalSection>

      <LegalSection id="refunds" title="Paid interviews and refunds">
        <RefundTerms />
      </LegalSection>

      <LegalSection id="contact" title="Questions">
        <p>
          Write to {CONTACT_EMAIL_DISPLAY} with the email address on your account and the date of
          the payment. You can also reach us through the{" "}
          <Link href="/contact" className="font-medium text-accent hover:underline">contact page</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
