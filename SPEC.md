# Java Pseudocode View

Build a VS Code extension that provides a read-only,
Python-like view of Java source code.

## Primary goal

Make Java code faster and easier to read without changing its
semantics or attempting to translate Java into Python.

Java remains the source of truth.

## Example

Input:

public boolean canProcess(Order order) {
    if (order == null) {
        return false;
    }

    for (Item item : order.getItems()) {
        process(item);
    }

    return true;
}

Output:

boolean canProcess(Order order):
    if order == null:
        return false

    for Item item : order.getItems():
        process(item)

    return true

## Transformation principles

Preserve Java expressions and identifiers whenever possible.

Transform structural syntax only:

- Remove semicolons used as statement terminators
- Replace block braces with indentation
- Replace control-flow block opening with ":"
- Remove unnecessary parentheses around if/while conditions
- Preserve Java method calls
- Preserve Java types
- Preserve Java operators initially
- Preserve generics
- Do not attempt to generate valid Python
- Do not use an LLM for source transformation

Unsupported constructs should degrade gracefully and preserve
their Java representation rather than guessing.

## Architecture

Java source
    ↓
Java parser / AST
    ↓
Pseudo renderer
    ↓
Pseudo document + source map

The source map must map pseudo source ranges back to Java source
ranges.

## VS Code

Provide command:

    Java Pseudo: Open Pseudocode

It opens a virtual read-only document beside the current Java file.

The pseudocode document must not be written to disk.

## Navigation

F12 / Go to Definition from pseudocode should:

1. Map pseudo position → Java source position
2. Invoke Java's existing Go to Definition provider
3. Navigate to the resulting Java definition

Do not implement Java semantic analysis ourselves.

## MVP non-goals

- Editing pseudocode
- Pseudo → Java generation
- LLM transformations
- Full Python compatibility
- Refactoring
- Rename
- Debugging support