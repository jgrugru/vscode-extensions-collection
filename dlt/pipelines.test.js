const assert = require('assert');
const path = require('path');
const { findPipeline, buildCommand } = require('./pipelines');

const root = path.resolve('/work/proj');
const at = (...p) => path.join(root, ...p);

// findPipeline
const top = (call) => `import dlt\n${call}`;
assert.deepStrictEqual(findPipeline(top('p = dlt.pipeline(pipeline_name="a", destination="duckdb")')), { name: 'a' });
assert.deepStrictEqual(findPipeline(top("dlt.pipeline(destination='duckdb', pipeline_name='b')")), { name: 'b' });
assert.deepStrictEqual(findPipeline(top('p = dlt.pipeline("pos", destination="duckdb")')), { name: 'pos' });
assert.deepStrictEqual(findPipeline(top('p = dlt.pipeline(\n    pipeline_name=NAME,\n    destination="duckdb",\n)')), { name: undefined });
assert.deepStrictEqual(findPipeline(top('p = dlt.pipeline(pipeline_name="a", dataset_name=other("x"))')), { name: 'a' });
assert.deepStrictEqual(findPipeline(top('p = dlt.pipeline(pipeline_name="one")\nq = dlt.pipeline(pipeline_name="two")')), { name: 'one' });
assert.deepStrictEqual(findPipeline('from dlt.common import x\np = dlt.pipeline(pipeline_name="f")'), { name: 'f' });

// An entry file with a main guard qualifies even when a helper creates the pipeline.
assert.deepStrictEqual(findPipeline('import dlt\n\ndef load():\n    p = make("x")\n\nif __name__ == "__main__":\n    load()'), { name: undefined });
assert.deepStrictEqual(findPipeline("from dlt.sources import x\nif __name__ == '__main__':\n    run()"), { name: undefined });
assert.deepStrictEqual(findPipeline('import dlt\n\ndef p():\n    return dlt.pipeline(pipeline_name="named")\n\nif __name__ == "__main__":\n    p()'), { name: 'named' });

// Helper modules, non-dlt scripts and comments do not qualify.
assert.strictEqual(findPipeline('import dlt\n\ndef make(name):\n    return dlt.pipeline(pipeline_name=name)\n'), undefined);
assert.strictEqual(findPipeline('import dlt\n\n@dlt.source\ndef s():\n    pass\n'), undefined);
assert.strictEqual(findPipeline('if __name__ == "__main__":\n    print("hi")'), undefined);
assert.strictEqual(findPipeline('x = 1\nprint("no pipeline")'), undefined);
assert.strictEqual(findPipeline('import dlt\n# p = dlt.pipeline(pipeline_name="commented")'), undefined);
assert.strictEqual(findPipeline('import dlt\n# if __name__ == "__main__":'), undefined);

// buildCommand
const base = { root, setting: '', hasUv: false };
assert.strictEqual(buildCommand({ ...base, file: at('src', 'load.py') }), `python ${path.join('src', 'load.py')}`);
assert.strictEqual(buildCommand({ ...base, file: at('src', 'load.py'), hasUv: true }), `uv run python ${path.join('src', 'load.py')}`);
assert.strictEqual(buildCommand({ ...base, file: at('src', 'pipelines', 'crm', '__main__.py') }), 'python -m src.pipelines.crm');
assert.strictEqual(buildCommand({ ...base, file: at('src', 'pipelines', 'crm', '__main__.py'), hasUv: true }), 'uv run python -m src.pipelines.crm');
assert.strictEqual(buildCommand({ ...base, file: at('__main__.py') }), 'python __main__.py');
assert.strictEqual(
	buildCommand({ ...base, file: at('src', 'load.py'), setting: 'poetry run python ${file} --full' }),
	`poetry run python ${path.join('src', 'load.py')} --full`,
);
assert.strictEqual(
	buildCommand({ ...base, file: at('src', 'pipelines', 'crm', '__main__.py'), setting: 'uv run -m ${module}' }),
	'uv run -m src.pipelines.crm',
);
assert.strictEqual(buildCommand({ ...base, file: at('my dir', 'load.py') }), `python "${path.join('my dir', 'load.py')}"`);
assert.strictEqual(buildCommand({ ...base, file: path.resolve('/elsewhere/load.py') }), `python ${path.resolve('/elsewhere/load.py')}`);

console.log('ok');
