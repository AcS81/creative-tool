import { spawn } from "node:child_process";

const spawnScript = (command: string, args: string[]) =>
  spawn(command, args, {
    stdio: "inherit",
    shell: true,
  });

const dev = spawnScript("npm", ["run", "dev"]);
const worker = spawnScript("npm", ["run", "worker"]);

const shutdown = () => {
  dev.kill("SIGTERM");
  worker.kill("SIGTERM");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

dev.on("exit", (code) => {
  if (code && code !== 0) {
    worker.kill("SIGTERM");
    process.exit(code);
  }
});

worker.on("exit", (code) => {
  if (code && code !== 0) {
    dev.kill("SIGTERM");
    process.exit(code);
  }
});
