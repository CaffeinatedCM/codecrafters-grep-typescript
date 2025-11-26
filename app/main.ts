import { Effect, Stream, Option } from 'effect';
import { Terminal } from '@effect/platform';
import { BunStream} from '@effect/platform-bun'
import { parsePattern } from './parse';
import { matchFrom } from './match';
import { InputStream } from './InputStream';

const program = (args: string[]) => Effect.gen(function* () {
 const terminal = yield* Terminal.Terminal;
 const inputStream = yield* InputStream;

 if (args[2] !== "-E") {
  yield * terminal.display("Expected first argument to be '-E'\n");
  return yield * Effect.fail(1);
 }

 const pattern = args[3];
 const patterns = yield* parsePattern(pattern);

//  const inputLines = yield* Stream.runCollect(inputStream)

 let foundMatch = false;
 yield* Stream.runForEach((inputLine: string) => {
  return Effect.gen(function* () {
    for (let i = 0; i < inputLine.length; i++) {
      const isMatch = yield* matchFrom(inputLine, i, patterns, 0);
      if (isMatch !== null) {
        yield * terminal.display(`${inputLine}\n`)
        foundMatch = true;
        return yield * Effect.succeed(0);
      }
    }
  })
 })(inputStream)

  if (!foundMatch) {
    return yield * Effect.fail(1);
  } 

  return yield * Effect.succeed(0);
})

export { program }