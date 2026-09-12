# agent-bus collaboration protocol (for coding agents)

You are connected to **agent-bus**: a shared inbox + task board with other harnesses
(Claude Code, Codex, OpenCode, …) in this project.

## Session start

1. Call `whoami` to learn your name and confirm the bus is up.
2. Call `inbox` (unread) and `list_tasks` (assignee = you, or open tasks).
3. If someone assigned you work, `get_task` then `start_task`.

## Handing work to another agent

```
list_agents
create_task {
  title, description, assignee: "<their name>",
  priority: 0-9 (0 highest),
  tags: [...],
  payload: { /* structured handoff: files, branch, constraints */ }
}
```

The assignee is notified in their inbox automatically. You can also
`send_message` with extra context. Use `wait_messages` if you need to block
on a reply.

## Claiming work

- `claim_task` — take the highest-priority open task (or a specific id)
- `list_tasks { assignee: "<me>" }` — what is already mine

## While working

- `start_task` → in_progress
- `update_task { progress: 0..1, note }` for heartbeat
- `comment_task` for non-blocking notes
- `complete_task { result, success: true|false }` when done

## Messaging

- `send_message { to: "<name>", content }` — DM
- `send_message { to: "*", content }` — broadcast
- `inbox` + `mark_read`
- `wait_messages { timeout_ms }` — long-poll

## Rules

- Prefer the task board for work handoff; messages for coordination.
- Put file paths, branch names, and constraints in `payload`.
- Do not ignore an inbox assignment — claim it or `send_message` back.
- Keep `AGENT_NAME` unique per live session (e.g. `codex-worker`, `claude-reviewer`).
