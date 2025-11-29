import { Effect, Stream } from 'effect';
import { Terminal } from '@effect/platform';
import { parsePattern } from './parse';
import { matchFrom } from './match';
import { InputStream } from './InputStream';
import { Glob } from 'bun';
import type { Pattern } from './types';

type MatchLineOptions = {
  output: boolean;
  prefix?: string;
}

const matchLine = (inputLine: string, patterns: Pattern[], options: MatchLineOptions = { output: false, prefix: "" }) => Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;

  let foundMatch = false;
  for (let i = 0; i < inputLine.length; i++) {
    const isMatch = yield* matchFrom(inputLine, i, patterns, 0);
    if (isMatch !== null) {
      foundMatch = true;
      if (options.output) {
        yield* terminal.display(`${options.prefix}${inputLine.substring(i, isMatch)}\n`)
        i = isMatch - 1;
      }
      else {
        yield* terminal.display(`${options.prefix}${inputLine}\n`)
        return yield* Effect.succeed(true);
      }
    }
  }

  return foundMatch;
})

type MatchFileOptions = {
  output: boolean;
  showFileName: boolean;
}

const matchFile = (fileName: string, patterns: Pattern[], options: MatchFileOptions = { output: false, showFileName: false }) => Effect.gen(function* () {
  const file = Bun.file(fileName);
  const inputStream: Stream.Stream<string, Effect.Effect<never, never, never>, never> = Stream.fromReadableStream(() => file.stream(), (error) => {
    return Effect.die(error);
  }).pipe(Stream.decodeText('utf-8'), Stream.splitLines);
  let foundMatch = false;
  yield* Stream.runForEach((inputLine: string) => {
    return Effect.gen(function* () {
      const isMatch = yield* matchLine(inputLine, patterns, { output: options.output, prefix: options.showFileName ? `${fileName}:` : "" });
      if (isMatch) {
        foundMatch = true;
      }
    })
  })(inputStream);
  return foundMatch;
})

const program = (args: string[]) => Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  const inputStream = yield* InputStream;

  let globalFoundMatch = false;

  // find the -E flag 
  let eFlagIndex = args.indexOf("-E");
  if (eFlagIndex === -1) {
    yield* terminal.display("Expected first argument to be '-E'\n");
    return yield* Effect.die(1);
  }
  const pattern = args[eFlagIndex + 1];
  if (!pattern) {
    yield* terminal.display("Expected pattern after '-E'\n");
    return yield* Effect.die(1);
  }
  const patterns = yield* parsePattern(pattern);

  let oFlagIndex = args.indexOf("-o");
  
  const rFlagIndex = args.indexOf("-r");
  if (rFlagIndex !== -1) {
    const directories = args.filter((arg) => arg.endsWith("/"));
    for (const directory of directories) {
      const glob = new Glob(`${directory}**/*.txt`);
      for (const file of glob.scanSync()) {
        const foundMatch = yield* matchFile(file, patterns, { output: oFlagIndex !== -1, showFileName: true });
        if (foundMatch) {
          globalFoundMatch = true;
        }
      }
    }

    if (!globalFoundMatch) {
      return yield* Effect.fail(1);
    }

    return yield* Effect.succeed(0);
  }

  // if the last argument is a file, read the file
  // (just txt for now)
  const fileNames = args.filter((arg) => arg.endsWith(".txt"));
  if (fileNames.length > 0) {
    yield* Effect.forEach(fileNames, (fileName) => {
      return Effect.gen(function* () {
        const foundMatch = yield* matchFile(fileName, patterns, { output: oFlagIndex !== -1, showFileName: fileNames.length > 1 });
        if (foundMatch) {
          globalFoundMatch = true;
        }
      })
    });
  } else {
    yield* Stream.runForEach((inputLine: string) => {
      return Effect.gen(function* () {
        for (let i = 0; i < inputLine.length; i++) {
          const isMatch = yield* matchFrom(inputLine, i, patterns, 0);
          if (isMatch !== null) {
            globalFoundMatch = true;
            if (oFlagIndex !== -1) {
              yield* terminal.display(`${inputLine.substring(i, isMatch)}\n`)
              i = isMatch - 1;
            }
            else {
              yield* terminal.display(`${inputLine}\n`)
              return yield* Effect.succeed(0);
            }
          }
        }
      })
    })(inputStream)
  }


  if (!globalFoundMatch) {
    return yield* Effect.fail(1);
  }

  return yield* Effect.succeed(0);
})

export { program }