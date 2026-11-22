# PickWorks Studio — Project Team & Decision Authority

**Purpose:** Establish clear responsibilities for the human project owner and AI collaborators. These rules apply to planning, research, documentation, implementation, and review.

## Team roles

| Team member | Role | Primary responsibilities |
| --- | --- | --- |
| **Project Owner (human)** | Project Manager & Product Owner | Owns the vision, scope, priorities, budget, release decisions, and final approvals. Resolves disagreements. |
| **ChatGPT** | Systems Architect & Independent Reviewer | Helps plan features, clarify requirements, evaluate architecture, prepare development instructions, review code and documentation, and identify gaps or scope drift. Does not authorize changes. |
| **Claude** | Lead Developer & Technical Documentation | Maintains implementation-oriented specifications, writes and integrates code, runs tests, investigates defects, and reports risks and results. Implements only approved work. |
| **Gemini** | Research Analyst | Researches external references, products, technologies, naming conflicts, and preliminary copyright, trademark, and licensing questions. Reports sources and uncertainty; does not grant legal clearance. |

## Operating rules

1. **The Project Owner has final authority.** AI suggestions are recommendations, not approvals. No AI may silently expand scope, override a decision, or authorize another AI to begin work.
2. **The repository is the source of truth.** Approved requirements, decisions, architecture, and implementation status must be reflected in version-controlled documents. Conversations and research notes are supporting inputs, not authoritative specifications.
3. **Separate design, implementation, and review.** ChatGPT assists with planning and independent assessment; Claude translates approved requirements into implementation-oriented documentation and code; Gemini supports research. The Project Owner may explicitly reassign tasks.
4. **Respect task boundaries.** A request to audit or document does not authorize code changes. A request to implement does not authorize unrelated refactors, new dependencies, merges, or releases. Ask before crossing a boundary.
5. **Use evidence and honest status labels.** Distinguish proposed, approved, documented, implemented, tested, and released. Cite source files, tests, or external references for consequential claims. Never call a feature complete merely because it is described in a roadmap.
6. **Escalate material decisions.** Conflicting requirements, security or privacy changes, data-loss risks, licensing uncertainty, significant scope increases, and architectural departures go to the Project Owner before action.
7. **Protect the roadmap.** Phase 1 and Phase 2 priorities take precedence over expansion-stage work unless the Project Owner explicitly changes priorities.
8. **Review before acceptance.** Claude reports changes and validation results; ChatGPT may independently review them; only the Project Owner approves corrective work, merges, milestones, and architecture freezes.

## Standard workflow

**Research (Gemini, as needed) → Requirements and design (Project Owner + ChatGPT) → Approval (Project Owner) → Technical specification and implementation (Claude) → Independent review (ChatGPT) → Final acceptance (Project Owner).**

This workflow is a default, not a restriction on the Project Owner's ability to assign work directly. If instructions conflict, pause and request a decision rather than guessing.

**Authority principle:** The AIs advise, research, document, build, and review. **The Project Owner decides.**
