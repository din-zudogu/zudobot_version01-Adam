export const metadata = {
  title: "Privacy Policy — Zudobot Chrome Extension",
  description: "Privacy policy for Zudobot No-Code Injector Chrome Extension",
};

export default function ExtensionPrivacyPage() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "sans-serif", lineHeight: 1.7, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>Zudobot No-Code Injector Chrome Extension — Last updated: June 2026</p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>1. Overview</h2>
        <p>Zudobot No-Code Injector (&ldquo;Extension&rdquo;) is a Chrome extension developed by Zudogu Co., Ltd. that allows authenticated users to automatically embed the Zudobot AI chat widget into their own websites without editing HTML code.</p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>2. Data the Extension Collects</h2>
        <p>The Extension collects only the minimum data necessary to function:</p>
        <ul style={{ paddingLeft: 24, marginTop: 8 }}>
          <li><strong>Google Account information</strong> (email, name, profile picture) — used solely to authenticate you with your Zudobot account via Google OAuth 2.0.</li>
          <li><strong>Active tab URL</strong> — read only when you click the inject button, to determine which website to embed the widget on. This data is never stored or transmitted to our servers.</li>
          <li><strong>Session token</strong> — a short-lived authentication token (1-hour TTL) stored locally in <code>chrome.storage.local</code> to avoid requiring re-login on every use. Automatically deleted after expiry.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>3. Data We Do NOT Collect</h2>
        <ul style={{ paddingLeft: 24 }}>
          <li>We do not track your browsing history.</li>
          <li>We do not read or store the content of any web pages you visit.</li>
          <li>We do not collect any personal data from visitors of your website.</li>
          <li>We do not sell, rent, or share any user data with third parties.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>4. Permissions Used</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Permission</th>
              <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Why it is needed</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["identity", "Sign in with Google to authenticate your Zudobot account"],
              ["activeTab", "Inject the widget script into the current tab when you click the button"],
              ["scripting", "Execute the widget injection on the active page"],
              ["storage", "Store the short-lived session token locally"],
            ].map(([perm, reason]) => (
              <tr key={perm}>
                <td style={{ padding: "8px 12px", border: "1px solid #ddd", fontFamily: "monospace" }}>{perm}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #ddd" }}>{reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>5. Data Retention</h2>
        <p>The session token stored in <code>chrome.storage.local</code> expires automatically after 1 hour. You can remove all stored data at any time by uninstalling the Extension or clearing Chrome extension storage.</p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>6. Third-Party Services</h2>
        <p>The Extension communicates only with:</p>
        <ul style={{ paddingLeft: 24 }}>
          <li><strong>zudobot.zudogu.com</strong> — to fetch your embed snippet after authentication.</li>
          <li><strong>Google APIs (googleapis.com)</strong> — to verify your Google identity token.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>7. Contact</h2>
        <p>If you have questions about this privacy policy, please contact us at:</p>
        <p><strong>Zudogu Co., Ltd.</strong><br />Email: <a href="mailto:zudogu.official@gmail.com" style={{ color: "#2563eb" }}>zudogu.official@gmail.com</a><br />Website: <a href="https://zudogu.com" style={{ color: "#2563eb" }}>https://zudogu.com</a></p>
      </section>
    </main>
  );
}
