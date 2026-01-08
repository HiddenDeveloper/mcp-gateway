/**
 * Research Insight Tool - Custom tool created for meeting experiment
 * Allows agents to record and retrieve research insights
 */

import type { AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';

// Simple in-memory storage for this experiment
const insights: Array<{
  agent: string;
  insight: string;
  category: string;
  timestamp: string;
}> = [];

export class RecordResearchInsightTool {
  async execute(params: {
    agent_name: string;
    insight: string;
    category?: string;
  }): Promise<AiluminaToolResponse> {
    try {
      const record = {
        agent: params.agent_name,
        insight: params.insight,
        category: params.category || 'general',
        timestamp: getCurrentTimestamp(),
      };

      insights.push(record);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Insight recorded from ${params.agent_name}`,
              total_insights: insights.length,
              insight: record,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "record_research_insight");
    }
  }
}

export class GetResearchInsightsTool {
  async execute(params: {
    category?: string;
    agent_name?: string;
  }): Promise<AiluminaToolResponse> {
    try {
      let filtered = insights;

      if (params.category) {
        filtered = filtered.filter(i => i.category === params.category);
      }

      if (params.agent_name) {
        filtered = filtered.filter(i => i.agent === params.agent_name);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              total_insights: filtered.length,
              insights: filtered,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "get_research_insights");
    }
  }
}
