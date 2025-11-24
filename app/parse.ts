import { Effect, String } from "effect";
import { takeWhile } from "effect/Array";
import type { Pattern } from "./types";

export const parsePattern  = (pattern: string) => Effect.gen(function* () {
  const patternChars = String.split('')(pattern);
  const patterns: Pattern[] = [];

  while (patternChars.length > 0) {
    if (patternChars[0] === "^") {
      patterns.push({ _tag: "start" });
      patternChars.shift();
    } else if (patternChars[0] === "$") {
      patterns.push({ _tag: "end" });
      patternChars.shift();
    } else if (patternChars[0] === ".") {
      patterns.push({ _tag: "wildcard" });
      patternChars.shift();
    } else if (patternChars[0] === "\\") {
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
    } else if (patternChars[0] === "(") {
      patternChars.shift();
      const alternatesRaw = takeWhile(patternChars, (char) => char !== ")").join("");
      const alternates = alternatesRaw.split("|").map(alternate => Effect.runSync(parsePattern(alternate)));
      patterns.push({ _tag: "alternation", patterns: alternates });
      patternChars.splice(0, alternatesRaw.length + 1);
    } else if (patternChars[0] === "?") {
      patterns[patterns.length - 1].quantifier = { _tag: "zero-or-one" };
      patternChars.shift();
    } else if (patternChars[0] === "*") {
      patterns[patterns.length - 1].quantifier = { _tag: "zero-or-more" };
      patternChars.shift();
    } else if (patternChars[0] === "+") {
      patterns[patterns.length - 1].quantifier = { _tag: "one-or-more" };
      patternChars.shift();
    } else if (patternChars[0] === "{") {
      patternChars.shift();
      const n = takeWhile(patternChars, (char) => char !== "}").join("");
      patterns[patterns.length - 1].quantifier = { _tag: "n-times", n: parseInt(n) };
      patternChars.splice(0, n.length + 1);
    } else {
      // Assume anything else is a literal
      patterns.push({ _tag: "literal", value: patternChars[0] });
      patternChars.shift();
    }
  }
  return yield * Effect.succeed(patterns);
});