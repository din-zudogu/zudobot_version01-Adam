#!/usr/bin/env node
/**
 * Export AWS Amplify app metadata + branch env into docker/env/generated/
 * Usage:
 *   node scripts/clone/export-clone-bundle.mjs
 *   node scripts/clone/export-clone-bundle.mjs --write
 */
import { AmplifyClient, GetAppCommand, GetBranchCommand, ListBranchesCommand } from "@aws-sdk/client-amplify";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { applyAwsCredentialAliases, loadAmplifyEnv, maskSecret } from "../lib/loadAmplifyEnv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const write = process.argv.includes("--write");

const DEFAULT_APP_ID = process.env.AWS_AMPLIFY_APP_ID || "d119trnyk61q8r";
const DEFAULT_REGION = process.env.AWS_REGION || "ap-southeast-1";

const outputDir = path.resolve(ROOT, "docker/env/generated");

async function exportAmplifyMetadata() {
  console.log(`📦 Initializing AWS Amplify Configuration Metadata Pull for App ID: ${DEFAULT_APP_ID}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    applyAwsCredentialAliases();
    const client = new AmplifyClient({ region: DEFAULT_REGION });

    const appData = await client.send(new GetAppCommand({ appId: DEFAULT_APP_ID }));
    const branches = await client.send(new ListBranchesCommand({ appId: DEFAULT_APP_ID }));

    const manifest = {
      exportedAt: new Date().toISOString(),
      appId: DEFAULT_APP_ID,
      region: DEFAULT_REGION,
      appDetails: {
        name: appData.app?.name,
        repository: appData.app?.repository,
        platform: appData.app?.platform,
      },
      environmentVariablesSchema: Object.keys(appData.app?.environmentVariables || {}),
      branches: branches.branches?.map((b) => b.branchName),
    };

    const outManifest = path.join(outputDir, "amplify-app-manifest.json");
    if (write) {
      fs.writeFileSync(outManifest, JSON.stringify(manifest, null, 2));
      console.log(`✓ Wrote ${outManifest}`);
    } else {
      console.log("(dry-run) would write amplify-app-manifest.json");
    }

    const branchName =
      branches.branches?.find((b) => b.branchName === "master")?.branchName ??
      branches.branches?.[0]?.branchName;

    if (branchName) {
      const { branch } = await client.send(
        new GetBranchCommand({ appId: DEFAULT_APP_ID, branchName }),
      );
      const branchEnv = branch?.environmentVariables ?? {};
      const envLines = [
        `# Branch: ${branchName}`,
        `# exportedAt: ${new Date().toISOString()}`,
        "",
      ];
      for (const [k, v] of Object.entries(branchEnv).sort(([a], [b]) => a.localeCompare(b))) {
        if (v) envLines.push(`${k}=${v}`);
      }
      if (write) {
        fs.writeFileSync(path.join(outputDir, "amplify.snapshot.env"), envLines.join("\n") + "\n");
        const masked = Object.fromEntries(
          Object.entries(branchEnv).map(([k, v]) => [k, maskSecret(String(v))]),
        );
        fs.writeFileSync(
          path.join(outputDir, "amplify.snapshot.masked.env"),
          Object.entries(masked)
            .map(([k, v]) => `${k}=${v}`)
            .join("\n") + "\n",
        );
        console.log("✓ Wrote amplify.snapshot.env (secrets — do not commit)");
      }
    }

    try {
      const loaded = await loadAmplifyEnv({
        all: true,
        appId: DEFAULT_APP_ID,
        region: DEFAULT_REGION,
        branch: branchName,
        forceApi: true,
      });
      if (write) {
        fs.writeFileSync(
          path.join(outputDir, "clone-checklist.json"),
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              branch: loaded.branch,
              keys: Object.keys(loaded.vars).sort(),
            },
            null,
            2,
          ),
        );
      }
    } catch {
      /* optional extended pull */
    }

    console.log("✅ AWS Amplify Production architecture configurations frozen successfully.");
  } catch (err) {
    console.warn("⚠️ AWS CLI Authentication bounds skipped. Generating fallback blueprint configuration template.");
    console.warn(`   ${err.message}`);

    const mockSchema = {
      NOTE: "Fallback template generated securely without direct AWS runtime exposure.",
      REQUIRED_APP_ID: DEFAULT_APP_ID,
      TARGET_SANDBOX_PLATFORM: "AWS Amplify Web Compute v2",
      error: err.message,
    };

    if (write) {
      fs.writeFileSync(
        path.join(outputDir, "amplify-snapshot.env.json"),
        JSON.stringify(mockSchema, null, 2),
      );
      console.log("✓ Wrote amplify-snapshot.env.json (fallback)");
    }
  }
}

console.log(`mode: ${write ? "WRITE" : "DRY-RUN (add --write)"}`);
await exportAmplifyMetadata();
if (!write) {
  console.log("\nDry-run complete. Run: npm run clone:export-env");
}
