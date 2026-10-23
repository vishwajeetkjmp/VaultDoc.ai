import Link from "next/link";
import type { Metadata } from "next";
import SitePage from "../../components/SitePage";
import styles from "../../components/site.module.css";

export const metadata: Metadata = { title: "Terms of Service — VaultDocAI" };

export default function TermsPage() {
  return (
    <SitePage>
      <span className={styles.eyebrow}>Legal</span>
      <h1 className={styles.title} style={{ fontSize: 34 }}>
        Terms of Service
      </h1>
      <div className={styles.draft}>
        ⚠️ <b>Draft.</b> These terms must be reviewed by a qualified lawyer and the placeholders in [brackets]
        filled in before public launch.
      </div>

      <div className={styles.legal}>
        <p>Last updated: [date]</p>
        <p>
          These terms are an agreement between you and <b>[legal entity name]</b> (&quot;we&quot;) for your use of
          VaultDocAI. By creating an account you agree to them and to our{" "}
          <Link href="/privacy" style={{ color: "var(--primary)" }}>
            Privacy Policy
          </Link>
          .
        </p>

        <h2>1. Your account</h2>
        <ul>
          <li>You must be 18 or older, or have the consent of a parent or guardian.</li>
          <li>Keep your password, PIN and recovery key private. You are responsible for activity on your account.</li>
          <li>Give accurate information and keep your email address up to date.</li>
        </ul>

        <h2>2. Your content</h2>
        <p>
          You keep all rights to the documents you upload. You give us only the permission needed to store them,
          show them to you and run the service. You confirm you have the right to upload what you store.
        </p>

        <h2>3. Secure Vault</h2>
        <p>
          Vault files are encrypted with keys only you hold. <b>If you lose your recovery key and all devices where
          the vault is set up, nobody, including us, can recover your vault files.</b> We are not responsible for
          data lost this way.
        </p>

        <h2>4. Acceptable use</h2>
        <p>Don&apos;t use VaultDocAI to:</p>
        <ul>
          <li>store or share illegal content, malware, or content that infringes others&apos; rights;</li>
          <li>try to access other people&apos;s accounts or data, or disrupt the service;</li>
          <li>get around storage limits or abuse free plans.</li>
        </ul>
        <p>We may suspend accounts that break these rules, and will act on valid legal requests.</p>

        <h2>5. Plans and limits</h2>
        <p>
          The free plan currently includes 1 GB of storage and files up to 20 MB. We may change plans and limits
          with reasonable notice. [Paid plan terms, billing and refunds to be added.]
        </p>

        <h2>6. Availability and backups</h2>
        <p>
          We work to keep VaultDocAI available and your data safe, but the service is provided &quot;as is&quot;.
          Keep your own copies of documents that are important to you.
        </p>

        <h2>7. Liability</h2>
        <p>
          To the extent permitted by law, we are not liable for indirect or consequential losses. [Liability cap to
          be defined by counsel.]
        </p>

        <h2>8. Ending your account</h2>
        <p>
          You can delete your account at any time from Account → Delete account; this permanently deletes your data.
          We may close accounts that violate these terms, with notice where possible.
        </p>

        <h2>9. Governing law</h2>
        <p>
          These terms are governed by the laws of India, and courts at <b>[city]</b> have jurisdiction.
        </p>

        <h2>10. Contact</h2>
        <p>
          <b>[email]</b>, [address].
        </p>
      </div>
    </SitePage>
  );
}
