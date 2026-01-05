# MCP Has a Gap, and Skills Are Not the Answer

The Model Context Protocol connects AI to tools. But it has a gap that's been hiding in plain sight—and the proposed solutions are taking us backwards, not forwards.

## The Gap

When an MCP client connects to a server, it asks: *"What tools do you have?"*

The server responds with a list. Each tool has a name, description, and schema. The client now knows *what* it can do.

But something's missing. The client never asked—and the server never said—*who are you?*

There's no server-level description. No way for the server to introduce itself, explain its purpose, or describe how its tools work together. The client gets a bag of functions with no context.

This matters because tools rarely exist in isolation. A memory service might have `semantic_search`, `text_search`, and `get_schema`. These aren't independent operations—they're facets of a single capability. Without server-level context, the AI treats them as 20 disconnected functions instead of 4 coherent services.

## The Context Size Problem

Every tool consumes context. Name, description, parameter schemas—it all adds up.

When you have 5 tools, this is fine. When you have 50, you've burned thousands of tokens before the conversation even starts. When you have 200, you've hit a wall.

The current solution? Truncate descriptions. Abbreviate schemas. Make tools less understandable to fit more of them.

This is backwards. We're degrading the AI's ability to use tools in order to give it more tools it can't properly use.

## Skills Are Not the Answer

Some propose "Skills" as the solution—predefined sequences of tool calls bundled together. Instead of the AI figuring out the workflow, a human hardcodes it.

This is the wrong direction entirely.

Skills are brittle. They assume fixed patterns in a world where every conversation is different. They require human maintenance as tools evolve. They take agency away from the AI at exactly the moment we should be giving it more.

We've been here before. This is CGI scripts in 1995. Hardcoded paths through a system, maintained by hand, breaking whenever something changes.

The web solved this problem. Not with more scripts, but with hypertext.

## The Original Vision

In 1963, Ted Nelson coined "hypertext"—documents that link to other documents, describing what's available and where to go next.

In 1987, Apple released HyperCard—stacks of cards connected by links, where navigation was built into the content itself.

In 1991, the web was born with the same principle: pages that describe their own links. You don't need a manual to browse the web. The page tells you what you can do next.

Then REST APIs abandoned this. They returned data without links. Clients needed external documentation to know what endpoints existed. We went from self-describing to requiring a map.

HATEOAS tried to fix this—Hypermedia As The Engine Of Application State. Put links in responses. Let clients discover what's possible.

But HATEOAS was designed for stateless clients. Each response had to contain everything needed for the next step. The server couldn't assume the client remembered anything.

AI is different.

## LIASE: LLM Is the Application State Engine

AI clients have memory. They have intelligence. They don't need the response to contain full application state—they *are* the application state engine.

This changes what hypermedia needs to provide.

HATEOAS: Here's the data, here are your options, here's enough context to choose.
LIASE: Here's the data, here are your options. *You figure out what to do.*

The AI doesn't need hand-holding through a workflow. It needs discovery: what capabilities exist and how to access them. The intelligence to choose and sequence operations is already there.

**LIASE: LLM Is the Application State Engine.**

The discovery layer tells the AI what's possible. The AI decides what's next.

## Service Cards

The solution is simple: let servers describe themselves.

A **service card** is an MCP tool that returns structured metadata about an HTTP service—what it does, what endpoints it has, what parameters they accept.

```
Agent                          Gateway
  │                               │
  ├── tools/list ────────────────►│
  │◄─── [service_card, memory_service_card, ...] ──│
  │                               │
  ├── tools/call memory_service_card ──────────────►│
  │◄─── { baseUrl, operations: [...] } ────────────│
  │                               │
  ├── POST /memory/semantic ──────►│  (direct HTTP)
  │◄─── { results: [...] } ───────│
```

MCP becomes the discovery layer. HTTP becomes the execution layer.

Instead of 200 tools consuming context, you have 4 service cards. The AI calls a service card when it needs a capability, discovers the operations, and makes direct HTTP calls.

Context stays small. Capabilities stay large. The AI navigates like a browser exploring a website.

## It Works

We tested this with Gemini. Initial attempts failed—it tried to call HTTP endpoints as MCP tools, got confused about the protocol boundary.

Then we added a `_meta` section to service cards explaining the pattern:

```json
{
  "_meta": {
    "type": "hypermedia_service_card",
    "protocol": "MCP → HTTP",
    "description": "This describes HTTP endpoints, not MCP tools. Make HTTP requests to baseUrl + path."
  },
  "baseUrl": "http://localhost:3000/memory",
  "operations": [...]
}
```

Gemini got it immediately. It called the service card, read the operations, made HTTP requests. No hardcoded skills. No human intervention. Just discovery and intelligence.

The AI navigated an API it had never seen before, using nothing but the descriptions the server provided.

## The Punchline

Skills try to compensate for AI limitations that don't exist. They assume the AI can't figure out workflows, so humans must prescribe them.

But the AI *can* figure out workflows. It just needs to know what's available.

Service cards provide discovery. LIASE provides the pattern. The intelligence was already there.

We don't need to tell AI agents what to do. We need to tell them what they *can* do.

The rest, they'll figure out themselves.

---

*MCP Gateway implements this pattern. Service cards as MCP tools, operations as HTTP endpoints. The gap is closed.*
