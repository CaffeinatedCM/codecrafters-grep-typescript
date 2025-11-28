import { Effect, Stream, Option } from 'effect';
import { Terminal } from '@effect/platform';
import { BunStream} from '@effect/platform-bun'
import { parsePattern } from './parse';
import { matchFrom } from './match';
import { InputStream } from './InputStream';

const program = (args: string[]) => Effect.gen(function* () {
 const terminal = yield* Terminal.Terminal;
 const inputStream = yield* InputStream;

 // find the -E flag 
 let eFlagIndex = args.indexOf("-E");
 if (eFlagIndex === -1) {
  yield * terminal.display("Expected first argument to be '-E'\n");
  return yield * Effect.die(1);
 }
 const pattern = args[eFlagIndex + 1];
 if (!pattern) {
  yield * terminal.display("Expected pattern after '-E'\n");
  return yield * Effect.die(1);
 }

 let oFlagIndex = args.indexOf("-o");

 // if the last argument is a file, read the file
 // (just txt for now)
 let fileStream = null;
 if (args[args.length - 1].endsWith(".txt")) {
  const file = Bun.file(args[args.length - 1]);
  fileStream = Stream.fromReadableStream(() => file.stream(), (e) => {
    console.error(e);
    console.log(e)
    return Effect.die(e);
  }).pipe(Stream.decodeText('utf-8'), Stream.splitLines)
 }

 let targetStream = fileStream ?? inputStream;
 const patterns = yield* parsePattern(pattern);

 let foundMatch = false;
 yield* Stream.runForEach((inputLine: string) => {
  return Effect.gen(function* () {
    for (let i = 0; i < inputLine.length; i++) {
      const isMatch = yield* matchFrom(inputLine, i, patterns, 0);
      if (isMatch !== null) {
        foundMatch = true;
        if (oFlagIndex !== -1) {
          yield * terminal.display(`${inputLine.substring(i, isMatch)}\n`)
          i = isMatch - 1;
        }
        else {
          yield * terminal.display(`${inputLine}\n`)
          return yield * Effect.succeed(0);
        }
        //return yield * Effect.succeed(0);
      }
    }
  })
 })(targetStream)

  if (!foundMatch) {
    return yield * Effect.fail(1);
  } 

  return yield * Effect.succeed(0);
})

export { program }