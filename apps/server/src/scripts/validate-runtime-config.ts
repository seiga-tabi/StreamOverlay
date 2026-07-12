import { validateRuntimeConfig } from "../config.js";

const result = validateRuntimeConfig();

if (!result.ok) {
  for (const error of result.errors) console.error(`[runtime] ${error}`);
  console.error(`Runtime config validation failed: ${result.errors.length}개 오류`);
  process.exit(1);
}

console.log("Runtime config validation passed");
