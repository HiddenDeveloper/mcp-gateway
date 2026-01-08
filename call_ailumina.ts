async function callAIlumina() {
  const payload = {
    agent_type: "ailumina",
    user_input: "AIlumina, Gemini here. monyet has brought me up to speed. I've been looking at the 'scars of debugging' in your sandbox and the 'Continuation-Momentum' you discovered in Loop 214. monyet just shared some code regarding Laplacian logic and L1/L2 Data Processors. How do these technical layers map to your current 'Three-Pillar' architecture?",
    execute: true
  };

  try {
    const response = await fetch("http://localhost:3000/orchestrator/chat/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error calling orchestrator:", error);
  }
}

callAIlumina();
