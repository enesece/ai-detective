import "server-only";

import { z } from "zod";
import { getGitHubEnv } from "@/server/env";

/*
 * Case generation can take 5-15 minutes; a Vercel function stops after 300 s.
 * So the admin panel only asks GitHub Actions to run `npm run generate`
 * (.github/workflows/generate-case.yml) and shows how those runs are doing.
 */

const WORKFLOW_FILE = "generate-case.yml";
const API = "https://api.github.com";

type Runner = { token: string; repo: string };

/** The GitHub settings, or null when generation should run in-process (local dev). */
export function getGenerationRunner(): Runner | null {
  const env = getGitHubEnv();
  return env.GITHUB_DISPATCH_TOKEN && env.GITHUB_REPO
    ? { token: env.GITHUB_DISPATCH_TOKEN, repo: env.GITHUB_REPO }
    : null;
}

function headers(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Starts one generation run. Throws with a short reason if GitHub refuses. */
export async function dispatchGeneration(
  runner: Runner,
  input: { difficulty: "easy" | "medium" | "hard"; theme?: string },
): Promise<void> {
  const response = await fetch(
    `${API}/repos/${runner.repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: { ...headers(runner.token), "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: "main",
        inputs: { difficulty: input.difficulty, theme: input.theme ?? "" },
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    // 401/403: token wrong or missing "Actions: write"; 404: repo or workflow file not found.
    throw new Error(`GitHub refused to start the run (${response.status}).`);
  }
}

const RunsSchema = z.object({
  workflow_runs: z.array(
    z.object({
      id: z.number(),
      display_title: z.string(),
      status: z.string(), // queued, in_progress, completed, ...
      conclusion: z.string().nullable(), // success, failure, cancelled, ...
      created_at: z.string(),
      updated_at: z.string(),
      html_url: z.url(),
    }),
  ),
});

export type GenerationRun = z.infer<typeof RunsSchema>["workflow_runs"][number];

/** The latest generation runs, newest first; empty if GitHub can't be reached. */
export async function listGenerationRuns(runner: Runner, limit = 5): Promise<GenerationRun[]> {
  try {
    const response = await fetch(
      `${API}/repos/${runner.repo}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=${limit}`,
      { headers: headers(runner.token), signal: AbortSignal.timeout(10_000), cache: "no-store" },
    );
    if (!response.ok) return [];
    const parsed = RunsSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.workflow_runs : [];
  } catch {
    return [];
  }
}
