// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Pipeline Logger
// Consistent, timestamped logging for all pipeline steps
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function ts(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 23);
}

function elapsed(start: number): string {
  const ms = Date.now() - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

/** Truncate string to maxLen chars, add "…" if truncated */
function trunc(s: string, maxLen: number): string {
  const clean = s.replace(/\n/g, " ↵ ").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen) + "…";
}

export function createPipelineLogger(pipeline: string, projectId: string) {
  const pipelineStart = Date.now();
  const tag = `[${pipeline}][${projectId.substring(0, 8)}]`;

  return {
    /** Pipeline header */
    header(title: string, details?: Record<string, any>) {
      console.log(
        `\n${COLORS.bright}${COLORS.cyan}${"═".repeat(70)}${COLORS.reset}`,
      );
      console.log(`${COLORS.bright}${COLORS.cyan}  ${title}${COLORS.reset}`);
      console.log(
        `${COLORS.gray}  ${ts()} | Project: ${projectId}${COLORS.reset}`,
      );
      if (details) {
        for (const [k, v] of Object.entries(details)) {
          console.log(`${COLORS.gray}  ${k}: ${v}${COLORS.reset}`);
        }
      }
      console.log(`${COLORS.cyan}${"═".repeat(70)}${COLORS.reset}\n`);
    },

    /** Phase separator */
    phase(num: number, title: string) {
      console.log(
        `${COLORS.bright}${COLORS.blue}  ━━━ Phase ${num}: ${title} ━━━${COLORS.reset}`,
      );
    },

    /** Step within a phase */
    step(msg: string) {
      console.log(`${COLORS.gray}  ${ts()}${COLORS.reset} ${tag} ${msg}`);
    },

    /** Success */
    ok(msg: string) {
      console.log(
        `${COLORS.gray}  ${ts()}${COLORS.reset} ${tag} ${COLORS.green}✅ ${msg}${COLORS.reset}`,
      );
    },

    /** Warning */
    warn(msg: string) {
      console.log(
        `${COLORS.gray}  ${ts()}${COLORS.reset} ${tag} ${COLORS.yellow}⚠️  ${msg}${COLORS.reset}`,
      );
    },

    /** Error */
    err(msg: string, error?: any) {
      console.log(
        `${COLORS.gray}  ${ts()}${COLORS.reset} ${tag} ${COLORS.red}❌ ${msg}${COLORS.reset}`,
      );
      if (error) {
        const errMsg = error?.message || String(error);
        console.log(`${COLORS.red}     ${errMsg}${COLORS.reset}`);
        if (error?.stack) {
          const stackLines = error.stack
            .split("\n")
            .slice(1, 4)
            .map((l: string) => `     ${l.trim()}`);
          console.log(`${COLORS.dim}${stackLines.join("\n")}${COLORS.reset}`);
        }
      }
    },

    /** Data/stats line */
    data(label: string, value: any) {
      console.log(
        `${COLORS.gray}  ${ts()}${COLORS.reset} ${tag}   📊 ${label}: ${COLORS.bright}${value}${COLORS.reset}`,
      );
    },

    /** API call tracking */
    api(
      model: string,
      inputTokens: number,
      outputTokens: number,
      durationMs?: number,
    ) {
      const dur = durationMs ? ` (${elapsed(Date.now() - durationMs)})` : "";
      console.log(
        `${COLORS.gray}  ${ts()}${COLORS.reset} ${tag}   🤖 ${model} | in: ${inputTokens} | out: ${outputTokens}${dur}`,
      );
    },

    /** Claude API request preview — shows truncated prompt (max 500 chars) */
    claudeReq(label: string, prompt: string) {
      console.log(
        `${COLORS.gray}  ${ts()}${COLORS.reset} ${tag}   ${COLORS.magenta}📤 [${label}] REQ: ${trunc(prompt, 500)}${COLORS.reset}`,
      );
    },

    /** Claude API response preview — shows truncated response (max 500 chars) */
    claudeRes(label: string, response: string) {
      console.log(
        `${COLORS.gray}  ${ts()}${COLORS.reset} ${tag}   ${COLORS.cyan}📥 [${label}] RES: ${trunc(response, 500)}${COLORS.reset}`,
      );
    },

    /** Pipeline footer with total elapsed time */
    footer(status: "SUCCESS" | "ERROR", summary?: string) {
      const color = status === "SUCCESS" ? COLORS.green : COLORS.red;
      const icon = status === "SUCCESS" ? "✅" : "❌";
      console.log(`\n${color}${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
      console.log(
        `${color}  ${icon} ${pipeline} ${status} — ${elapsed(pipelineStart)}${COLORS.reset}`,
      );
      if (summary) console.log(`${color}  ${summary}${COLORS.reset}`);
      console.log(`${color}${"═".repeat(70)}${COLORS.reset}\n`);
    },

    /** Timer helper */
    timer() {
      const start = Date.now();
      return () => elapsed(start);
    },
  };
}
