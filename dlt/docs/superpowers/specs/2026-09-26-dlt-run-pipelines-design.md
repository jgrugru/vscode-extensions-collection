# dlt Pipelines extension: run pipelines (v1)

Extension name: `vscode-extension-dlt`. Display name: "dlt Pipelines".

## Goal

Let a developer find the dlt pipelines in an open workspace and run any of them with one click, then see whether the last run succeeded. It works with any dlt project, not only the PWCAPTION `dlt-warehouse` layout, so it can be published to the marketplaces.

## Scope

In v1:
- A sidebar tree, "dlt Pipelines", listing pipeline entry files found in the workspace.
- Inline Run and Stop buttons on each node, and a Refresh button in the view title.
- Run status on each node: running, succeeded with duration, failed with exit code, or stopped.
- A setting to override the launch command.

Out of scope for v1 (later phases, cheap to add as more tree buttons):
- dlt CLI inspect commands: `dlt pipeline <name> info`, `trace`, `failed-jobs`, `drop-pending-packages`, `sync`, `schema`.
- Scaffolding through `dlt init`.
- Extra command-line arguments or environment prompts per run.
- A "run all" action.
- Persisting run status across window reloads.

## Background

dlt has no `dlt run` command. A pipeline runs when its Python entry point runs. The extension therefore discovers Python files that create a pipeline and launches them, and does not call the dlt CLI in v1.

## Design

### Discovery

`findPipeline(text)` is a pure function. It takes the text of a `.py` file and returns `{ name }` when the file is a pipeline entry point, or `undefined` when it is not. Commented-out lines are ignored.
- A file is an entry point when it imports dlt (`import dlt` or `from dlt...`) and either has an `if __name__ == "__main__":` block or has a `dlt.pipeline(` call at the top level (no indentation). A helper module that creates pipelines only inside functions is not an entry point. This matters because real projects often create pipelines in a shared helper, such as `pc_pipeline(name)` in `src/utils/pc_common.py`, and the entry files only call the helper.
- The name is the first literal `pipeline_name="..."` or `pipeline_name='...'` argument, or a string literal as the first positional argument, of any `dlt.pipeline(` call in the file. When there is none, the name is `undefined` and the node is labeled with the file name.
- A file always gets one node, however many pipelines it creates.

The scan uses `vscode.workspace.findFiles('**/*.py')` and excludes `.venv`, `venv`, `node_modules` and `site-packages`. It runs when the view first opens, when a `.py` file is saved, and when the user presses Refresh.

### Launch command

`buildCommand({ file, root, setting, hasUv })` is a pure function that returns the shell command string.

Order of precedence:
1. If the `dltPipelines.runCommand` setting is non-empty, use it. It supports the variables `${file}` (the file path relative to the workspace root, or absolute when outside it, quoted when needed) and `${module}` (the dotted module path relative to the workspace root).
2. Otherwise, if the file is named `__main__.py`, run `python -m <module>` where `<module>` is the file's folder path relative to the workspace root, with `/` replaced by `.`. This covers the `src/pipelines/<name>/__main__.py` layout.
3. Otherwise run `python <file>`.

When `hasUv` is true (a `uv.lock` exists at the workspace root), `python` becomes `uv run python` in rules 2 and 3, so the project's environment is used.

The working directory is always the workspace folder root.

### Running

Each run is a VS Code Task with a `dltPipeline` task definition that carries the file path, using a `ShellExecution` of the built command. The task runs in a dedicated terminal panel and shows its output there.

- Run on a node that is already running does nothing.
- Stop terminates the task execution.
- Clicking a node opens the source file.

### Status

The tree provider keeps an in-memory map from file path to state. It updates the map from `onDidStartTaskProcess` and `onDidEndTaskProcess`, matching events to nodes by the task definition's file path. No output parsing is needed.

| Event | State shown |
| --- | --- |
| process starts | running (spinner) |
| exit code 0 | succeeded, with duration |
| exit code non-zero | failed, with exit code |
| ended by Stop (no exit code) | stopped |

State resets when the window reloads.

### Empty and error states

- With no workspace folder open, or no pipelines found, the view shows a welcome message with a Refresh link.
- A missing `python` or `uv` executable appears in the task terminal as an ordinary shell error, and the node shows the failed state with that exit code.

### Files

Plain JavaScript with no build step, as in the sibling `vscode-extension-duckdb` extension.

- `package.json`: contributes the view container, the view, the commands, the menus, the settings and the welcome content.
- `extension.js`: activation, the tree provider, the task wiring and the commands.
- `pipelines.js`: `findPipeline` and `buildCommand`, with no dependency on the `vscode` module so they can be tested with plain node.
- `pipelines.test.js`: node asserts for both pure functions, run with `npm test`.
- `README.md`, `LICENSE` (MIT), `.vscodeignore`, `.gitignore`.

## Testing

- Unit: `npm test` covers `findPipeline` (literal name, single quotes, positional name, no literal name, main guard with a helper-created pipeline, helper module rejected, no dlt import, comments) and `buildCommand` (each precedence rule, with and without `uv`, the `${file}` and `${module}` variables, paths with spaces).
- Manual: build the `.vsix` with `npm run package`, install it, and check on a real dlt project that the tree lists the pipelines, Run starts the task, status updates on success, failure and Stop, and the setting override works.

## Open questions

None for v1.
