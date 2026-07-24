import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { GitProviderClient } from "@/lib/gitProviders/types";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "vendor"]);
const MAX_TREE_ENTRIES = 200;
const MAX_FILE_CHARS = 40_000;

export interface AgentToolContext {
  provider: GitProviderClient;
  repo: string;
  branch: string;
}

/** Set by the `finish` tool's run() — the orchestrator reads this after each
 *  iteration to decide whether to stop. `finish` is the ONLY way the loop
 *  ends on a structured outcome; it never calls any provider API itself. */
export interface FinishSignal {
  status: "success" | "failed";
  summary: string;
}

/** Tracks whether propose_edit was actually invoked this run, so a
 *  finish("success") claim without a real commit is caught and downgraded
 *  to failed("no_commit_made") by the orchestrator. */
export interface ToolRunState {
  committed: boolean;
  finish: FinishSignal | null;
}

/**
 * Builds the agent's tool set, bound to one job's provider client/repo/branch.
 * Only 4 tools exist. Notably absent: createBranch (done deterministically by
 * the orchestrator before the loop starts) and mergePullRequest (never
 * exposed to the model at all — merging is only ever called by the explicit
 * "go live" route, never by the agent).
 */
export function createGitAgentTools(ctx: AgentToolContext, state: ToolRunState) {
  const list_files = betaZodTool({
    name: "list_files",
    description:
      "List files and directories in the repository at the given path (relative to repo root). " +
      "Use this to explore the project structure and find the main HTML/template file that renders " +
      "on every page of the site.",
    inputSchema: z.object({
      path: z.string().optional().describe("Directory path relative to repo root. Omit for the repo root."),
    }),
    run: async ({ path }) => {
      const entries = await ctx.provider.listTree(ctx.repo, ctx.branch, path ?? "");
      const filtered = entries
        .filter((e) => !SKIP_DIRS.has(e.path.split("/").pop() ?? ""))
        .slice(0, MAX_TREE_ENTRIES);
      const truncated = entries.length > MAX_TREE_ENTRIES;
      return JSON.stringify({
        entries: filtered.map((e) => ({ path: e.path, type: e.type })),
        truncated,
      });
    },
  });

  const read_file = betaZodTool({
    name: "read_file",
    description: "Read the contents of a single file in the repository, given its path relative to repo root.",
    inputSchema: z.object({
      path: z.string().describe("File path relative to repo root."),
    }),
    run: async ({ path }) => {
      const { content } = await ctx.provider.readFile(ctx.repo, ctx.branch, path);
      if (content.length > MAX_FILE_CHARS) {
        return content.slice(0, MAX_FILE_CHARS) + "\n[truncated — file too large, pick a more specific file]";
      }
      return content;
    },
  });

  const propose_edit = betaZodTool({
    name: "propose_edit",
    description:
      "Commit a full replacement of one file's content to the working branch. This is the ONLY way to make " +
      "a change — use it once you've found the right template file and prepared its exact new content " +
      "(the original content with the widget script tag inserted immediately before </body>, nothing else altered).",
    inputSchema: z.object({
      path: z.string().describe("File path relative to repo root."),
      new_content: z.string().describe("The complete new file content."),
      commit_message: z.string().describe("A short, descriptive commit message."),
    }),
    run: async ({ path, new_content, commit_message }) => {
      const result = await ctx.provider.commitFile(ctx.repo, ctx.branch, path, new_content, commit_message);
      state.committed = true;
      return `Committed. New commit: ${result.commitSha}`;
    },
  });

  const finish = betaZodTool({
    name: "finish",
    description:
      "Call this exactly once when you are done — either because you successfully installed the widget " +
      "(status: success, after calling propose_edit) or because you cannot confidently identify the right " +
      "file to edit within your available turns (status: failed, explain why in summary).",
    inputSchema: z.object({
      status: z.enum(["success", "failed"]),
      summary: z.string().describe("A short, human-readable explanation of the outcome."),
    }),
    run: async ({ status, summary }) => {
      state.finish = { status, summary };
      return "Recorded.";
    },
  });

  return [list_files, read_file, propose_edit, finish];
}
