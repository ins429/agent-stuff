# Agent Stuff

A [pi package](https://github.com/badlogic/pi-mono) containing skills, extensions, themes, and prompt commands for the pi coding agent.

Originally inspired by [`mitsupi`](https://github.com/mitsuhiko/agent-stuff).

## Skills

Skill files live in the [`skills/`](skills) folder:

| Skill | Description |
|-------|-------------|
| [`/commit`](skills/commit) | Git commits using concise Conventional Commits-style subjects |
| [`/update-changelog`](skills/update-changelog) | Update changelogs with notable user-facing changes |
| [`/ghidra`](skills/ghidra) | Reverse engineer binaries using Ghidra's headless analyzer |
| [`/github`](skills/github) | Interact with GitHub via the `gh` CLI (issues, PRs, runs, APIs) |
| [`/web-browser`](skills/web-browser) | Browse the web by remote controlling Chrome via CDP |
| [`/tmux`](skills/tmux) | Remote control tmux sessions with keystrokes and pane scraping |
| [`/sentry`](skills/sentry) | Fetch and analyze Sentry issues, events, and logs |
| [`/pi-share`](skills/pi-share) | Load and parse session transcripts from pi-share URLs |
| [`/frontend-design`](skills/frontend-design) | Design and implement distinctive frontend interfaces |

## Extensions

Extensions live in the [`pi-extensions/`](pi-extensions) folder:

| Extension | Description |
|-----------|-------------|
| [`answer.ts`](pi-extensions/answer.ts) | `/answer` command — extracts questions from the last assistant message and presents an interactive TUI to answer them one by one |
| [`control.ts`](pi-extensions/control.ts) | Inter-session communication via Unix domain sockets (`--session-control` flag). Send messages, get summaries, and coordinate between running pi sessions |
| [`cwd-history.ts`](pi-extensions/cwd-history.ts) | Seeds the prompt editor history with recent prompts from current and past sessions in the same working directory |
| [`files.ts`](pi-extensions/files.ts) | `/files` and `/diff` commands — file browser merging git status with session-referenced files, plus reveal/open/edit/diff actions |
| [`loop.ts`](pi-extensions/loop.ts) | `/loop` command — starts a follow-up loop that keeps sending a prompt until the agent calls `signal_loop_success` |
| [`notify.ts`](pi-extensions/notify.ts) | Sends native desktop notifications when the agent finishes (OSC 777, works in Ghostty, iTerm2, WezTerm) |
| [`review.ts`](pi-extensions/review.ts) | `/review` command and Ctrl+R shortcut — code review for PRs, branches, uncommitted changes, or specific commits |
| [`todos.ts`](pi-extensions/todos.ts) | File-backed todo manager with a TUI for listing, creating, and editing todos (stored in `.pi/todos/`) |
| [`whimsical.ts`](pi-extensions/whimsical.ts) | Replaces "Thinking..." with random phrases like "Reticulating splines...", "Consulting the void...", etc. |

## Themes

Themes live in the [`pi-themes/`](pi-themes) folder:

| Theme | Description |
|-------|-------------|
| [`nightowl.json`](pi-themes/nightowl.json) | Night Owl color theme |

## Prompt Commands

Prompt template commands live in the [`commands/`](commands) folder. Currently empty — add `.md` files here to register `/command` prompts.

## Publishing

This package is published to npm via GitHub Actions. To release:

1. Run `npm version <patch|minor|major>` to bump the version
2. Update `CHANGELOG.md` for the release
3. Commit and tag with `git tag <version>`
4. Push commits and tags: `git push && git push --tags`

The [npm-publish workflow](.github/workflows/npm-publish.yml) triggers on version tags and publishes automatically.

## License

See [LICENSE](LICENSE).
