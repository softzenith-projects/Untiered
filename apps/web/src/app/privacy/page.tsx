import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL_DISPLAY, FREE_ROUNDS_TEXT, LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${LEGAL.productName} collects, uses, stores and deletes your data.`,
};

/**
 * Written from what the code does, not from a template: every retention period, provider
 * and switch named here has a line in the codebase behind it. When one of those changes,
 * this page changes in the same commit.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={`This policy explains what ${LEGAL.productName} collects when you learn or practise, how it is used, who processes it, and the controls you have over it.`}
    >
      <LegalSection id="who" title="Who we are">
        <p>
          {LEGAL.productName} is operated by {LEGAL.operatorName}, which is responsible for
          deciding how information you share with this service is used. Questions and data
          requests go to {CONTACT_EMAIL_DISPLAY}.
        </p>
      </LegalSection>

      <LegalSection id="collect" title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Your sign-in:</strong> your email address, and your name and
            Google account identifier if you choose Google. Supabase handles email passwords;
            we never see your password in plain text or your Google password.
          </li>
          <li>
            <strong className="text-ink">Your profile:</strong> anything you add, such as your current
            and target level, LinkedIn address and a profile photo.
          </li>
          <li>
            <strong className="text-ink">Your resume:</strong> the file you upload and what we read
            from it (employers, roles, projects and skills).
          </li>
          <li>
            <strong className="text-ink">Your interviews:</strong> the company and role you practise
            for, the spoken answers you submit, their transcripts, the interviewer&rsquo;s
            questions, and the report and scores written about your answers. We record each
            answer in your browser only after you agree to it, and we store the time you agreed.
            The answer audio is sent to Gemini for assessment; we do not save that audio file.
          </li>
          <li>
            <strong className="text-ink">Your learning:</strong> which course chapters you finish
            and your Arena answers, streak and badges.
          </li>
          <li>
            <strong className="text-ink">Purchases:</strong> if you buy paid interviews, what you
            bought, the amount, when, and Razorpay&rsquo;s order and payment references. We never
            receive your card, UPI or bank details.
          </li>
          <li>
            <strong className="text-ink">Technical data:</strong> error reports and server logs,
            identified by your account number rather than your name or email, so we can fix things
            that break.
          </li>
        </ul>
        <p>
          <strong className="text-ink">Your camera is never recorded.</strong> If you turn it on
          during an interview, the picture stays in your browser so you can practise facing an
          interviewer. Nothing from it is uploaded, stored, sent to an AI model or described in
          your report.
        </p>
      </LegalSection>

      <LegalSection id="use" title="How we use it">
        <ul className="list-disc space-y-2 pl-5">
          <li>To run your interview: ask questions, understand your spoken answers and follow up on them.</li>
          <li>To write your report and show how your practice is going over time.</li>
          <li>To tailor questions to your resume, and to keep track of your course and Arena progress.</li>
          <li>
            To keep free practice fair and to give you the paid interviews you bought: we count the
            free interviews you start (currently your first {FREE_ROUNDS_TEXT}) and the paid ones
            you buy and use.
          </li>
          <li>To keep the service secure and working, and to fix errors.</li>
        </ul>
        <p>
          We do not sell your data, show you advertising, or use your answers, resume or reports
          to train AI models.
        </p>
      </LegalSection>

      <LegalSection id="processors" title="Who processes it for us">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Supabase</strong> stores the database, your files and your
            sign-in session, in {LEGAL.dataRegion}.
          </li>
          <li>
            <strong className="text-ink">Google (Gemini API)</strong> processes your spoken answers,
            resume and transcript to run the interview, read your resume and write your report.
            It may also speak the interviewer&rsquo;s questions. We use Google&rsquo;s paid API,
            which does not use this data to train Google&rsquo;s models.
          </li>
          <li>
            <strong className="text-ink">A backup text model</strong> may be used for text-only
            steps such as writing a report if Google is unavailable. It never receives recordings
            of your voice.
          </li>
          <li>
            <strong className="text-ink">Sentry</strong> receives error reports. These carry your
            account number, never your recordings, resume, email or name.
          </li>
          <li>
            <strong className="text-ink">Google sign-in</strong> confirms who you are if you choose
            Google to sign in.
          </li>
          <li>
            <strong className="text-ink">Razorpay</strong> processes payments if you buy paid
            interviews. You enter your payment details with Razorpay, and it receives your email
            address to send you a receipt.
          </li>
        </ul>
        <p>
          Some of these providers may process data outside India. Each processes it only to provide
          its service to us.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep it">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Answer audio</strong> is used for assessment and is not saved
            as a recording. Spoken interviewer questions are queued for storage deletion when the
            round ends; failed deletion attempts are retried. <strong className="text-ink">Reports
            and transcripts</strong> are deleted {LEGAL.reportRetentionDays} days after the interview.
            A short line stays in your history
            (company, role, date and whether it finished) so your progress still adds up.
          </li>
          <li>You can delete any interview yourself at any time, with its report and transcript.</li>
          <li>Your resume, profile and learning progress are kept until you delete them or your account.</li>
          <li>
            <strong className="text-ink">Deleting your account</strong> (Profile → Account) deletes
            everything above, including stored files, unused paid interviews and your sign-in. Files
            are removed from storage within a day.
          </li>
          <li>
            <strong className="text-ink">Payment records</strong> (what was bought, the amount, the
            date and Razorpay&rsquo;s references) are kept after you delete your account, because
            tax and accounting law requires it and so that refunds can still be made. They are
            detached from your account and hold no name, email or other details of yours.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="rights" title="Your choices and requests">
        <p>You can:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>ask what personal data we hold about you and how we use it;</li>
          <li>correct or update it (most of it you can change yourself on your profile);</li>
          <li>have it erased: delete an interview, or your whole account, at any time;</li>
          <li>withdraw your consent. Recording stops when you stop an interview, and you can delete its transcript and report;</li>
          <li>ask how to exercise any privacy rights available to you under applicable law;</li>
          <li>raise a complaint with us about how we handle your data.</li>
        </ul>
        <p>
          Our Grievance Officer is {LEGAL.grievanceOfficer}, reachable at {CONTACT_EMAIL_DISPLAY}. We
          reply within 30 days.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Age">
        <p>
          {LEGAL.productName} is for people aged 18 or over. Anyone under 18 must have verifiable
          consent from a parent or guardian before using it. If an account was created without
          that consent, contact us so we can review and delete the account and its data.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <p>
          We use only the cookies needed to keep you signed in. There are no advertising or
          third-party tracking cookies.
        </p>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          Data travels over encrypted connections. Each account&rsquo;s data is separated at the
          database level, and stored files are private to your account. No system is perfectly
          secure; if a breach affects your data, we will tell you and the Data Protection Board as
          the law requires.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          If we change how we handle your data, we will update this page and its date. If the
          change is significant, we will tell you in the app before it takes effect. See also our{" "}
          <Link href="/terms" className="font-medium text-accent hover:underline">
            terms of use
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
