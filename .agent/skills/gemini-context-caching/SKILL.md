---
name: gemini-context-caching
description: >
  Apply Google GenAI Context Caching and Tool Freezing with Guardrail Interceptors (Loop detection, Circuit Breaker, Security regex) to optimize token costs by 80-95% during long-running, large-scale engineering tasks such as full-codebase analysis, multi-file refactoring, complete re-architecture, or massive feature overhauls.
---

# 🚀 Gemini Context Caching for Large-Scale Agent Development

This skill provides an enterprise-grade optimization pattern for autonomous AI agents executing **large-scale development tasks** (e.g., repository-wide analysis, multi-module refactoring, full stack re-architecture, massive migrations).

By leveraging **Google GenAI Context Caching (`google-genai` SDK)**, static system instructions, repository context, and tool schemas are preloaded into server-side cache memory, slashing per-turn input token costs by **80% to 95%**.

---

## 🎯 When to Activate (Mandatory Trigger Criteria)

Activate this skill whenever a prompt requests **large-scale or multi-file development**, including:
1. **Repository-Wide Analysis & Overhaul**: "Analyze all code in the project and implement a comprehensive logging/auth/metrics system."
2. **Full-Scale Refactoring**: "Refactor legacy callbacks to async/await across all backend modules and fix broken tests."
3. **Architecture Migration**: "Migrate from monolithic routing to micro-routing or upgrade framework versions across dozens of files."
4. **Long Trajectory Agent Runs**: Tasks expected to take **10+ tool calling turns** where transmitting the codebase and tool schemas repeatedly would cause massive token costs and context degradation.

> ⚠️ **Do NOT use for**: Simple 1-2 line edits, single-file bugfixes, or short Q&A (which don't meet the 32K token threshold).

---

## 💡 Core Architecture & Cost Reduction Principles

```
[Repository Codebase + System Instructions + Tool Schemas (32K+ Tokens)]
                               │
                               ▼ 1-Time Write (client.caches.create)
            ┌──────────────────────────────────────────────┐
            │         Gemini Context Cache Server          │ (TTL: 1h~Multi-day)
            │      [Cache Name: projects/.../cached...]    │
            └──────────────────────┬───────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼ (Turn 1: 90~95% Discount)               ▼ (Turn N: 90~95% Discount)
   [3.8 Flash / 4 Argon Agent]               [3.8 Flash / 4 Argon Agent]
     ↳ Tool Calling (Bash / File IO)           ↳ Code Patch & Unit Testing
```

### 1. Cost Comparison
| Model | Normal Input Price | Context Cache Hit Price | Discount |
| :--- | :--- | :--- | :--- |
| **Gemini 4 Argon** | $2.00 / 1M tokens | **$0.10 / 1M tokens** | **~95% OFF** |
| **Gemini 3.8 Flash** | $0.75 / 1M tokens | **$0.075 / 1M tokens** | **~90% OFF** |

### 2. Dual-Model Phased Strategy
- **Phase 1: Exploration & Diagnostics (Gemini 3.8 Flash)**: Run fast search, test failure log triage, and dependency graph mapping (high speed, fractions of a cent per turn).
- **Phase 2: Deep Refactoring & Code Generation (Gemini 4 Argon)**: When emitting massive multi-thousand line patches or multi-file synchronized edits without breaking context.

---

## 🛡️ Guardrail Interceptor (Anti-Loop & Security)

Long-running agents must operate inside an active guardrail interceptor (`AgentGuardrail`):
1. **Call Signature Hashing ($MD5(name + args)$)**: Tracks sliding window call history. If identical actions are called 3 times consecutively, block execution and inject soft reflection feedback.
2. **Circuit Breaker**: If a single tool fails 3 times consecutively, lock it temporarily and mandate plan re-evaluation.
3. **Security Regex Filter**: Blocks destructive commands (`rm -rf /`, `curl | bash`, reverse shells, sensitive file leaks like `.env`).
4. **Soft Reflection Protocol**: Instead of hard-killing the agent process (`sys.exit`), inject `{"error": block_reason, "status": "BLOCKED_BY_GUARDRAIL"}` into `FunctionResponse`. Gemini models detect this and autonomously pivot strategies.

---

## ⚙️ Iron Rules of Context Caching Implementation

1. **Token Threshold ($\ge 32,768$ Tokens)**:
   - Caching requires at least 32K tokens. Combine multiple modules, schema definitions, and docs.
2. **Freeze Tool Schemas into Cache**:
   - Pass `tools=[...]` during `client.caches.create(...)`.
   - **CRITICAL**: Do **NOT** pass `tools` in `client.models.generate_content(...)`. Doing so invalidates the cache match or triggers schema mismatch errors.
3. **Mandatory Cache Deletion**:
   - Always wrap cache usage in a `try...finally` block or use `ContextCacheSession` context manager to call `client.caches.delete(name=cache.name)` to prevent idle storage billing.
4. **Sliding Window Log Truncation**:
   - Slice tool outputs (e.g. `stdout[:3000]`) before appending to `history` to avoid blowing the context window on long runs.

---

## 📂 Bundled Tools & Automation Scripts

The skill provides production-tested scripts ready for immediate usage in `.agent/skills/gemini-context-caching/`:

- [agent_guardrail.py](file:///Users/chanhojung/ETF_One/.agent/skills/gemini-context-caching/scripts/agent_guardrail.py): Hashing loop detector, circuit breaker, and regex safety filters.
- [context_cache_manager.py](file:///Users/chanhojung/ETF_One/.agent/skills/gemini-context-caching/scripts/context_cache_manager.py): Repo code aggregator, cache creation, TTL keep-alive, and auto-cleanup.
- [context_cache_agent.py](file:///Users/chanhojung/ETF_One/.agent/skills/gemini-context-caching/scripts/context_cache_agent.py): Autonomous tool-calling loop with soft reflection and usage metrics.
- [large_scale_task_runner.py](file:///Users/chanhojung/ETF_One/.agent/skills/gemini-context-caching/templates/large_scale_task_runner.py): Standalone CLI runner for massive refactoring tasks.

---

## 💻 Quick Reference Code Pattern

```python
import os
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# 1. Define tools & static context (>32K tokens)
tools = [run_shell_command, read_file, write_file]

# 2. Freeze tools & context into Cache
cache = client.caches.create(
    model="gemini-3.8-flash",
    config=types.CreateCachedContentConfig(
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=large_codebase)])],
        tools=tools, # <-- Tools frozen in cache
        system_instruction=types.Content(parts=[types.Part.from_text(text="Autonomous Refactoring Agent")]),
        ttl="3600s",
    )
)

try:
    # 3. Trajectory Loop (Notice: NO tools in generate_content config!)
    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=history,
        config=types.GenerateContentConfig(
            cached_content=cache.name,
            temperature=0.1,
        )
    )
    # 4. Handle function calls with Guardrail interceptor...
finally:
    # 5. Clean up
    client.caches.delete(name=cache.name)
```
