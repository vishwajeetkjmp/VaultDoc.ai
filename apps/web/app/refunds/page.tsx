import Link from "next/link";
import type { Metadata } from "next";
import SitePage from "../../components/SitePage";
import styles from "../../components/site.module.css";
import { CONTACT_EMAIL } from "../../lib/contact";

export const metadata: Metadata = { title: "Refund and cancellation policy — VaultDocAI" };

const link = { color: "var(--primary)" };

export default function RefundsPage() {
  return (
    <SitePage>
      <span className={styles.eyebrow}>Legal</span>
      <h1 className={styles.title} style={{ fontSize: 34 }}>
        Refund and cancellation policy
      </h1>
      <div className={styles.legal}>
        <p>Last updated: 24 October 2026</p>

        <h2>How Pro is paid for</h2>
        <p>
          Pro costs <b>₹399 for 30 days</b>, paid once through Razorpay (UPI, cards or netbanking). There is
          <b> no automatic renewal</b>: we never charge you again unless you choose to pay again. Paying while you
          already have Pro adds 30 days to the end of your current Pro period.
        </p>

        <h2>Cancelling</h2>
        <p>
          You can stop at any time simply by not paying again. Pro stays active until the end of the period you
          paid for, then your account returns to the Free plan. Your files are kept: if you have more than the Free
          storage, you can still open, download and delete them, but you can&apos;t upload more until you&apos;re
          back under the Free limit.
        </p>

        <h2>Refunds</h2>
        <p>
          Payments are <b>not refundable</b>, including for the unused part of a 30-day period, because Pro starts
          immediately after payment.
        </p>
        <p>
          <b>Payment problems:</b> if money was taken but Pro didn&apos;t start, or you were charged twice for the same
          purchase, write to us within 7 days with the payment ID (it starts with <code>pay_</code> and is in your
          Razorpay receipt and on your <Link href="/account" style={link}>Account</Link> page). We&apos;ll either
          start your Pro or refund the extra charge to the original payment method, usually within 5–7 working days.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about a payment:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={link}>
            {CONTACT_EMAIL}
          </a>{" "}
          · <Link href="/contact" style={link}>Contact page</Link>
        </p>
      </div>
    </SitePage>
  );
}
