const { registerMotherDuck } = require('./motherduck');

function activate(context) {
	registerMotherDuck(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
