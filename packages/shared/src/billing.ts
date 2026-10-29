/**
 * Paid interviews, sold as credit packs through Razorpay.
 *
 * Amounts are in paise and include every tax. The server prices every order from its own
 * pack list; a client names a pack, never an amount.
 */

export interface CreditPackView {
  id: string;
  name: string;
  credits: number;
  pricePaise: number;
  perInterviewPaise: number;
  /** Against the dearest per-interview price on offer; 0 for that pack itself. */
  savingsPercent: number;
}

export interface BillingOverview {
  /** False until the server has Razorpay keys; nothing can be bought then. */
  purchasable: boolean;
  /** Paid interviews bought and not yet spent. */
  creditBalance: number;
  currency: string;
  packs: CreditPackView[];
}

/** What Razorpay Checkout needs to open for one order. */
export interface CheckoutOrder {
  orderId: string;
  keyId: string;
  amountPaise: number;
  currency: string;
  packId: string;
  name: string;
  credits: number;
  email: string | null;
}

/** What Razorpay Checkout hands back on success, for the server to verify. */
export interface ConfirmPaymentRequest {
  razorpayPaymentId: string;
  razorpaySignature: string;
}
