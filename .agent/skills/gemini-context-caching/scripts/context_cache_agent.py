"""Autonomous Context-Cached Gemini Agent Execution Engine.

Executes a goal-driven agent loop with:
- Frozen Context & Tool Schemas in Gemini Context Cache
- Multi-Turn Tool Calling with Guardrail Interception
- Token Cost Savings Measurement (Prompt tokens vs Cached hit tokens)
- Soft Reflection Feedback on violations
"""

import os
import subprocess
from typing import Any, Callable, Dict, List, Optional
from google import genai
from google.genai import types

from agent_guardrail import AgentGuardrail
from context_cache_manager import ContextCacheSession, collect_project_codebase


# -----------------------------------------------------------------------------
# 1. Standard Agent Tools (Frozen into Cache)
# -----------------------------------------------------------------------------
def run_shell_command(command: str) -> str:
    """Executes a terminal shell command and returns captured stdout/stderr.
    
    Args:
        command: The shell command line string to run.
    """
    try:
        res = subprocess.run(
            command, shell=True, text=True, capture_output=True, timeout=60
        )
        output = res.stdout if res.returncode == 0 else f"Error (code {res.returncode}): {res.stderr}"
        # Prevent token blowup: truncate overly large outputs
        if len(output) > 4000:
            return output[:3800] + f"\n... [Truncated {len(output)-3800} chars]"
        return output
    except subprocess.TimeoutExpired:
        return "Error: Command execution timed out after 60 seconds."
    except Exception as e:
        return f"Execution Failed: {str(e)}"


