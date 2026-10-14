"""Production Template: Large-Scale Development Task Runner with Gemini Context Caching.

Usage:
    export GEMINI_API_KEY="your-api-key"
    python large_scale_task_runner.py --goal "Refactor entire backend authentication to OAuth2 and pass all tests"
"""

import argparse
import os
import sys

# Ensure local scripts are importable
current_dir = os.path.dirname(os.path.abspath(__file__))
scripts_dir = os.path.join(os.path.dirname(current_dir), "scripts")
if scripts_dir not in sys.path:
    sys.path.append(scripts_dir)

from google import genai
from context_cache_manager import ContextCacheSession, collect_project_codebase
from context_cache_agent import run_autonomous_cached_loop, DEFAULT_AGENT_TOOLS, TOOL_DISPATCH_MAP
from agent_guardrail import AgentGuardrail

try:
    from dotenv import load_dotenv
    # Automatically check common env locations
    for env_path in [".env", "backend/.env", "../backend/.env"]:
        if os.path.exists(env_path):
            load_dotenv(env_path)
            break
except ImportError:
    pass


def run_large_scale_task(
    project_root: str,
    user_goal: str,
    phase_model: str = "gemini-3.8-flash",
    ttl: str = "3600s",
    max_steps: int = 30,
):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ Error: GEMINI_API_KEY environment variable is missing.")
        print("Please set it with: export GEMINI_API_KEY='your-key'")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    print(f"📦 Bundling repository codebase from: {os.path.abspath(project_root)}")
    codebase_dump = collect_project_codebase(project_root)
    print(f"✓ Bundled {len(codebase_dump):,} characters of source code and docs.")

    system_instruction = (
        "You are an Elite Enterprise Software Architect and Autonomous Engineering Agent. "
        "Your task is to analyze, refactor, patch, or build complex full-scale features across this repository. "
        "Use the provided tools (run_shell_command, read_file, write_file, list_directory) to verify code, "
        "run tests, make edits, and ensure zero regressions. "
        "Always adhere strictly to existing architectural patterns, type safety, and security standards."
    )

    # 1. Establish Safe Context Cache Session (Tools & Codebase Frozen in Cache)
    with ContextCacheSession(
        client=client,
        model=phase_model,
        static_context=codebase_dump,
        system_instruction=system_instruction,
        tools=DEFAULT_AGENT_TOOLS,
        display_name="large_scale_dev_session",
        ttl=ttl,
    ) as session:
        # 2. Initialize Interceptor Guardrail
        guardrail = AgentGuardrail(
            max_identical_calls=3,
            max_consecutive_errors=3,
            max_total_steps=max_steps,
        )

        # 3. Execute Autonomous Agent Trajectory Loop
        result = run_autonomous_cached_loop(
            client=client,
            model=phase_model,
            cache_name=session.cache_name,
            user_goal=user_goal,
            tool_map=TOOL_DISPATCH_MAP,
            guardrail=guardrail,
            max_steps=max_steps,
        )

        print("\n========================================================")
        print("📊 SESSION EXECUTION REPORT")
        print("========================================================")
        print(f"Status: {result.get('status')}")
        print(f"Steps Taken: {result.get('steps_taken')}")
        usage = result.get("usage", {})
        print(f"Regular Input Tokens: {usage.get('total_regular_prompt_tokens', 0):,}")
        print(f"Cached Hit Tokens:    {usage.get('total_cached_hit_tokens', 0):,} (Saved ~90-95% cost)")
        print(f"Output Tokens:        {usage.get('total_output_tokens', 0):,}")
        print("========================================================\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Large-Scale Agent Runner with Context Caching")
    parser.add_argument("--root", default=".", help="Project root directory to bundle and cache")
    parser.add_argument(
        "--goal",
        required=True,
        help="High-level engineering goal (e.g. 'Refactor whole database schema and update queries')",
    )
    parser.add_argument(
        "--model",
        default="gemini-3.8-flash",
        choices=["gemini-3.8-flash", "gemini-4-argon"],
        help="Target model for execution (Flash for fast analysis, Argon for massive code generation)",
    )
    parser.add_argument("--ttl", default="3600s", help="Cache TTL (default: 3600s / 1 hour)")
    parser.add_argument("--steps", type=int, default=25, help="Maximum steps allowed for agent trajectory")

    args = parser.parse_args()
    run_large_scale_task(
        project_root=args.root,
        user_goal=args.goal,
        phase_model=args.model,
        ttl=args.ttl,
        max_steps=args.steps,
    )
