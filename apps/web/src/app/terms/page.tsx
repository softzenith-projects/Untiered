import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { RefundTerms } from "@/components/refund-terms";
import { CONTACT_EMAIL_DISPLAY, FREE_ROUNDS_LIFETIME_TEXT, LEGAL } from "@/lib/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Terms of use",
  description: `The terms for using ${LEGAL.productName}: your account, free practice and paid interviews, fair use, your content, and liability.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro={`These terms explain how you may use ${LEGAL.productName} for learning and mock interview practice. By signing in or using the service, you agree to these terms. Our privacy policy explains how we handle your data.`}
    >
      <LegalSection id="service" title="What the service is">
        <p>
          {LEGAL.productName} provides self-paced courses, practice questions, AI-led mock
          interviews and feedback reports. The interviewer is an AI system, not a person. The
          service does not conduct real hiring assessments or act for any employer.
        </p>
      </LegalSection>

      <LegalSection id="practice" title="AI feedback and employer references">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Feedback and scores are written by an AI model. They can be wrong and are meant to help
            you practise, not to predict whether you will get a job.
          </li>
          <li>
            When we describe how a company interviews, we label where it comes from: a published
            source, a reported account, or general patterns for that kind of employer. We are not
            affiliated with any employer named on the site, and their names belong to them.
          </li>
          <li>Course material and feedback are for learning and practice. Check important information independently before relying on it.</li>
        </ul>
      </LegalSection>

      <LegalSection id="account" title="Your account">
        <ul className="list-disc space-y-2 pl-5">
          <li>You sign in with Google and are responsible for activity on your account. Keep access to that Google account secure.</li>
          <li>You must be 18 or over, or have verifiable consent from a parent or guardian.</li>
          <li>You can delete your account at any time from your profile.</li>
        </ul>
      </LegalSection>

      <LegalSection id="free" title="Free practice and limits">
        <p>
          Each account gets {FREE_ROUNDS_LIFETIME_TEXT}, each with its full report. This is a
          one-time allowance for the life of the account: it does not reset each day, month or
          year, and it does not come back once used. A free interview is used when it starts, as
          a paid one is, and is returned if it fails because of a fault on our side. Leaving an
          interview part-way does not return it. After the free ones, you can buy paid interviews
          (below). We may change these limits and
          will say so on the site before a change affects you. Courses and the Arena are free.
        </p>
      </LegalSection>

      <LegalSection id="payments" title="Paid interviews and refunds">
        <RefundTerms />
      </LegalSection>

      <LegalSection id="use" title="Fair use">
        <p>Please do not:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>use the service to get help during a real interview or assessment;</li>
          <li>upload a resume or recording of anyone but yourself, or other people&rsquo;s personal information without their permission;</li>
          <li>try to get around the free limit or payments, for example with automated scripts or many accounts;</li>
          <li>copy or resell the courses, questions or reports, or scrape the service;</li>
          <li>attack, overload or try to access parts of the service or data that are not yours.</li>
        </ul>
        <p>We may suspend accounts that do.</p>
      </LegalSection>

      <LegalSection id="content" title="Your content">
        <p>
          Your resume and answers remain yours. You let us use them only to provide the
          service to you, as described in our{" "}
          <Link href="/privacy" className="font-medium text-accent hover:underline">
            privacy policy
          </Link>
          . The courses, questions, software and design of {LEGAL.productName} belong to us.
        </p>
      </LegalSection>

      <LegalSection id="ending" title="Suspension and ending access">
        <p>
          You may stop using the service and delete your account from your profile. We may
          restrict access if an account breaks these terms or threatens the service or other
          users. If we discontinue the service, we will give notice through the site where
          reasonably possible.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="Availability and liability">
        <p>
          The service is provided as it is, and we do not promise it will always be available or
          free of errors. To the extent the law allows, we are not liable for indirect losses, or
          for decisions made on the basis of AI feedback. Nothing here limits rights you have under
          Indian consumer law.
        </p>
      </LegalSection>

      <LegalSection id="law" title="Changes, contact and governing law">
        <p>
          We may update these terms and will change the date above when we do. If a change is
          significant, we will tell you in the app first. These terms are governed by the laws of
          India. Questions go to {CONTACT_EMAIL_DISPLAY}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
