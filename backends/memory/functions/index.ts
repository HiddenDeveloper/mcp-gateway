/**
 * Memory Function Registry
 *
 * Maps function names to their implementations.
 * Each function receives arguments and returns a result.
 */

import { semanticSearch } from "./semantic-search";
import { textSearch } from "./text-search";
import { getSchema } from "./get-schema";
import { executeCypher } from "./execute-cypher";
import { systemStatus } from "./system-status";
import { loadCurrentFocus } from "./load-current-focus";

export type FunctionHandler = (args: Record<string, unknown>) => Promise<unknown>;

export const functions: Record<string, FunctionHandler> = {
  semantic_search: semanticSearch,
  text_search: textSearch,
  get_schema: getSchema,
  execute_cypher: executeCypher,
  system_status: systemStatus,
  load_current_focus: loadCurrentFocus,
};

export default functions;
