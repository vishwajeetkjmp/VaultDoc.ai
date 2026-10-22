import HeroBackground from "./hero/HeroBackground";

export default function Hero() {
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      {/* Robot-and-vault animation behind the text */}
      <HeroBackground />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "860px",
          margin: "0 auto",
          padding: "100px 24px 80px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "999px",
            padding: "6px 16px",
            fontSize: "13px",
            color: "var(--text-muted)",
            marginBottom: "24px",
          }}
        >
          🔒 Private to your account · AI-powered
        </div>

        <h1
          style={{
            fontSize: "52px",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: "20px",
            letterSpacing: "-1px",
          }}
        >
          Understand every document in seconds.
        </h1>

        <p
          style={{
            fontSize: "19px",
            color: "var(--text-muted)",
            maxWidth: "620px",
            margin: "0 auto 36px",
          }}
        >
          Upload contracts, reports, and invoices. Ask questions in plain language
          and get instant answers grounded in your own files.
        </p>

        <div
          style={{
            display: "flex",
            gap: "14px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="/signup"
            style={{
              background: "var(--primary)",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 600,
              padding: "14px 28px",
              borderRadius: "10px",
            }}
          >
            Get started free
          </a>
          <a
            href="/about"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              fontSize: "16px",
              fontWeight: 600,
              padding: "14px 28px",
              borderRadius: "10px",
            }}
          >
            Learn more
          </a>
        </div>
      </div>
    </section>
  );
}
