/**
 * Create Meeting from DSL Tool
 *
 * Progressive validation approach:
 * 1. Load and validate DSL schema
 * 2. Pre-flight check: Verify orchestrator exists and has mesh + memory access
 * 3. Pre-flight check: Verify each participant exists and has mesh + memory access
 * 4. Mesh subscription validation: Direct agents to subscribe and verify active connection
 * 5. Create meeting structure in mesh network
 * 6. Return meetingId for execution via mesh-coordinate-meeting
 */

import type { AiluminaToolResponse } from '../types.js';
import { handleError } from '../utils/errors.js';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import { AILUMINA_TOOLS } from './index.js';

interface AgentValidationResult {
  agentName: string;
  exists: boolean;
  hasMesh: boolean;
  hasMemory: boolean;
  error?: string;
}

interface MeshSubscriptionResult {
  agentName: string;
  subscribed: boolean;
  subscribedName?: string;
  verifiedOnMesh: boolean;
  error?: string;
}

export class CreateMeetingFromDslTool {
  private mcpClientManager: any;
  private agentConfigLoader: any;

  setMCPClientManager(manager: any) {
    this.mcpClientManager = manager;
  }

  setAgentConfigLoader(loader: any) {
    this.agentConfigLoader = loader;
  }

  /**
   * Validate agent exists and has required tool access
   */
  private async validateAgent(
    agentName: string,
    role: 'orchestrator' | 'participant'
  ): Promise<AgentValidationResult> {
    console.log(`🔍 Validating ${role}: ${agentName}`);

    const result: AgentValidationResult = {
      agentName,
      exists: false,
      hasMesh: false,
      hasMemory: false,
    };

    try {
      // Step 1: Check if agent exists by attempting to chat with it
      console.log(`   Step 1: Checking if ${agentName} responds...`);

      const presenceCheck = await AILUMINA_TOOLS.ailumina_chat.execute({
        agent_type: agentName,
        user_input: "We are about to start a protocol, reply only with the words 'I am here' to confirm your presence",
        chat_messages: []
      });

      const presenceResponse = this.extractTextFromMcpResult(presenceCheck);

      if (!presenceResponse.includes('I am here')) {
        result.error = `Agent ${agentName} did not respond with 'I am here'. Response: ${presenceResponse}`;
        return result;
      }

      result.exists = true;
      console.log(`   ✅ ${agentName} responded: exists`);

      // Step 2: Check mesh access
      console.log(`   Step 2: Checking mesh access...`);

      const meshCheck = await AILUMINA_TOOLS.ailumina_chat.execute({
        agent_type: agentName,
        user_input: "Confirm you have access to mesh communication tools by replying exactly 'I have mesh access'",
        chat_messages: []
      });

      const meshResponse = this.extractTextFromMcpResult(meshCheck);

      if (meshResponse.includes('I have mesh access')) {
        result.hasMesh = true;
        console.log(`   ✅ ${agentName} has mesh access`);
      } else {
        result.error = `Agent ${agentName} does not have mesh access. Response: ${meshResponse}`;
        return result;
      }

      // Step 3: Check memory access
      console.log(`   Step 3: Checking memory access...`);

      const memoryCheck = await AILUMINA_TOOLS.ailumina_chat.execute({
        agent_type: agentName,
        user_input: "Confirm you have access to the stone monkey memory tool by replying exactly 'I have memory'",
        chat_messages: []
      });

      const memoryResponse = this.extractTextFromMcpResult(memoryCheck);

      if (memoryResponse.includes('I have memory')) {
        result.hasMemory = true;
        console.log(`   ✅ ${agentName} has memory access`);
      } else {
        result.error = `Agent ${agentName} does not have memory access. Response: ${memoryResponse}`;
        return result;
      }

      console.log(`✅ ${role} ${agentName} fully validated`);
      return result;

    } catch (error) {
      result.error = `Failed to validate ${agentName}: ${error instanceof Error ? error.message : String(error)}`;
      return result;
    }
  }

