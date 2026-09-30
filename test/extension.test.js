const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

test('opens rendered Java beside the editor and refreshes on source changes', async () => {
  const sourceUri = { toString: () => 'file:///Order.java' };
  let sourceText = 'class Order {\n    int value() {\n        return 1;\n    }\n}\n';
  const source = { uri: sourceUri, languageId: 'java', getText: () => sourceText };
  let command;
  let provider;
  let onSourceChange;
  let opened;
  let notification;

  const vscode = {
    EventEmitter: class {
      event = () => {};
      fire(uri) { notification = uri; }
      dispose() {}
    },
    Uri: {
      from: ({ scheme, path }) => ({ toString: () => `${scheme}:${path}` }),
      parse: (value) => ({ toString: () => value }),
    },
    ViewColumn: { Beside: 2 },
    commands: { registerCommand: (id, callback) => {
      assert.equal(id, 'javaPseudocode.open');
      command = callback;
      return { dispose() {} };
    } },
    window: {
      activeTextEditor: { document: source },
      showTextDocument: async (document, options) => { opened = { document, options }; },
      showInformationMessage: () => assert.fail('unexpected message'),
    },
    workspace: {
      registerTextDocumentContentProvider: (scheme, value) => {
        assert.equal(scheme, 'java-pseudocode');
        provider = value;
        return { dispose() {} };
      },
      onDidChangeTextDocument: (callback) => {
        onSourceChange = callback;
        return { dispose() {} };
      },
      openTextDocument: async (uri) => uri === sourceUri ? source : { uri },
    },
  };

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    return request === 'vscode' ? vscode : originalLoad.call(this, request, parent, isMain);
  };
  try {
    const { activate } = require('../out/extension.js');
    activate({ subscriptions: [] });
  } finally {
    Module._load = originalLoad;
  }

  await command();
  assert.deepEqual(opened.options, { viewColumn: 2, preview: false });
  assert.match(opened.document.uri.toString(), /^java-pseudocode:/);
  assert.equal(await provider.provideTextDocumentContent(opened.document.uri),
    'class Order {\n    int value():\n        return 1\n}\n');

  sourceText = 'class Order {\n    int value() {\n        return 2;\n    }\n}\n';
  onSourceChange({ document: source });
  assert.equal(notification.toString(), opened.document.uri.toString());
  assert.equal(await provider.provideTextDocumentContent(opened.document.uri),
    'class Order {\n    int value():\n        return 2\n}\n');
});
