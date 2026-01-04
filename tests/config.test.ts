import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SCHEMA_PATH = join(PROJECT_ROOT, "src", "config.schema.json");
const CONFIG_PATH = join(PROJECT_ROOT, "examples", "gateway.json");

describe("Config Schema Validation", () => {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);

  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
  const validate = ajv.compile(schema);

  it("schema itself is valid JSON Schema", () => {
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(schema.type).toBe("object");
    expect(schema.required).toContain("gateway");
    expect(schema.required).toContain("services");
  });

  it("gateway.json is valid against schema", () => {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

    const valid = validate(config);

    if (!valid) {
      console.error("Validation errors:", validate.errors);
    }

    expect(valid).toBe(true);
  });

  it("gateway.json has required OpenAPI-compatible structure", () => {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

    // Gateway level
    expect(config.gateway).toBeDefined();
    expect(config.gateway.info).toBeDefined();
    expect(config.gateway.info.title).toBeString();
    expect(config.gateway.info.version).toBeString();
    expect(config.gateway.service_card).toBeDefined();
    expect(config.gateway.service_card.operationId).toBeString();
    expect(config.gateway.service_card.summary).toBeString();

    // Services level
    expect(config.services).toBeArray();
    expect(config.services.length).toBeGreaterThan(0);

    // Each service has servers, service_card, and paths
    for (const service of config.services) {
      expect(service.servers).toBeArray();
      expect(service.servers.length).toBeGreaterThan(0);
      expect(service.servers[0].url).toBeString();

      expect(service.service_card).toBeDefined();
      expect(service.service_card.operationId).toBeString();
      expect(service.service_card.summary).toBeString();

      // Paths are OpenAPI-compatible
      if (service.paths) {
        for (const [path, pathItem] of Object.entries(service.paths)) {
          expect(path).toStartWith("/");
          const item = pathItem as Record<string, any>;

          // Each path has at least one HTTP method
          const methods = ["get", "post", "put", "patch", "delete"];
          const hasMethod = methods.some(m => m in item);
          expect(hasMethod).toBe(true);

          // Each operation has operationId and summary
          for (const method of methods) {
            if (item[method]) {
              expect(item[method].operationId).toBeString();
              expect(item[method].summary).toBeString();
            }
          }
        }
      }
    }
  });

  it("rejects invalid config", () => {
    const invalidConfig = {
      gateway: {
        // missing info and service_card
      },
      services: []
    };

    const valid = validate(invalidConfig);
    expect(valid).toBe(false);
  });

  it("rejects service without servers", () => {
    const invalidConfig = {
      gateway: {
        info: {
          title: "test",
          version: "1.0.0"
        },
        service_card: {
          operationId: "gateway",
          summary: "test"
        }
      },
      services: [
        {
          // missing servers
          service_card: {
            operationId: "memory",
            summary: "test"
          }
        }
      ]
    };

    const valid = validate(invalidConfig);
    expect(valid).toBe(false);
  });
});
