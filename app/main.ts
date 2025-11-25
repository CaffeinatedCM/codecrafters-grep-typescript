import { Effect } from 'effect';
import { Terminal } from '@effect/platform';
import { parsePattern } from './parse';
import { matchFrom } from './match';

const program = (args: string[]) => Effect.gen(function* () {
 const terminal = yield* Terminal.Terminal;

 if (args[2] !== "-E") {
  yield * terminal.display("Expected first argument to be '-E'\n");
  return yield * Effect.fail(1);
 }
 const pattern = args[3];

 const inputLine = yield* terminal.readLine;
 const patterns = yield* parsePattern(pattern);
//  yield * terminal.display(JSON.stringify(patterns, null, 2) + "\n");
  for (let i = 0; i < inputLine.length; i++) {
    const isMatch = yield* matchFrom(inputLine, i, patterns, 0);
    if (isMatch !== null) {
      yield * terminal.display(`${inputLine}\n`)
      return yield * Effect.succeed(0);
    }
  }

  // yield * terminal.display("no match\n");
  return yield * Effect.fail(1);
})

export { program }