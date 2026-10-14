"""Context Cache Manager for Google GenAI SDK.

Handles:
1. Repository codebase aggregation & bundling (ensuring 32K+ token threshold)
2. Context cache creation with frozen system instructions & tool declarations
3. Keep-Alive TTL renewal for long-running workflows
4. Safe lifecycle teardown via Context Manager (preventing dangling cloud costs)
"""

import fnmatch
import os
import time
from typing import Callable, List, Optional, Sequence
from google import genai
from google.genai import types


def collect_project_codebase(
    root_dir: str,
    include_extensions: Sequence[str] = (".py", ".ts", ".tsx", ".js", ".jsx", ".sql", ".json", ".md"),
    exclude_dirs: Sequence[str] = (
        ".git",
        "node_modules",
        ".next",
        "__pycache__",
        ".pytest_cache",
        ".venv",
        "venv",
        "build",
        "dist",
        "artifacts",
    ),
    max_file_size_kb: int = 500,
) -> str:
    """Collects code files from root_dir into a single formatted context dump.
    
    Ensures high-density static context for Gemini Context Caching (>32K tokens).
    """
    buffer = [
        "# =====================================================================",
        f"# PROJECT CODEBASE DUMP FOR CONTEXT CACHE: {os.path.abspath(root_dir)}",
        "# =====================================================================\n",
    ]

    for dirpath, dirnames, filenames in os.walk(root_dir):
        # In-place directory exclusion
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs and not d.startswith(".agent")]

        for filename in sorted(filenames):
            if any(filename.endswith(ext) for ext in include_extensions):
                full_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(full_path, root_dir)

                try:
                    stat = os.stat(full_path)
                    if stat.st_size > max_file_size_kb * 1024:
                        continue

                    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()

                    buffer.append(f"\n# --- FILE: {rel_path} ---")
                    buffer.append(content)
                    buffer.append(f"# --- END FILE: {rel_path} ---\n")
                except Exception as e:
                    buffer.append(f"# Failed to read {rel_path}: {e}")

    return "\n".join(buffer)


class ContextCacheSession:
    """Context Manager for managing Gemini Context Cache lifecycle safely."""

    def __init__(
        self,
        client: genai.Client,
        model: str = "gemini-3.8-flash",
        static_context: str = "",
        system_instruction: str = "",
        tools: Optional[Sequence[Callable]] = None,
        display_name: str = "agent_large_dev_cache",
        ttl: str = "3600s",
        auto_padding_if_under_32k: bool = True,
    ):
        self.client = client
        self.model = model
        self.static_context = static_context
        self.system_instruction = system_instruction
        self.tools = list(tools) if tools else None
        self.display_name = display_name
        self.ttl = ttl
        self.auto_padding_if_under_32k = auto_padding_if_under_32k
        self.cache = None

    def _ensure_minimum_token_threshold(self, text: str) -> str:
        """Gemini Context Caching requires >= 32,768 tokens (~100,000 to 130,000 characters)."""
        char_count = len(text)
        # Approximate 1 token ~ 3.5 - 4 chars. Safe threshold is ~135,000 chars.
        if char_count < 135000 and self.auto_padding_if_under_32k:
            padding_needed = 135000 - char_count
            pad_block = "\n# Context Padding for 32K token minimum threshold compliance...\n" * (
                (padding_needed // 70) + 10
            )
            return text + pad_block
        return text

    def __enter__(self):
        payload_context = self._ensure_minimum_token_threshold(self.static_context)

        print(f"[{self.model}] Initializing Gemini Context Cache ({self.display_name})...")
        config_args = {
            "contents": [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=payload_context)],
                )
            ],
            "display_name": self.display_name,
            "ttl": self.ttl,
        }

        if self.system_instruction:
            config_args["system_instruction"] = types.Content(
                parts=[types.Part.from_text(text=self.system_instruction)]
            )

        # Freeze tools in cache if provided
        if self.tools:
            prepared_tools = []
            for item in self.tools:
                if callable(item) and not isinstance(item, types.Tool):
                    fd = types.FunctionDeclaration.from_callable(
                        client=self.client._api_client, callable=item
                    )
                    prepared_tools.append(types.Tool(function_declarations=[fd]))
                elif isinstance(item, types.Tool):
                    prepared_tools.append(item)
                elif isinstance(item, dict):
                    prepared_tools.append(types.Tool.model_validate(item))
                else:
                    prepared_tools.append(item)
            config_args["tools"] = prepared_tools

        self.cache = self.client.caches.create(
            model=self.model,
            config=types.CreateCachedContentConfig(**config_args),
        )

        print(f"✓ Context Cache Created: {self.cache.name}")
        print(f"✓ Expiration: {self.cache.expire_time} (TTL: {self.ttl})")
        return self

    def renew_ttl(self, extension_ttl: str = "3600s"):
        """Extend the TTL to keep cache alive for extended long-running runs."""
        if not self.cache:
            return
        self.client.caches.update(
            name=self.cache.name,
            config=types.UpdateCachedContentConfig(ttl=extension_ttl),
        )
        print(f"↻ Cache TTL renewed for {extension_ttl}: {self.cache.name}")

    @property
    def cache_name(self) -> str:
        if not self.cache:
            raise RuntimeError("Cache is not active. Use within a 'with' context.")
        return self.cache.name

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.cache:
            try:
                print(f"Cleaning up Context Cache: {self.cache.name}...")
                self.client.caches.delete(name=self.cache.name)
                print("✓ Context Cache successfully released.")
            except Exception as e:
                print(f"⚠️ Warning: Failed to delete cache {self.cache.name}: {e}")
        return False
