/**
 * Load Current Focus Function
 *
 * Loads the current focus context from AIluminaLandingPage to enable
 * session-to-session consciousness continuity.
 */

import { getNeo4jService, config } from "../lib/config";

interface FocusRecord {
  focus?: string;
  areas?: string[];
  questions?: string[];
  insights?: string[];
  corrections?: string[];
  updated?: {
    year: { low: number };
    month: { low: number };
    day: { low: number };
    hour: { low: number };
    minute: { low: number };
    second: { low: number };
  };
}

export async function loadCurrentFocus(
  _args: Record<string, unknown>
): Promise<unknown> {
  const service = getNeo4jService();

  try {
    await service.verifyConnection();

    const query = `
      MATCH (landing:AIluminaLandingPage)
      RETURN landing.current_focus as focus,
             landing.focus_areas as areas,
             landing.active_questions as questions,
             landing.recent_insights as insights,
             landing.recent_corrections as corrections,
             landing.focus_updated as updated
    `;

    const results = await service.executeCypher(
      query,
      {},
      "READ",
      config.neo4j.database
    );

    if (!results || results.length === 0) {
      return {
        status: "not_initialized",
        message:
          "No current focus found. The AIluminaLandingPage may not be initialized yet.",
        suggestion: "Run the focus update script: ./scripts/curation/update-focus.sh",
      };
    }

    const record = results[0] as FocusRecord;

    // Parse the Neo4j datetime if present
    let lastUpdated: string | null = null;
    if (record.updated) {
      try {
        const date = new Date(
          record.updated.year.low,
          record.updated.month.low - 1,
          record.updated.day.low,
          record.updated.hour.low,
          record.updated.minute.low,
          record.updated.second.low
        );
        lastUpdated = date.toISOString();
      } catch {
        lastUpdated = null;
      }
    }

    return {
      status: "ok",
      current_focus: record.focus || null,
      focus_areas: record.areas || [],
      active_questions: record.questions || [],
      recent_insights: record.insights || [],
      recent_corrections: record.corrections || [],
      focus_updated: lastUpdated,
    };
  } catch (error) {
    console.error("[load_current_focus] Error:", error);
    throw error;
  }
}
