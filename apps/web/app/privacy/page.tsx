import type { Metadata } from "next";
import SitePage from "../../components/SitePage";
import styles from "../../components/site.module.css";

export const metadata: Metadata = { title: "Privacy Policy — VaultDocAI" };

export default function PrivacyPage() {
  return (
    <SitePage>
      <span className={styles.eyebrow}>Legal</span>
      <h1 className={styles.title} style={{ fontSize: 34 }}>
        Privacy Policy
      </h1>
      <div className={styles.draft}>
        ⚠️ <b>Draft.</b> This policy describes how VaultDocAI works today. It must be reviewed by a qualified lawyer
        and the placeholders in [brackets] filled in before public launch.
      </div>

      <div className={styles.legal}>
        <p>Last updated: [date]</p>
        <p>
          This policy explains what personal data VaultDocAI (&quot;we&quot;) collects, why, and the choices you have.
          VaultDocAI is operated by <b>[legal entity name]</b>, [address], India. We act as the Data Fiduciary for
          your personal data under India&apos;s Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;).
        </p>

        <h2>1. What we collect</h2>
        <ul>
          <li>
            <b>Account details:</b> your name, email address and, if you sign in with Google, your Google profile
            photo.
          </li>
          <li>
            <b>Your files:</b> documents you upload, their names, folders, sizes, types and upload dates.
          </li>
          <li>
            <b>Secure Vault:</b> files and their names are encrypted on your device before upload. We store only
            encrypted data and cannot read it. Your recovery key and PIN never reach us.
          </li>
          <li>
            <b>Usage records:</b> how much storage you use and how many files you have.
          </li>
          <li>
            <b>Technical data:</b> basic logs (such as IP address and timestamps) kept by our infrastructure
            providers for security and reliability.
          </li>
        </ul>

        <h2>2. Why we use it</h2>
        <ul>
          <li>To create and secure your account and let you sign in.</li>
          <li>To store your files and show them only to you.</li>
          <li>To enforce storage limits and keep the service reliable.</li>
          <li>To send essential emails, such as verification, password reset and PIN reset links.</li>
        </ul>
        <p>
          We <b>do not sell</b> your personal data and do not use your documents for advertising.
        </p>
        <p>
          <b>AI features (optional).</b> AI is off until you turn it on. When it&apos;s on and you ask about a file in My
          Space, that one file and your question are sent to our AI provider, <b>Anthropic</b> (Claude), only to produce
          the answer or summary. Anthropic processes them on our behalf and does not use them to train its models. Saved
          summaries and the reminders you set are stored with your account. Your <b>Secure Vault</b> is never sent to any
          AI. You can turn AI off at any time in Account.
        </p>

        <h2>3. Where your data is stored</h2>
        <p>
          Your files and records are stored with Google Cloud / Firebase in the <b>asia-south2 (Delhi, India)</b>{" "}
          region. Google acts as our data processor. Sign-in is handled by Firebase Authentication. If you use AI
          features, the file you ask about is processed by Anthropic, which may be outside India. Emails (invites,
          reminders) are sent through Resend.
        </p>

        <h2>4. On your device</h2>
        <p>
          We store small pieces of data in your browser: your sign-in session, your theme choice, and, if you use the
          Secure Vault, an encrypted copy of your vault key protected by your PIN. We do not use advertising or
          tracking cookies.
        </p>

        <h2>5. How long we keep it</h2>
        <p>
          We keep your data while your account exists. When you delete a file, it is removed from storage. When you
          delete your account (Account → Delete account), all your files, vault data, records and your sign-in
          account are deleted. Backups or logs held by our providers may persist for a limited period [specify].
        </p>

        <h2>6. Your rights</h2>
        <p>Under the DPDP Act you can:</p>
        <ul>
          <li>access a summary of your personal data and how it is processed;</li>
          <li>correct or update it (for example your name);</li>
          <li>erase it, including by deleting your account at any time;</li>
          <li>withdraw consent, which may mean closing your account;</li>
          <li>nominate another person to exercise your rights in case of death or incapacity;</li>
          <li>raise a grievance with us, and then with the Data Protection Board of India.</li>
        </ul>

        <h2>7. Security</h2>
        <p>
          Access to each account&apos;s data is restricted by server-side security rules, data is encrypted in
          transit and at rest by our providers, and Secure Vault files are end-to-end encrypted. No system is
          perfectly secure; please use a strong password and keep your recovery key safe.
        </p>

        <h2>8. Children</h2>
        <p>
          VaultDocAI is not intended for anyone under 18 without verifiable consent of a parent or lawful guardian,
          as required by the DPDP Act.
        </p>

        <h2>9. Contact and grievances</h2>
        <p>
          Grievance Officer: <b>[name]</b>, <b>[email]</b>, [address]. We aim to respond within [timeframe].
        </p>

        <h2>10. Changes</h2>
        <p>We will post updates here and notify you by email of significant changes.</p>
      </div>
    </SitePage>
  );
}
