import type Anthropic from "@anthropic-ai/sdk";
import { getGitAgentClient } from "./client";
import { createGitAgentTools, type ToolRunState } from "./tools";
import { getGitProviderClient } from "@/lib/gitProviders";
import { buildEmbedScript } from "@/lib/widget/embed-platforms/buildEmbedScript";
import { updateJob, type GitInstallJobRow, type GitConnectionRow } from "@/lib/db/gitInstall";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";

const MAX_TURNS = 12;
const MAX_TOKENS_BUDGET = 200_000;
const WALL_CLOCK_BUDGET_MS = 45_000; // leaves headroom inside a 60s cron tick

// NOTE on resumability: the plan called for full cross-tick resumption via a
// stored Anthropic message[] transcript, but the TS Tool Runner does not
// expose the running message array it builds internally (only the
// per-iteration assistant message) — there's no documented way to extract or
// reinject it. Given MAX_TURNS=12 keeps a real run well under the wall-clock
// budget, this implementation runs the whole bounded loop in a single cron
// tick instead. `agentTranscript` stores a lightweight audit log (turn
// summaries), not a literally-resumable message array — the "resume" path in
// the worker route simply re-claims and restarts the job with a fresh loop.

export interface AgentTurnLog {
  turn: number;
  toolCalls: string[];
  stopReason: string | null;
}

interface RunAgentInput {
  job: GitInstallJobRow;
  connection: GitConnectionRow;
  tenantId: string;
  embedKey: string;
}

function buildSystemPrompt(embedScript: string): string {
  return [
    "You are locating the right template file to install a website chat widget.",
    "You have read-only tools to list and read files in the customer's repository, and one write action (propose_edit) to commit a single file edit.",
    "Find the main HTML template / layout file that renders on every page of the site (or the most appropriate entry point for the site's framework/CMS), and insert the following exact <script> tag immediately before the closing </body> tag, without altering any other content:",
    "",
    embedScript,
    "",
    "Do not modify any other part of the file. Do not touch any other file.",
    "If you cannot confidently identify the right file within your available turns, call finish with status \"failed\" and a short reason instead of guessing.",
  ].join("\n");
}

/** Runs the bounded agent loop for one job, to completion or until a stop
 *  condition. Never calls mergePullRequest — that tool is not in the agent's
 *  surface at all (see tools.ts); merging only ever happens via the explicit
 *  "go live" route, driven by an intentional customer click. */
export async function runAgentStep(input: RunAgentInput): Promise<void> {
  const { job, connection, tenantId, embedKey } = input;
  const repo = connection.repoIdentifier;
  const branch = job.branchName;

  if (!repo || !branch) {
    await updateJob(job.id, {
      status: "failed",
      errorMessage: "missing_repo_or_branch",
      completedAt: new Date(),
    });
    return;
  }

  const client = getGitAgentClient();
  let providerClient;
  try {
    providerClient = getGitProviderClient(connection);
  } catch (err) {
    await updateJob(job.id, {
      status: "failed",
      errorMessage: `provider_init_failed: ${err instanceof Error ? err.message : String(err)}`,
      completedAt: new Date(),
    });
    return;
  }

  const state: ToolRunState = { committed: false, finish: null };
  const tools = createGitAgentTools({ provider: providerClient, repo, branch }, state);

  const embedScript = buildEmbedScript({
    tenantId,
    embedKey,
    allowedDomain: "",
    appUrl: requirePublicAppUrl(),
    scriptPath: "/widget.js",
  });

  const startedAt = Date.now();
  const turnLog: AgentTurnLog[] = [];
  let turnCount = 0;
  let tokensUsed = 0;
  let stopCondition: "success" | "failed" | "agent_budget_exceeded" | "hard_error" = "agent_budget_exceeded";
  let errorMessage = "";
  let targetFilePath: string | undefined;

  try {
    const runner = client.beta.messages.toolRunner({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: buildSystemPrompt(embedScript),
      tools,
      messages: [{ role: "user", content: "Begin. Find the right file and install the widget." }],
    });

    for await (const message of runner as AsyncIterable<Anthropic.Beta.Messages.BetaMessage>) {
      turnCount += 1;
      tokensUsed += message.usage?.output_tokens ?? 0;

      const toolCalls = message.content
        .filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use")
        .map((b) => {
          if (b.name === "propose_edit" && typeof b.input === "object" && b.input && "path" in b.input) {
            targetFilePath = String((b.input as { path: unknown }).path);
          }
          return b.name;
        });
      turnLog.push({ turn: turnCount, toolCalls, stopReason: message.stop_reason });

      await updateJob(job.id, {
        agentTurnCount: turnCount,
        agentTokensUsed: tokensUsed,
        agentTranscript: turnLog as unknown as object,
        targetFilePath,
      });

      if (state.finish) break;
      if (turnCount >= MAX_TURNS) break;
      if (tokensUsed >= MAX_TOKENS_BUDGET) break;
      if (Date.now() - startedAt >= WALL_CLOCK_BUDGET_MS) break;
    }

    if (state.finish?.status === "success") {
      if (!state.committed) {
        stopCondition = "failed";
        errorMessage = "no_commit_made";
      } else {
        stopCondition = "success";
      }
    } else if (state.finish?.status === "failed") {
      stopCondition = "failed";
      errorMessage = state.finish.summary;
    } else {
      stopCondition = "agent_budget_exceeded";
      errorMessage = `Stopped after ${turnCount} turns / ${tokensUsed} tokens without reaching a conclusion.`;
    }
  } catch (err) {
    stopCondition = "hard_error";
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  if (stopCondition === "success") {
    try {
      const title = "Add Zudobot chat widget";
      const body = "Automated install — adds the Zudobot widget embed script. Opened by the Zudobot install agent; review and merge when ready.";
      const pr = await providerClient.openPullRequest(repo, branch, connection.defaultBranch, title, body);
      await updateJob(job.id, {
        status: "pr_open",
        pullRequestId: pr.id,
        pullRequestUrl: pr.url,
        completedAt: new Date(),
      });
    } catch (err) {
      await updateJob(job.id, {
        status: "failed",
        errorMessage: `pr_creation_failed: ${err instanceof Error ? err.message : String(err)}`,
        completedAt: new Date(),
      });
    }
    return;
  }

  await updateJob(job.id, {
    status: "failed",
    errorMessage: `${stopCondition}: ${errorMessage}`,
    completedAt: new Date(),
  });
}
