import * as vscode from 'vscode';
import { parseJava, JavaSyntaxNode } from './javaParser';

const SCHEME = 'java-pseudocode';
const COMMAND = 'javaPseudocode.open';

export function activate(context: vscode.ExtensionContext): void {
  const sources = new Map<string, vscode.Uri>();
  const syntaxTrees = new Map<string, JavaSyntaxNode>();
  const changed = new vscode.EventEmitter<vscode.Uri>();

  const provider: vscode.TextDocumentContentProvider = {
    onDidChange: changed.event,
    async provideTextDocumentContent(uri) {
      const source = sources.get(uri.toString());
      if (!source) {
        return '';
      }
      const text = (await vscode.workspace.openTextDocument(source)).getText();
      try {
        syntaxTrees.set(uri.toString(), await parseJava(text));
      } catch {
        // A Java file may be incomplete while it is being edited.
        syntaxTrees.delete(uri.toString());
      }
      return text;
    },
  };

  context.subscriptions.push(
    changed,
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider),
    vscode.workspace.onDidChangeTextDocument(({ document }) => {
      for (const [virtualUri, sourceUri] of sources) {
        if (sourceUri.toString() === document.uri.toString()) {
          changed.fire(vscode.Uri.parse(virtualUri));
        }
      }
    }),
    vscode.commands.registerCommand(COMMAND, async () => {
      const source = vscode.window.activeTextEditor?.document;
      if (!source || source.languageId !== 'java') {
        void vscode.window.showInformationMessage('Open a Java file first.');
        return;
      }

      const virtualUri = vscode.Uri.from({
        scheme: SCHEME,
        path: `/${encodeURIComponent(source.uri.toString())}.java`,
      });
      sources.set(virtualUri.toString(), source.uri);

      const document = await vscode.workspace.openTextDocument(virtualUri);
      await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
      });
    })
  );
}
