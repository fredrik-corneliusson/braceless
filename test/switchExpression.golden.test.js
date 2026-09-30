const assert = require('node:assert/strict');
const test = require('node:test');
const { parseJava } = require('../out/javaParser.js');
const { renderPseudo } = require('../out/pseudoRenderer.js');

const cases = [
  {
    name: 'arrow rules in a local variable declaration',
    java: `class Example {
    String label(int day) {
        String result = switch (day) {
            case 1, 7 -> "weekend";
            default -> "weekday";
        };
        return result;
    }
}`,
    pseudo: `class Example {
    String label(int day):
        String result = switch day:
            case 1, 7 -> "weekend"
            default -> "weekday"
        return result
}`,
  },
  {
    name: 'block rule with yield in a return statement',
    java: `class Example {
    String label(int value) {
        return switch (value) {
            case 0 -> {
                log(value);
                yield "zero";
            }
            default -> String.valueOf(value);
        };
    }
}`,
    pseudo: `class Example {
    String label(int value):
        return switch value:
            case 0 ->
                log(value)
                yield "zero"
            default -> String.valueOf(value)
}`,
  },
  {
    name: 'colon cases in an assignment',
    java: `class Example {
    void update(int input) {
        answer = switch (input) {
            case 1: yield 10;
            default: yield 20;
        };
    }
}`,
    pseudo: `class Example {
    void update(int input):
        answer = switch input:
            case 1:
                yield 10
            default:
                yield 20
}`,
  },
  {
    name: 'field initializer with spacing between rules',
    java: `class Example {
    private final int code = switch (kind) {
        case OK -> 200;

        default -> 500;
    };
}`,
    pseudo: `class Example {
    private final int code = switch kind:
        case OK -> 200

        default -> 500
}`,
  },
];

for (const golden of cases) {
  test(`switch expression golden: ${golden.name}`, async () => {
    assert.equal(renderPseudo(golden.java, await parseJava(golden.java)), golden.pseudo);
  });
}
