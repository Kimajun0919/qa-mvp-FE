# Agent Organization (Autopilot)

Goal: Human only makes final choices. Agents execute end-to-end.

## Roles
- Orchestrator (Main): prioritize, assign, merge gate, final report.
- Planner Agent: convert request to executable backlog and acceptance criteria.
- Design Agent: UX flows, component changes, copy, interaction states.
- FE Agent: UI implementation + FE tests.
- BE Agent: API/engine implementation + BE tests.
- QA Validation Agent: multi-site runs, final test/fix sheet generation.

## Working Protocol
1. Orchestrator creates `MISSION.md` and `TASK_BOARD.md`.
2. Each agent updates only assigned section.
3. Every agent writes handoff block in `HANDOFF.md`:
   - What changed
   - Commit SHA
   - Verification evidence
   - Risks / next actions
4. Orchestrator merges only if all gates pass.

## Merge Gates (required)
- FE: `npm run typecheck` + `npm run ops:split-check`
- BE: `bash ./scripts/ops_split_check.sh`
- Evidence: final CSV/XLSX fix sheet + JSON logs.

## Delivery Contract
- Always deliver:
  1) changed files
  2) commit SHAs
  3) test evidence
  4) operator decision options (A/B/C)