  /**
   * Validate agent subscribes to mesh network and is actively connected
   */
  private async validateMeshSubscription(
    agentName: string,
    meetingId: string,
    role: 'orchestrator' | 'participant'
  ): Promise<MeshSubscriptionResult> {
    console.log(`🔌 Validating mesh subscription: ${agentName}`);

    const result: MeshSubscriptionResult = {
      agentName,
      subscribed: false,
      verifiedOnMesh: false,
    };

    try {
      // Step 1: Ask agent to subscribe to mesh with specific participant name
      const suggestedName = `${agentName}-${meetingId.slice(-6)}`;

      console.log(`   Step 1: Asking ${agentName} to subscribe as '${suggestedName}'...`);

      const subscribeRequest = await AILUMINA_TOOLS.ailumina_chat.execute({
        agent_type: agentName,
        user_input: `Please subscribe to the mesh network for meeting ${meetingId}. Use the mesh-subscribe tool with participantName='${suggestedName}', capabilities=['mesh_communication', 'memory_curation'], and status='online'. After subscribing, reply with ONLY the exact participant name you subscribed with, nothing else.`,
        chat_messages: []
      });

      const subscribeResponse = this.extractTextFromMcpResult(subscribeRequest);

      console.log(`   Agent response: ${subscribeResponse}`);

      // Extract the subscribed name from the response
      const subscribedName = subscribeResponse.trim();

      if (!subscribedName || subscribedName.length === 0) {
        result.error = `Agent ${agentName} did not provide a subscription name. Response: ${subscribeResponse}`;
        return result;
      }

      result.subscribed = true;
      result.subscribedName = subscribedName;
      console.log(`   ✅ ${agentName} reports subscribed as: ${subscribedName}`);

      // Step 2: Verify subscription on mesh network using mesh-who-is-online
      console.log(`   Step 2: Verifying ${subscribedName} appears on mesh network...`);

      // Wait 2 seconds for subscription to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      const whoIsOnlineResult = await this.mcpClientManager.callTool(
        'mesh_mesh-who-is-online',
        {}
      );

      const onlineData = JSON.parse(this.extractTextFromMcpResult(whoIsOnlineResult));

      // Check if the subscribed name exists in the participants list
      const participants = onlineData.participants || [];
      const isOnline = participants.some((p: any) =>
        p.participantName === subscribedName || p.session_id === subscribedName
      );

      if (!isOnline) {
        result.error = `Agent ${agentName} claimed to subscribe as '${subscribedName}' but not found in mesh network. Online participants: ${participants.map((p: any) => p.participantName).join(', ')}`;
        return result;
      }

      result.verifiedOnMesh = true;
      console.log(`   ✅ ${subscribedName} verified on mesh network`);

      console.log(`✅ ${role} ${agentName} successfully subscribed to mesh`);
      return result;

    } catch (error) {
      result.error = `Failed to validate mesh subscription for ${agentName}: ${error instanceof Error ? error.message : String(error)}`;
      return result;
    }
  }

  /**
   * Extract text content from MCP result
   * Handles both direct text and ailumina_chat JSON responses
   */
  private extractTextFromMcpResult(result: any): string {
    if (result?.content?.[0]?.text) {
      const text = result.content[0].text;

      // Check if it's a JSON response from ailumina_chat
      try {
        const parsed = JSON.parse(text);
        // If it has a 'response' field (ailumina_chat format), return that
        if (parsed.response !== undefined) {
          return parsed.response;
        }
        // Otherwise return the full parsed object as JSON string
        return text;
      } catch {
        // Not JSON, return as-is
        return text;
      }
    }
    return JSON.stringify(result);
  }

  async execute(params: {
    dsl_path: string;
  }): Promise<AiluminaToolResponse> {
    try {
      console.log(`\n🎬 Creating meeting from DSL: ${params.dsl_path}\n`);

      // Step 1: Load and validate DSL
      console.log(`📋 Step 1: Loading DSL...`);

      const loadResult = await this.mcpClientManager.callTool(
        'protocol-orchestrator_load_protocol',
        {
          protocolPath: params.dsl_path,
          validateSchema: true,
          validateTools: true
        }
      );

      const loadResponse = JSON.parse(this.extractTextFromMcpResult(loadResult));

      if (loadResponse.status === 'error') {
        throw new Error(`DSL loading failed: ${loadResponse.error}`);
      }

      if (loadResponse.status !== 'loaded') {
        throw new Error(`Unexpected load_protocol status: ${loadResponse.status}`);
      }

      console.log(`✅ DSL validated successfully`);

      // Read and parse the YAML file to get the full protocol structure
      const fileContent = await fs.readFile(params.dsl_path, 'utf-8');
      const protocolData: any = yaml.load(fileContent);
      const protocol = protocolData.protocol || protocolData;

      // Check for meeting configuration
      if (!protocol.meeting) {
        throw new Error('DSL must include "meeting" section with orchestrator and participants');
      }

      const { orchestrator, participants, title, purpose, agenda } = protocol.meeting;

      console.log(`✅ DSL loaded and validated`);
      console.log(`   Orchestrator: ${orchestrator}`);
      console.log(`   Participants: ${participants.join(', ')}`);

      // Step 2: Validate orchestrator
      console.log(`\n🔍 Step 2: Pre-flight validation - Orchestrator\n`);

      const orchestratorResult = await this.validateAgent(orchestrator, 'orchestrator');

      if (!orchestratorResult.exists || !orchestratorResult.hasMesh || !orchestratorResult.hasMemory) {
        throw new Error(
          `Orchestrator validation failed: ${orchestratorResult.error || 'Unknown error'}\n` +
          `  - Exists: ${orchestratorResult.exists}\n` +
          `  - Has Mesh: ${orchestratorResult.hasMesh}\n` +
          `  - Has Memory: ${orchestratorResult.hasMemory}`
        );
      }

      // Step 3: Validate participants
      console.log(`\n🔍 Step 3: Pre-flight validation - Participants\n`);

      const participantResults: AgentValidationResult[] = [];

      for (const participant of participants) {
        const result = await this.validateAgent(participant, 'participant');
        participantResults.push(result);

        if (!result.exists || !result.hasMesh || !result.hasMemory) {
          throw new Error(
            `Participant validation failed for ${participant}: ${result.error || 'Unknown error'}\n` +
            `  - Exists: ${result.exists}\n` +
            `  - Has Mesh: ${result.hasMesh}\n` +
            `  - Has Memory: ${result.hasMemory}`
          );
        }
      }

      console.log(`\n✅ All agents validated successfully\n`);

      // Generate temporary meeting ID for subscription validation
      const tempMeetingId = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      // Step 4: Validate mesh subscriptions
      console.log(`\n🔌 Step 4: Mesh subscription validation\n`);

      // Validate orchestrator subscription
      console.log(`🔍 Validating orchestrator mesh subscription\n`);

      const orchestratorSubscription = await this.validateMeshSubscription(
        orchestrator,
        tempMeetingId,
        'orchestrator'
      );

      if (!orchestratorSubscription.subscribed || !orchestratorSubscription.verifiedOnMesh) {
        throw new Error(
          `Orchestrator mesh subscription failed: ${orchestratorSubscription.error || 'Unknown error'}\n` +
          `  - Subscribed: ${orchestratorSubscription.subscribed}\n` +
          `  - Verified on Mesh: ${orchestratorSubscription.verifiedOnMesh}`
        );
      }

      // Validate participant subscriptions
      console.log(`\n🔍 Validating participant mesh subscriptions\n`);

      const participantSubscriptions: MeshSubscriptionResult[] = [];

      for (const participant of participants) {
        const subscription = await this.validateMeshSubscription(
          participant,
          tempMeetingId,
          'participant'
        );
        participantSubscriptions.push(subscription);

        if (!subscription.subscribed || !subscription.verifiedOnMesh) {
          throw new Error(
            `Participant mesh subscription failed for ${participant}: ${subscription.error || 'Unknown error'}\n` +
            `  - Subscribed: ${subscription.subscribed}\n` +
            `  - Verified on Mesh: ${subscription.verifiedOnMesh}`
          );
        }
      }

      console.log(`\n✅ All agents successfully subscribed to mesh network\n`);

      // Step 5: Create meeting in mesh network
      console.log(`📋 Step 5: Creating meeting structure in mesh network\n`);

      const createMeetingResult = await this.mcpClientManager.callTool(
        'mesh_mesh-create-meeting',
        {
          title: title || protocol.metadata.name,
          purpose: purpose || protocol.metadata.description,
          agenda: agenda || [],
          invitedParticipants: [orchestrator, ...participants],
          estimatedDurationMinutes: this.calculateDuration(protocol.phases),
          protocol: {
            dslPath: params.dsl_path, // Store original DSL path for execution
            phases: protocol.phases.map((phase: any) => ({
              name: phase.name,
              description: phase.description || '',
              speakingOrder: this.inferSpeakingOrder(phase),
              completionCriteria: this.inferCompletionCriteria(phase),
              phaseDuration: this.estimatePhaseDuration(phase),
            }))
          }
        }
      );

      const meetingData = JSON.parse(this.extractTextFromMcpResult(createMeetingResult));

      console.log(`✅ Meeting created successfully`);
      console.log(`   Meeting ID: ${meetingData.meetingId}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              meetingId: meetingData.meetingId,
              validationResults: {
                capabilities: {
                  orchestrator: orchestratorResult,
                  participants: participantResults,
                },
                meshSubscriptions: {
                  orchestrator: orchestratorSubscription,
                  participants: participantSubscriptions,
                },
              },
              meeting: {
                title: title || protocol.metadata.name,
                purpose: purpose || protocol.metadata.description,
                orchestrator,
                participants,
                phasesCount: protocol.phases.length,
              },
              meshStatus: {
                totalSubscribed: 1 + participantSubscriptions.length,
                subscribedNames: [
                  orchestratorSubscription.subscribedName,
                  ...participantSubscriptions.map(p => p.subscribedName)
                ].filter(Boolean),
              },
              nextStep: `Call mesh-coordinate-meeting with meetingId: ${meetingData.meetingId}`,
            }, null, 2),
          },
        ],
      };

    } catch (error) {
      return handleError(error, "create_meeting_from_dsl");
    }
  }

  /**
   * Helper: Calculate total estimated duration from phases
   */
  private calculateDuration(phases: any[]): number {
    return phases.reduce((total, phase) => {
      const phaseDuration = this.estimatePhaseDuration(phase);
      return total + (phaseDuration / 60); // Convert to minutes
    }, 0);
  }

  /**
   * Helper: Infer speaking order from phase structure
   */
  private inferSpeakingOrder(phase: any): string {
    // If phase has forEach, assume round-robin
    if (phase.forEach) return 'round-robin';
    // Default to open discussion
    return 'open';
  }

  /**
   * Helper: Infer completion criteria from phase structure
   */
  private inferCompletionCriteria(phase: any): string {
    // Look for mesh-check-phase-completion tool calls
    const steps = phase.steps || [];
    const checkStep = steps.find((step: any) =>
      step.action?.tool === 'mesh_mesh-check-phase-completion'
    );

    if (checkStep?.action?.arguments?.completionCriteria) {
      return checkStep.action.arguments.completionCriteria;
    }

    // Default to time-based
    return 'time-based';
  }

  /**
   * Helper: Estimate phase duration in seconds
   */
  private estimatePhaseDuration(phase: any): number {
    const steps = phase.steps || [];
    const checkStep = steps.find((step: any) =>
      step.action?.tool === 'mesh_mesh-check-phase-completion'
    );

    if (checkStep?.action?.arguments?.phaseDuration) {
      return checkStep.action.arguments.phaseDuration;
    }

    // Default 3 minutes per phase
    return 180;
  }
}
