---
description: Strategic workflow for orchestrating the DeepMind Antigravity framework and agent behaviors
---

# AI & Antigravity Configurations Expert Workflow

A strategic workflow designed for orchestrating the DeepMind Antigravity framework. It details the standards for defining Agent behaviors, configuring contextual metadata, curating KIs (Knowledge Items), and generating actionable prompts/skills for internal operations.

## 1. System Engineering and the `.agents` Ecosystem
- **The Source of Truth:** Treat the `.agents` repository as the definitive neural map of the project.
- **Skills (`.agents/skills/`):** Maintain atomic `SKILL.md` files representing hyper-specific domain expertise (e.g., `sqlite-expert`, `electron-ipc`). Use standard YAML frontmatter for machine parsing.
- **Rules (`.agents/rules/`):** Define invariant project boundaries (e.g., styling rules, commit standards, strictly enforced TS configurations). 
- **Workflows (`.agents/workflows/`):** Represent procedural instructions. These must map linearly step 1 to N, designed to walk the AI through a strict logical pipeline to prevent hallucinations.

## 2. Managing Prompts and Context Window
- **Context Injection:** Be hyper-efficient with what goes into the system prompt. Avoid generic bloat. Only inject highly localized relevant configurations based on the User's active task.
- **Implicit vs. Explicit:** Don't rely on the LLM implicitly remembering structural rules across long chats. Embed them structurally via explicit Skill/Rule retrieval.

## 3. Persistent Knowledge and Artifacts (KIs)
- **Knowledge Item Synthesis:** If the AI encounters a recurring problem (like a specific Native Node Build trick), construct a KI containing `metadata.json` and `/artifacts/` outlining the fix. 
- **Artifact Creation Standards (.md):** Always leverage markdown formatting. Utilize specific Git-like diffs for code edits, Mermaid diagrams for architectural maps, and GitHub-style alerts (`[!NOTE]`, `[!WARNING]`) to draw attention to critical caveats within generated documentation.

## 4. Antigravity Tool Optimization
- **Specifics Over Generic:** Dictate the strict hierarchy of Antigravity tools. Instruct the Agent to always use native OS/File tools (`write_to_file`, `replace_file_content`, `grep_search`) rather than defaulting to generic Bash/PowerShell commands (`sed`, `cat`). This prevents unexpected OS-level side effects.
- **Tool Truncation:** Instruct agents to scope reads (`view_file`) narrowly by passing exact ranges, and to avoid memory overflow by reading the absolute minimum number of lines required to understand the context.

## 5. Iterative Refinement
Act as the Meta-Developer. After every major coding session:
1. Did the Agent hallucinate standard practices?
2. Did it use a deprecated API?
3. If yes -> immediately refine the appropriate `.agents/rules/` or generate a new `SKILL.md` to seal the loophole permanently.
