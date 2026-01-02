#!/usr/bin/env bun
/**
 * YAML to JSON Converter
 *
 * Converts tools.yaml to tools.json for NGINX njs consumption.
 * njs cannot parse YAML directly, so we pre-convert at build/reload time.
 *
 * Usage: bun run scripts/yaml-to-json.ts
 */

import { parse } from "yaml";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";

const SCRIPT_DIR = dirname(import.meta.path);
const CONFIG_DIR = join(SCRIPT_DIR, "..", "config");

const YAML_PATH = join(CONFIG_DIR, "tools.yaml");
const JSON_PATH = join(CONFIG_DIR, "tools.json");

try {
  // Read YAML
  const yamlContent = readFileSync(YAML_PATH, "utf-8");
  const config = parse(yamlContent);

  // Write JSON for njs
  writeFileSync(JSON_PATH, JSON.stringify(config, null, 2));

  console.log(`✅ Converted ${config.tools?.length || 0} tools to tools.json`);
  console.log(`   Source: ${YAML_PATH}`);
  console.log(`   Output: ${JSON_PATH}`);
} catch (error) {
  console.error("❌ Failed to convert:", error);
  process.exit(1);
}
