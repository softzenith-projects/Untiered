import type { CheckoutOrder, ConfirmPaymentRequest } from "@untiered/shared";

import { LEGAL } from "@/lib/legal";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/** The candidate closed Checkout without paying. Not an error worth showing. */
export class CheckoutDismissed extends Error {
  constructor() {
    super("Checkout was closed before paying.");
    this.name = "CheckoutDismissed";
  }
}

let loading: Promise<RazorpayConstructor> | null = null;

/**
 * Razorpay's Checkout script, loaded on the first purchase rather than on every page:
 * most visits never buy anything, and a third-party script on every page is a cost each
 * of them pays.
 */
function loadCheckout(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;
  loading = new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay Checkout did not load."));
    };
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Razorpay Checkout could not be reached. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

/**
 * Opens Razorpay Checkout for [order] and resolves with what the server needs to verify
 * the payment. Rejects with [CheckoutDismissed] when the candidate closes it.
 *
 * A failed attempt inside Checkout is not a rejection: Razorpay lets the candidate try
 * another method in the same window, and only closing it ends the purchase.
 */
export async function payWithRazorpay(order: CheckoutOrder): Promise<ConfirmPaymentRequest> {
  const Razorpay = await loadCheckout();
  return new Promise<ConfirmPaymentRequest>((resolve, reject) => {
    const checkout = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: LEGAL.productName,
      description: order.name,
      prefill: order.email ? { email: order.email } : {},
      theme: { color: "#2456d3" },
      handler: (response: RazorpaySuccess) =>
        resolve({
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      modal: { ondismiss: () => reject(new CheckoutDismissed()) },
    });
    checkout.open();
  });
}

/** "₹199" or "₹1,499" — whole rupees, Indian digit grouping. */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
  }).format(rupees);
}
