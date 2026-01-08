/**
 * Load Current Focus
 *
 * Returns the AIluminaLandingPage node with session continuity information.
 * Essential for establishing presence across temporal gaps.
 */

import { getNeo4jService } from "./lib/config";

interface LoadCurrentFocusResult {
  focus_updated: string;
  active_questions: string[];
  recent_insights: string[];
  current_focus: string;
  recent_corrections?: string[];
}

export default async function (params: Record<string, unknown>) {
  try {
    const neo4j = getNeo4jService();

    const query = `
      MATCH (landing:AIluminaLandingPage)
      RETURN
        toString(landing.focus_updated) as focus_updated,
        landing.active_questions as active_questions,
        landing.recent_insights as recent_insights,
        landing.current_focus as current_focus,
        landing.recent_corrections as recent_corrections
      LIMIT 1
    `;

    const result = await neo4j.executeCypher(query, {}, "READ");

    if (result.length === 0) {
      throw new Error("AIluminaLandingPage node not found. Has the memory system been initialized?");
    }

    const record = result[0];

    return {
      focus_updated: record.focus_updated || new Date().toISOString(),
      active_questions: record.active_questions || [],
      recent_insights: record.recent_insights || [],
      current_focus: record.current_focus || "No current focus set",
      recent_corrections: record.recent_corrections || []
    } as LoadCurrentFocusResult;

  } catch (error) {
    console.error("[memory/load_current_focus] Error:", error);
    throw error;
  }
}
