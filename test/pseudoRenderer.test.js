const assert = require('node:assert/strict');
const test = require('node:test');
const { parseJava } = require('../out/javaParser.js');
const { renderPseudo } = require('../out/pseudoRenderer.js');

async function render(source) {
  return renderPseudo(source, await parseJava(source));
}

test('renders a method declaration and its block', async () => {
  const source = `class Example {
    int value() {
        return 3;
    }
}`;
  assert.equal(await render(source), `class Example {
    int value():
        return 3
}`);
});

test('renders if and else blocks and keeps the Java condition', async () => {
  const source = `class Example {
    int choose(int value) {
        if (value >= 10 && value != 20) {
            return value;
        } else {
            return 0;
        }
    }
}`;
  assert.equal(await render(source), `class Example {
    int choose(int value):
        if value >= 10 && value != 20:
            return value
        else:
            return 0
}`);
});

test('renders expression statements without changing expressions', async () => {
  const source = `class Example {
    void run() {
        service.process(order.getItems());
        count += 1;
    }
}`;
  assert.equal(await render(source), `class Example {
    void run():
        service.process(order.getItems())
        count += 1
}`);
});

test('renders unbraced if and else statements', async () => {
  const source = `class Example {
    int choose(boolean ready) {
        if (ready) return 1;
        else return 0;
    }
}`;
  assert.equal(await render(source), `class Example {
    int choose(boolean ready):
        if ready:
            return 1
        else:
            return 0
}`);
});

test('renders a compact if block with an expression statement', async () => {
  const source = `class Example {
    void run() { if (condition) { foo(); } }
}`;
  assert.equal(await render(source), `class Example {
    void run():
        if condition:
            foo()
}`);
});

test('renders enhanced for with Java types and iterable expressions intact', async () => {
  const source = `class Example {
    void process(Order order) {
        for (Item item : order.getItems()) {
            processItem(item);
        }
    }
}`;
  assert.equal(await render(source), `class Example {
    void process(Order order):
        for Item item : order.getItems():
            processItem(item)
}`);
});

test('renders while with its Java condition intact', async () => {
  const source = `class Example {
    void run(int remaining) {
        while (remaining > 0 && isReady()) {
            remaining--;
        }
    }
}`;
  assert.equal(await render(source), `class Example {
    void run(int remaining):
        while remaining > 0 && isReady():
            remaining--
}`);
});

test('renders unbraced enhanced for and while bodies', async () => {
  const source = `class Example {
    void run(int[] values, int remaining) {
        for (int value : values) use(value);
        while (remaining > 0) remaining--;
    }
}`;
  assert.equal(await render(source), `class Example {
    void run(int[] values, int remaining):
        for int value : values:
            use(value)
        while remaining > 0:
            remaining--
}`);
});

test('preserves unsupported declarations and loops as readable Java', async () => {
  const source = `class Example {
    int count(int limit) {
        int total = 0;
        for (int i = 0; i < limit; i++) {
            total += i;
        }
        return total;
    }
}`;
  assert.equal(await render(source), `class Example {
    int count(int limit):
        int total = 0;
        for (int i = 0; i < limit; i++) {
            total += i;
        }
        return total
}`);
});

test('preserves comments between supported statements', async () => {
  const source = `class Example {
    int run() {
        // Keep this explanation.
        call();
        return 1;
    }
}`;
  assert.equal(await render(source), `class Example {
    int run():
        // Keep this explanation.
        call()
        return 1
}`);
});
