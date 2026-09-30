import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('javaPseudocode.open', () => {
      void vscode.window.showInformationMessage(
        'The pseudocode view has not been implemented yet.'
      );
    })
  );
}
