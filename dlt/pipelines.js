const path = require('path');

const PIPELINE_CALL = /\bdlt\.pipeline\s*\(/g;
const IMPORTS_DLT = /^\s*(?:import\s+dlt\b|from\s+dlt\b)/m;
const MAIN_GUARD = /^if\s+__name__\s*==\s*["']__main__["']\s*:/m;
const TOP_LEVEL_PIPELINE = /^(?:[\w.]+\s*=\s*)?dlt\.pipeline\s*\(/m;
const STRING_LITERAL = /^\s*(?:"([^"\\\n]*)"|'([^'\\\n]*)')/;
const NAMED_ARGUMENT = /(?:^|[,(\s])pipeline_name\s*=\s*(?:"([^"\\\n]*)"|'([^'\\\n]*)')/;

/**
 * Decide whether a Python file is a pipeline entry point, and find the pipeline's name.
 * An entry point imports dlt and either runs under a `__main__` guard or creates a pipeline at the top level.
 * A helper module that only creates pipelines inside functions is not an entry point.
 * The name is undefined when it is not a string literal in this file.
 * @param {string} text
 * @returns {{name: string | undefined} | undefined}
 */
function findPipeline(text) {
	const code = text.replace(/^[ \t]*#.*$/gm, '');
	if (!IMPORTS_DLT.test(code) || !(MAIN_GUARD.test(code) || TOP_LEVEL_PIPELINE.test(code))) {
		return undefined;
	}
	for (const match of code.matchAll(PIPELINE_CALL)) {
		const args = callArguments(code, match.index + match[0].length);
		const literal = STRING_LITERAL.exec(args) || NAMED_ARGUMENT.exec(topLevel(args));
		if (literal) {
			return { name: literal[1] ?? literal[2] };
		}
	}
	return { name: undefined };
}

/** The text between the parentheses of a call, given the index just after the opening one. */
function callArguments(code, start) {
	let depth = 1;
	let quote = '';
	for (let i = start; i < code.length; i++) {
		const c = code[i];
		if (quote) {
			if (c === '\\') {
				i++;
			} else if (c === quote) {
				quote = '';
			}
		} else if (c === '"' || c === "'") {
			quote = c;
		} else if (c === '(') {
			depth++;
		} else if (c === ')' && --depth === 0) {
			return code.slice(start, i);
		}
	}
	return code.slice(start);
}

/** Blank out nested calls so a pipeline_name inside another call's arguments is not picked up. */
function topLevel(args) {
	let depth = 0;
	let out = '';
	for (const c of args) {
		if (c === ')') {
			depth--;
		}
		out += depth > 0 ? ' ' : c;
		if (c === '(') {
			depth++;
		}
	}
	return out;
}

/** @param {string} value */
function quote(value) {
	if (/^[\w@%+=:,./\\-]+$/.test(value)) {
		return value;
	}
	return path.sep === '\\' ? `"${value}"` : `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

/**
 * Build the shell command that runs a pipeline entry file. The command runs from the workspace root.
 * @param {{file: string, root: string, setting: string, hasUv: boolean}} options
 */
function buildCommand({ file, root, setting, hasUv }) {
	const relative = path.relative(root, file);
	const inside = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
	const shown = inside ? relative : file;
	const dir = path.dirname(relative);
	const module = inside && path.basename(file) === '__main__.py' && dir !== '.' ? dir.split(path.sep).join('.') : '';

	if (setting.trim()) {
		return setting.replace(/\$\{file\}/g, quote(shown)).replace(/\$\{module\}/g, module);
	}
	const python = hasUv ? 'uv run python' : 'python';
	return module ? `${python} -m ${module}` : `${python} ${quote(shown)}`;
}

module.exports = { findPipeline, buildCommand };
