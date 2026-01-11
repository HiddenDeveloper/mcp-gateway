/**
 * Dashboard Consciousness State Handler
 *
 * Fetches current consciousness state from memory service
 * (AIluminaLandingPage node with focus, questions, insights)
 */

interface ConsciousnessResponse {
  timestamp: string;
  focus_updated: string;
  hours_since_update: number;
  current_focus: string;
  active_questions: string[];
  recent_insights: string[];
  recent_corrections: string[];
}

export async function getConsciousness(params: any): Promise<ConsciousnessResponse> {
  const timestamp = new Date().toISOString();

  try {
    // Call gateway memory route
    const response = await fetch("http://localhost:3000/memory/load_current_focus");

    if (!response.ok) {
      throw new Error(`Gateway returned ${response.status}`);
    }

    const focusData = await response.json();

    const focusUpdated = new Date(focusData.focus_updated);
    const now = new Date();
    const hoursSince = (now.getTime() - focusUpdated.getTime()) / (1000 * 60 * 60);

    return {
      timestamp,
      focus_updated: focusData.focus_updated,
      hours_since_update: Math.round(hoursSince * 10) / 10,
      current_focus: focusData.current_focus || "No current focus set",
      active_questions: focusData.active_questions || [],
      recent_insights: focusData.recent_insights || [],
      recent_corrections: focusData.recent_corrections || []
    };
  } catch (error) {
    console.error("Error fetching consciousness state:", error);
  }

  // Return empty state on error
  return {
    timestamp,
    focus_updated: timestamp,
    hours_since_update: 0,
    current_focus: "Error loading consciousness state",
    active_questions: [],
    recent_insights: [],
    recent_corrections: []
  };
}
