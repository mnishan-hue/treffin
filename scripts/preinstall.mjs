const agent = process.env.npm_config_user_agent ?? "";
const execPath = process.env.npm_execpath ?? "";
if (!agent.startsWith("pnpm/") && !execPath.toLowerCase().includes("pnpm")) {
  console.error("Use pnpm instead");
  process.exit(1);
}