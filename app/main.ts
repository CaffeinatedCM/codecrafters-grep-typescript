import { Effect, Match } from 'effect';
import { Terminal } from '@effect/platform';
import { BunContext, BunRuntime } from '@effect/platform-bun';

const args = process.argv;
const pattern = args[3];

const matchPattern = (inputLine: string, pattern: string) => Effect.gen(function* () {
  return Match.value(pattern).pipe(
    Match.withReturnType<boolean>(),
    Match.when((pattern) => pattern.length === 1, () => {
      return inputLine.includes(pattern);
    }),
    Match.orElse(() => {
      return false;
    })
  )
})

if (args[2] !== "-E") {
  console.log("Expected first argument to be '-E'");
  process.exit(1);
}

// You can use print statements as follows for debugging, they'll be visible when running tests.

const program = Effect.gen(function* () {
 const terminal = yield* Terminal.Terminal;
 const inputLine = yield* terminal.readLine;
 const isMatch = yield* matchPattern(inputLine, pattern);
 if (isMatch) {
  return yield * Effect.succeed(0);
 } else {
  return yield * Effect.fail(1);
 }
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)));