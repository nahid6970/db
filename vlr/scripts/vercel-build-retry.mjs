import { spawn } from "node:child_process";

const maxAttempts = 3;
const retryDelaysMs = [5_000, 15_000];
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function runCommand(args) {
  return new Promise((resolve) => {
    const output = [];
    const child = spawn(npxCommand, args, {
      env: process.env,
      shell: false,
    });

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      output.push(chunk.toString());
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      output.push(chunk.toString());
    });

    child.on("close", (code) => {
      resolve({ code, output: output.join("") });
    });
  });
}

function isRetryableConvexFailure(output) {
  return (
    output.includes("Unable to run schema validation") &&
    (output.includes("502 Bad Gateway") || output.includes("/api/prepare_schema"))
  );
}

const codegenResult = await runCommand(["convex", "codegen"]);
if (codegenResult.code !== 0) {
  process.exit(codegenResult.code ?? 1);
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  if (attempt > 1) {
    console.log(`Retrying Convex deploy (${attempt}/${maxAttempts})...`);
  }

  const result = await runCommand(["convex", "deploy", "--cmd", "next build"]);
  if (result.code === 0) {
    process.exit(0);
  }

  if (attempt === maxAttempts || !isRetryableConvexFailure(result.output)) {
    process.exit(result.code ?? 1);
  }

  const delayMs = retryDelaysMs[attempt - 1] ?? retryDelaysMs.at(-1);
  console.log(`Convex schema validation returned a transient gateway error. Waiting ${delayMs / 1000}s before retrying...`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
