import type { Metadata, Route } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL_DISPLAY, FREE_ROUNDS_LIFETIME_TEXT, LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "About us",
  description: `${LEGAL.productName} is a voice-first mock interview platform operated by ${LEGAL.operatorName}.`,
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="Untiered · About"
      title="About us"
      intro={`${LEGAL.productName} is a voice-first mock interview platform. You speak your answers to an AI interviewer, handle its follow-up questions, and get a structured report on how you did.`}
      showUpdated={false}
    >
      <LegalSection id="what" title="What we do">
        <p>
          Before each practice interview you choose the company and the role you are preparing
          for. The interview adapts to your answers, the way a real interviewer would, and
          afterwards you get a report that points to what you actually said.
        </p>
        <p>
          Interviews run in English or in Hindi-English. Alongside them there are self-paced
          courses and practice questions.
        </p>
      </LegalSection>

      <LegalSection id="who" title="Who runs it">
        <p>
          {LEGAL.productName} is a product of {LEGAL.operatorName}, an Indian company. Your data
          is stored in {LEGAL.dataRegion}.
        </p>
      </LegalSection>

      <LegalSection id="pricing" title="What it costs">
        <p>
          Every account gets {FREE_ROUNDS_LIFETIME_TEXT}. After that, interviews are bought as
          credits. See{" "}
          <Link href={"/pricing" as Route} className="font-medium text-accent hover:underline">pricing</Link>.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Write to {CONTACT_EMAIL_DISPLAY}, or use the{" "}
          <Link href="/contact" className="font-medium text-accent hover:underline">contact page</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
