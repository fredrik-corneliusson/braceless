# Braceless

Braceless is a VS Code extension for the read-only Java pseudocode view described in [SPEC.md](SPEC.md).

## Development

Requires Node.js LTS, npm, and VS Code. Run `npm install`, `npm run compile`, and `npm test`. Press **Ctrl+F5** in VS Code to launch the Extension Development Host without the debugger. With a Java file active, press **Ctrl+Shift+P** to open the Command Palette, then run **Braceless: Open**. It opens a read-only pseudocode document beside the Java file. The renderer handles methods, blocks, `if`/`else`, enhanced `for` loops, `while` loops, variable declarations, assignments, returns, and expression statements. Unsupported constructs, including basic `for` and `do` loops, remain readable Java.