def read_file(file_path: str) -> str:
    """Reads the text content of a file at the given relative or absolute path."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        if len(content) > 8000:
            return content[:7500] + f"\n... [File truncated {len(content)-7500} chars]"
        return content
    except Exception as e:
        return f"File Read Error: {str(e)}"


def write_file(file_path: str, content: str) -> str:
    """Writes or overwrites content to a specified file path."""
    try:
        os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote {len(content)} characters to {file_path}"
    except Exception as e:
        return f"File Write Error: {str(e)}"


def list_directory(directory_path: str = ".") -> str:
    """Lists files and folders in a specified directory path."""
    try:
        entries = sorted(os.listdir(directory_path))
        return "\n".join(entries[:100])
    except Exception as e:
        return f"Directory Listing Error: {str(e)}"


DEFAULT_AGENT_TOOLS = [run_shell_command, read_file, write_file, list_directory]

TOOL_DISPATCH_MAP: Dict[str, Callable] = {
    "run_shell_command": run_shell_command,
    "read_file": read_file,
    "write_file": write_file,
    "list_directory": list_directory,
}


# -----------------------------------------------------------------------------
# 2. Autonomous Safe Execution Loop
# -----------------------------------------------------------------------------
def run_autonomous_cached_loop(
    client: genai.Client,
    model: str,
    cache_name: str,
    user_goal: str,
    tool_map: Optional[Dict[str, Callable]] = None,
    guardrail: Optional[AgentGuardrail] = None,
    max_steps: int = 25,
) -> Dict[str, Any]:
    """Runs a multi-turn agent loop referencing a frozen Gemini Context Cache.
    
    IMPORTANT: Never pass `tools` in `GenerateContentConfig` since tool schemas
    are already baked into the cache!
    """
    dispatch = tool_map or TOOL_DISPATCH_MAP
    interceptor = guardrail or AgentGuardrail(max_identical_calls=3, max_consecutive_errors=3, max_total_steps=max_steps)

    history: List[types.Content] = [
        types.Content(role="user", parts=[types.Part.from_text(text=user_goal)])
    ]

    total_prompt_tokens = 0
    total_cached_tokens = 0
    total_output_tokens = 0
    step_records = []

    print(f"\n🚀 Starting Context-Cached Autonomous Run | Model: {model} | Target: {user_goal[:80]}...\n")

    for step in range(1, max_steps + 1):
        print(f"--- [Turn {step}/{max_steps}] Requesting Gemini Inference ---")

        # Set max output token depending on model
        max_output = 65536 if "argon" in model.lower() else 16384

        response = client.models.generate_content(
            model=model,
            contents=history,
            config=types.GenerateContentConfig(
                cached_content=cache_name,  # Bind to server-side cache
                temperature=0.15,
                max_output_tokens=max_output,
            ),
        )

        usage = response.usage_metadata
        if usage:
            p_tok = usage.prompt_token_count or 0
            c_tok = getattr(usage, "cached_content_token_count", 0) or 0
            o_tok = usage.candidates_token_count or 0
            total_prompt_tokens += p_tok
            total_cached_tokens += c_tok
            total_output_tokens += o_tok
            discount = "90-95% OFF" if c_tok > 0 else "0%"
            print(f"  📊 Tokens: Regular Input: {p_tok} | Cached Hit: {c_tok} ({discount}) | Output: {o_tok}")

        candidate = response.candidates[0]
        history.append(candidate.content)

        # 1. Tool Call Execution
        if response.function_calls:
            function_response_parts = []
            for call in response.function_calls:
                fn_name = call.name
                fn_args = call.args or {}
                print(f"  ⚡ [Tool Call] {fn_name}({fn_args})")

                # Guardrail Intercept Check
                is_allowed, block_reason = interceptor.inspect_tool_call(fn_name, fn_args)

                if not is_allowed:
                    print(f"  🛡️ [Guardrail Blocked] {block_reason}")
                    # Soft Reflection: Send feedback to let model adapt autonomously
                    function_response_parts.append(
                        types.Part.from_function_response(
                            name=fn_name,
                            response={"error": block_reason, "status": "BLOCKED_BY_GUARDRAIL"},
                        )
                    )
                    interceptor.record_execution_result(fn_name, is_error=True)
                    step_records.append({"step": step, "tool": fn_name, "status": "BLOCKED", "reason": block_reason})
                    continue

                # Execute Tool
                handler = dispatch.get(fn_name)
                if not handler:
                    result = f"Error: Tool '{fn_name}' is not registered."
                    is_err = True
                else:
                    try:
                        result = handler(**fn_args)
                        is_err = "error" in str(result).lower() or "failed" in str(result).lower()
                    except Exception as e:
                        result = f"Runtime Exception during execution: {str(e)}"
                        is_err = True

                interceptor.record_execution_result(fn_name, is_error=is_err)
                step_records.append({"step": step, "tool": fn_name, "status": "ERROR" if is_err else "SUCCESS"})
                print(f"  ↳ Result: {str(result)[:120]}...")

                function_response_parts.append(
                    types.Part.from_function_response(
                        name=fn_name,
                        response={"result": result},
                    )
                )

            # Inject Tool Results as user role response
            history.append(types.Content(role="user", parts=function_response_parts))
            continue

        # 2. Final Text Response (Task Complete)
        if response.text:
            print("\n🎉 === [Agent Task Completed] ===")
            print(response.text)
            return {
                "status": "COMPLETED",
                "final_response": response.text,
                "steps_taken": step,
                "history": history,
                "usage": {
                    "total_regular_prompt_tokens": total_prompt_tokens,
                    "total_cached_hit_tokens": total_cached_tokens,
                    "total_output_tokens": total_output_tokens,
                    "estimated_cost_reduction_percent": 90.0 if total_cached_tokens > 0 else 0.0,
                },
                "audit_log": step_records,
            }

    return {
        "status": "MAX_STEPS_REACHED",
        "steps_taken": max_steps,
        "history": history,
        "usage": {
            "total_regular_prompt_tokens": total_prompt_tokens,
            "total_cached_hit_tokens": total_cached_tokens,
            "total_output_tokens": total_output_tokens,
        },
        "audit_log": step_records,
    }
