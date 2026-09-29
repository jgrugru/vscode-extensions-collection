# dlt Pipelines

Find the [dlt](https://dlthub.com) pipelines in your workspace and run them with one click.

## Features

- The **dlt** sidebar lists every pipeline entry file: a Python file that imports dlt and either has an `if __name__ == "__main__":` block or creates a pipeline at the top level. Helper modules that only define functions are skipped. Each is labeled with its pipeline name when the file spells it out, otherwise with the file name.
- Press **Run** on a pipeline to start it in a terminal panel. Press **Stop** to end it.
- Each pipeline shows whether its last run is running, succeeded (with duration), failed (with exit code) or stopped.
- Click a pipeline to open its source file.

## Requirements

Python with dlt installed in the environment your terminal uses. When the workspace has a `uv.lock`, pipelines run through `uv run`.

## How a pipeline runs

dlt has no run command, so the extension runs the pipeline's Python file from the workspace folder:

- `python <file>` for most files.
- `python -m <module>` for a file named `__main__.py`, such as `src/pipelines/crm/__main__.py`.

Set **dltPipelines.runCommand** to change this. `${file}` is the file path and `${module}` its dotted module path, for example `poetry run python ${file}`.

## Limits

- The pipeline name is read only when it is a string literal in the entry file. Otherwise the file name is shown.
- Run status resets when the window reloads.
