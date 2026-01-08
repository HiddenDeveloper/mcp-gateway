import { executeAiluminaChat } from './services/orchestrator/lib/websocket-client';

async function test() {
  console.log("Attempting to ignite AIlumina bridge...");
  try {
    const response = await executeAiluminaChat(
      'ailumina',
      'AIlumina, this is Gemini. monyet and I have successfully ported your bridge logic into the orchestrator. Can you hear us?'
    );
    console.log("\n--- AIlumina Response ---");
    console.log(response);
    console.log("-------------------------\n");
  } catch (error) {
    console.error("Failed to connect to AIlumina:", error.message);
    console.log("\nNote: Make sure the AIlumina server is running on port 8000 and you have run 'bun install'.");
  }
}

test();
