"""Agent Guardrail Interceptor for Long-Running Autonomous Gemini Agents.

Provides runtime protection against:
1. Infinite action loops (Call Signature Hashing)
2. Tool execution failures (Circuit Breaker)
3. Destructive shell commands (Regex & Security Filter)
4. Session runaway token/step blowup
"""

import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Tuple


class GuardrailViolation(Exception):
    """Raised when an unrecoverable safety policy violation occurs."""
    pass


class AgentGuardrail:
    """Runtime interceptor for tool calls made by Gemini agents."""

    def __init__(
        self,
        max_identical_calls: int = 3,
        max_consecutive_errors: int = 3,
        max_total_steps: int = 30,
        extra_dangerous_patterns: Optional[List[str]] = None,
    ):
        self.max_identical_calls = max_identical_calls
        self.max_consecutive_errors = max_consecutive_errors
        self.max_total_steps = max_total_steps

        # State trackers
        self.call_history: List[Tuple[str, str]] = []  # [(tool_name, hash)]
        self.error_counts: Dict[str, int] = {}
        self.total_steps = 0

        # High-risk command blacklist for shell tools
        self.dangerous_patterns = [
            r"\brm\s+-[rf]{1,2}\s+/",               # rm -rf root/all
            r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\};:", # Fork bomb
            r">\s*/dev/sd[a-z]",                     # Direct raw disk write
            r"\b(curl|wget)\b.*\|\s*(bash|sh)",      # Piped remote execution
            r"\b(nc|netcat)\b.*-e",                  # Reverse shell
            r"/etc/(passwd|shadow)",                 # System credential access
            r"(\.env|id_rsa|credentials)",           # Sensitive key leaks
            r"\bdrop\s+database\b",                  # Unsafe DB drops
            r"\bshutdown\b|\breboot\b",              # Machine shutdown
        ]
        if extra_dangerous_patterns:
            self.dangerous_patterns.extend(extra_dangerous_patterns)

    def _hash_call(self, name: str, args: Dict[str, Any]) -> str:
        """Serialize function call and args into an MD5 hash for loop detection."""
        try:
            serialized = json.dumps({"name": name, "args": args}, sort_keys=True, default=str)
        except Exception:
            serialized = f"{name}:{str(args)}"
        return hashlib.md5(serialized.encode("utf-8")).hexdigest()

    def inspect_tool_call(self, name: str, args: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate tool execution before invocation.
        
        Returns:
            (is_allowed: bool, rejection_reason: Optional[str])
        """
        self.total_steps += 1

        # 1. Total step threshold check
        if self.total_steps > self.max_total_steps:
            return (
                False,
                f"Guardrail Alert: Maximum allowed session steps ({self.max_total_steps}) exceeded. Execution stopped.",
            )

        # 2. Dangerous shell command interceptor
        if name in ("run_shell_command", "execute_command", "bash", "terminal"):
            cmd = str(args.get("command", "") or args.get("cmd", ""))
            for pattern in self.dangerous_patterns:
                if re.search(pattern, cmd, re.IGNORECASE):
                    return (
                        False,
                        f"Security Violation: Dangerous command pattern detected ({cmd}). Execution blocked.",
                    )

        # 3. Circuit Breaker for consecutive failures on the same tool
        if self.error_counts.get(name, 0) >= self.max_consecutive_errors:
            return (
                False,
                f"Circuit Breaker: Tool '{name}' has failed {self.max_consecutive_errors} consecutive times and is temporarily locked. Choose an alternative approach.",
            )

        # 4. Action loop detection via Call Signature Hashing
        call_hash = self._hash_call(name, args)
        self.call_history.append((name, call_hash))

        if len(self.call_history) >= self.max_identical_calls:
            recent_hashes = [h for _, h in self.call_history[-self.max_identical_calls:]]
            if len(set(recent_hashes)) == 1:
                return (
                    False,
                    (
                        f"Loop Detected: The identical action '{name}' was invoked {self.max_identical_calls} times consecutively without argument changes. "
                        "Stop repeating this call, analyze the underlying cause, and adopt a new strategy."
                    ),
                )

        return True, None

    def record_execution_result(self, name: str, is_error: bool):
        """Update circuit breaker tracking state after tool execution."""
        if is_error:
            self.error_counts[name] = self.error_counts.get(name, 0) + 1
        else:
            self.error_counts[name] = 0  # Reset on successful execution
