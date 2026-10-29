import { CONTACT_EMAIL_DISPLAY, LEGAL } from "@/lib/legal";

/**
 * The payment and refund terms, written once and shown in two places: the terms of use
 * and the standalone cancellation and refund policy, so the two can never disagree.
 */
export function RefundTerms() {
  return (
    <ul className="list-disc space-y-2 pl-5">
      <li>
        Paid interviews are sold singly or in packs, at the price shown before you pay. Prices
        are in Indian rupees and include all taxes. Each is a one-off purchase: there is no
        subscription and nothing renews.
      </li>
      <li>
        Each paid interview is one mock interview with its full report. Your free practice is
        always used first, so a paid interview is only used when you practise beyond it.
      </li>
      <li>
        A paid interview is used when the interview starts. Leaving an interview partway through
        still uses it. If an interview fails because of a fault on our side, the paid interview
        is returned to your account automatically.
      </li>
      <li>
        Paid interviews do not expire while your account exists. Deleting your account deletes
        any you have not used. A record of your payments is kept for tax and accounting, as the
        privacy policy describes.
      </li>
      <li>
        If you were charged but did not receive your interviews, or want a refund for a pack you
        have not used any of, write to {CONTACT_EMAIL_DISPLAY} within {LEGAL.refundWindowDays}{" "}
        days of paying. Approved refunds go back to the original payment method, usually within
        5&ndash;7 working days.
      </li>
      <li>
        Payments are processed by Razorpay. Your card, UPI or bank details are entered with
        Razorpay and are never seen or stored by us.
      </li>
    </ul>
  );
}
