# AGENTS.md

## /init

Use this instruction only in a brand-new, empty application repository.

When `/init` is invoked, do the following:

1. Confirm the repository is effectively empty except for git or tool metadata files.
2. Run:
   ```sh
   jj git init
   ```
3. Create `README.md`.
4. Create `memory.md`.
5. Create `issues.md`.

Use these starter contents unless the user provides a better project-specific version.

### `README.md`

```md
# <project-name>

## Overview
Brief description of the app and its purpose.

## Status
Early setup.

## Next Steps
- Define the core user flow
- Choose the stack
- Build the first runnable version
```

### `memory.md`

```md
# Memory

## Project Facts
- Project name:
- Goal:
- Primary users:

## Decisions
- None yet.

## Conventions
- None yet.
```

### `issues.md`

```md
# Issues

## Open
- No issues logged yet.

## Closed
- None.
```

### Execution rules

- If `jj` is unavailable, stop and report that clearly.
- If any of the files already exist, preserve user content and only add missing sections if needed.
- Keep the initial scaffold minimal and editable.
- After setup, report what was created and any command failures.
