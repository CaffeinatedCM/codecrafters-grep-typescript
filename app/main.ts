import { Effect, Match, String, pipe} from 'effect';
import { Terminal } from '@effect/platform';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { takeWhile } from 'effect/Array';

const args = process.argv;
const pattern = args[3];

const matchPattern = (inputLine: string, pattern: Pattern) => Effect.gen(function* () {
  const chars = String.split('')(inputLine);
  const charCodes = chars.map(char => char.charCodeAt(0));

  return Match.type<Pattern>().pipe(
    Match.withReturnType<number>(),
    Match.tag("literal", (pattern) => {
      return chars.findIndex(char => char === pattern.value);
    }),
    Match.tag("digit", () => {
      return charCodes.findIndex(code => code >= 0x30 && code <= 0x39);
    }),
    Match.tag("word", () => {
      return charCodes.findIndex(code => (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A) || code === 0x5F);
    }),
    Match.tag("character-class", (pattern) => {
      const patternChars = String.split('')(pattern.value);
      const isNegated = pattern.negated;
      if (isNegated) {
        return chars.findIndex(char => !patternChars.includes(char));
      }

      return chars.findIndex(char => patternChars.includes(char));
    }),
    Match.orElse(() => {
      return -1;
    }),
  )(pattern);
})

const matchPatterns = (inputLine: string, patterns: Pattern[]) => Effect.gen(function* () {
  let curString = inputLine;
  let patternIndex = 0;
  while (patternIndex < patterns.length) {
    const pattern = patterns[patternIndex];
    const matchIndex = yield* matchPattern(curString, pattern);
    if (matchIndex === -1) {
      return yield * Effect.succeed(false);
    }
    curString = curString.slice(matchIndex + 1);
    patternIndex++;
  }
  if (patternIndex !== patterns.length) {
    return yield * Effect.succeed(false);
  }
  return yield * Effect.succeed(true);
});

type Pattern = 
  | { readonly _tag: "literal"; readonly value: string }
  | { readonly _tag: "digit" }
  | { readonly _tag: "word" }
  | { readonly _tag: "character-class"; readonly value: string; readonly negated: boolean }


const parsePattern  = (pattern: string) => Effect.gen(function* () {
  const patternChars = String.split('')(pattern);
  const patterns: Pattern[] = [];

  while (patternChars.length > 0) {
    if (patternChars[0] === "\\") {
      const nextChar = patternChars[1];
      if (nextChar === "d" ) {
        patterns.push({ _tag: "digit" });
        patternChars.shift();
        patternChars.shift();
      } else if (nextChar === "w" ) {
        patterns.push({ _tag: "word" });
        patternChars.shift();
        patternChars.shift();
      } else {
        patterns.push({ _tag: "literal", value: patternChars[0] });
        patternChars.shift();
      } 
    } else if (patternChars[0] === "[") {
      const characterClass = takeWhile(patternChars, (char) => char !== "]");
      characterClass.shift();
      let isNegated = false;
      if (characterClass[0] === "^") {
        isNegated = true;
        characterClass.shift();
      }
      patterns.push({ _tag: "character-class", value: characterClass.join(""), negated: isNegated });
      patternChars.splice(0, characterClass.length + 2 + (isNegated ? 1 : 0));
    } else {
      // Assume anything else is a literal
      patterns.push({ _tag: "literal", value: patternChars[0] });
      patternChars.shift();
    }
  }
  return yield * Effect.succeed(patterns);
});

if (args[2] !== "-E") {
  console.log("Expected first argument to be '-E'");
  process.exit(1);
}

// You can use print statements as follows for debugging, they'll be visible when running tests.

const program = Effect.gen(function* () {
 const terminal = yield* Terminal.Terminal;
 const inputLine = yield* terminal.readLine;
 const patterns = yield* parsePattern(pattern);
 const isMatch = yield* matchPatterns(inputLine, patterns);
 if (isMatch) {
  return yield * Effect.succeed(0);
 } else {
  return yield * Effect.fail(1);
 }
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)));