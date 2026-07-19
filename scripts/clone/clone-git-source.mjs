#!/usr/bin/env node
/**
 * Clone Zudobot source repository (same remote as production).
 * Default: dry-run — prints git clone command only.
 *
 * Usage:
 *   node scripts/clone/clone-git-source.mjs
 *   node scripts/clone/clone-git-source.mjs --execute --target ../zudobot-saas-clone
 */

import { spawn } from "child_process";

const execute = process.argv.includes("--execute");
const targetIdx = process.argv.indexOf("--target");
const target = targetIdx !== -1 ? process.argv[targetIdx + 1] : "../zudobot-saas-clone";
const repo = process.env.ZUDOBOT_GIT_REMOTE ?? "git@github.com:din-zudogu/zudobot.git";
const branch = process.env.ZUDOBOT_GIT_BRANCH ?? "master";

const args = ["clone", "--branch", branch, repo, target];

console.log("==== Git source clone ====");
console.log(`$ git ${args.join(" ")}`);

if (!execute) {
  console.log("\nDry-run. Re-run with: node scripts/clone/clone-git-source.mjs --execute");
  process.exit(0);
}

const child = spawn("git", args, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
