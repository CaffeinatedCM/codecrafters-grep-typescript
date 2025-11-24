import { Effect, Match, String } from "effect";
import type { Pattern, Quantifier } from "./types";

export const matchAtom = (pattern: Pattern, char: string) => Effect.gen(function* () {
  if (char?.length !== 1) {
    return false;
  }

  return Match.type<Pattern>().pipe(
    Match.withReturnType<boolean>(),
    Match.tag("literal", (p) => {
      return char === p.value;
    }),
    Match.tag("digit", () => {
      return char >= "0" && char <= "9";
    }),
    Match.tag("word", () => {
      return char >= "0" && char <= "9" || (char >= "A" && char <= "Z") || (char >= "a" && char <= "z") || char === "_";
    }),
    Match.tag("character-class", (p) => {
      const patternChars = String.split('')(p.value);
      const isNegated = p.negated;
      if (isNegated) {
        return !patternChars.includes(char);
      }
      return patternChars.includes(char);
    }),
    Match.tag("wildcard", () => {
      return char !== "\n";
    }),
    Match.orElse(() => {
      return false;
    }),
  )(pattern);
});

export const matchOneInstance = (input: string, index: number, pattern: Pattern): Effect.Effect<number | null, Error> => Effect.gen(function* () {
  if (pattern._tag === "alternation") {
    for (const alternate of pattern.patterns) {
      const end = yield* matchFrom(input, index, alternate, 0);
      if (end !== null) {
        return end;
      }
    }
    return null;
  } else {
    const match = yield* matchAtom(pattern, input[index]);
    if (!match) {
      return null;
    }
    return index + 1;
  }
})

export const matchFrom = (input: string, index: number, patterns: Pattern[], patternIndex: number): Effect.Effect<number | null, Error> => Effect.gen(function* () {
  if (patternIndex >= patterns.length) {
    return index;
  }

  const pattern = patterns[patternIndex];

  if (pattern._tag === "start") {
    if (index !== 0) {
      return null;
    }
    return yield* matchFrom(input, index, patterns, patternIndex + 1);
  }
  if (pattern._tag === "end") {
    if (index !== input.length) {
      return null;
    }
    return yield* matchFrom(input, index, patterns, patternIndex + 1);
  }

  const quantifier = pattern.quantifier;

  if (!quantifier) {
    if (index >= input.length) {
      return null;
    }
    const match = yield* matchOneInstance(input, index, pattern);
    if (match === null) {
      return null;
    }
    const rest = yield* matchFrom(input, match, patterns, patternIndex + 1);
    return rest === null ? null : rest;
  }

  let match = yield* matchOneInstance(input, index, pattern);
  const matchEnds: number[] = [];
  while (match !== null && match <= input.length) {
    matchEnds.push(match);
    match = yield* matchOneInstance(input, match, pattern);
  }

  return Match.type<Quantifier>().pipe(
    Match.withReturnType<number | null>(),
    Match.tag("one-or-more", () => {
      if (matchEnds.length === 0) {
        return null;
      }

      for (let i = matchEnds.length - 1; i >= 0; i--) {
        console.log(matchEnds[i] + 1, patternIndex + 1);
        const match = Effect.runSync(matchFrom(input, matchEnds[i], patterns, patternIndex + 1));
        console.log("match", match);
        if (match !== null) {
          return match;
        }
      }
      return null;
    }),
    Match.tag("zero-or-one", () => {
      const match1 = Effect.runSync(matchFrom(input, index + 1, patterns, patternIndex + 1));
      if (matchEnds.length >0 && match1) {
        return index + 1;
      }
      return Effect.runSync(matchFrom(input, index, patterns, patternIndex + 1));
    }),
    Match.tag("zero-or-more", () => {
      console.log("matchEnds", matchEnds);
      if (matchEnds.length === 0) {
        return Effect.runSync(matchFrom(input, index, patterns, patternIndex + 1));
      }

      for (let i = matchEnds.length - 1; i >= 0; i--) {
        const match = Effect.runSync(matchFrom(input, matchEnds[i], patterns, patternIndex + 1));
        if (match) {
          return match;
        }
      }
      return null;
    }),
    Match.tag("n-times", (q) => {
      if (matchEnds.length < q.n) {
        return null;
      }

      // Start at the end of the n-th match
      return Effect.runSync(matchFrom(input, matchEnds[q.n - 1], patterns, patternIndex + 1));
    }),
    Match.tag("at-least-n-times", (q) => {
      if (matchEnds.length < q.n) {
        return null;
      }

      for (let i = matchEnds.length - 1; i >= q.n - 1; i--) {
        const match = Effect.runSync(matchFrom(input, matchEnds[i], patterns, patternIndex + 1));
        if (match !== null) {
          return match;
        }
      }
      return null;
    }),
    Match.tag("between-n-and-m-times", (q) => {
      if (matchEnds.length < q.n) {
        return null;
      }

      // start at the end of the m-th match and go until the end of the n-th match
      let startIdx = matchEnds.length < q.m ? matchEnds.length - 1 : q.m - 1;
      for (let i = startIdx; i >= q.n - 1; i--) {
        const match = Effect.runSync(matchFrom(input, matchEnds[i], patterns, patternIndex + 1));
        if (match !== null) {
          return match;
        }
      }
      return null;
    }),
    Match.orElse(() => {
      throw new Error("Invalid quantifier");
    }),
  )(quantifier);
})