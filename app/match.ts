import { Effect, Match, String } from "effect";
import type { Pattern, Quantifier } from "./types";

export const matchAtom = (pattern: Pattern, char: string) => Effect.gen(function* () {
  if (char?.length !== 1) {
    return false;
  }

  return yield* Match.type<Pattern>().pipe(
    Match.withReturnType<Effect.Effect<boolean, never, never>>(),
    Match.tag("literal", (p) => {
      return Effect.succeed(char === p.value);
    }),
    Match.tag("digit", () => {
      return Effect.succeed(char >= "0" && char <= "9");
    }),
    Match.tag("word", () => {
      return Effect.succeed(char >= "0" && char <= "9" || (char >= "A" && char <= "Z") || (char >= "a" && char <= "z") || char === "_");
    }),
    Match.tag("character-class", (p) => {
      const patternChars = String.split('')(p.value);
      const isNegated = p.negated;
      if (isNegated) {
        return Effect.succeed(!patternChars.includes(char));
      }
      return Effect.succeed(patternChars.includes(char));
    }),
    Match.tag("wildcard", () => {
      return Effect.succeed(char !== "\n");
    }),
    Match.orElse(() => {
      return Effect.succeed(false);
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

  return yield* (Match.type<Quantifier>().pipe(
    Match.withReturnType<Effect.Effect<number | null, Error,never>>(),
    Match.tag("one-or-more", () => {
      if (matchEnds.length === 0) {
        return Effect.succeed(null);
      }

      for (let i = matchEnds.length - 1; i >= 0; i--) {
        const match = Effect.runSync(matchFrom(input, matchEnds[i], patterns, patternIndex + 1));
        if (match !== null) {
          return Effect.succeed(match);
        }
      }
      return Effect.succeed(null);
    }),
    Match.tag("zero-or-one", () => {
      const match1 = Effect.runSync(matchFrom(input, index + 1, patterns, patternIndex + 1));
      if (matchEnds.length >0 && match1) {
        return Effect.succeed(match1);
      }
      return matchFrom(input, index, patterns, patternIndex + 1);
    }),
    Match.tag("zero-or-more", () => {
      if (matchEnds.length === 0) {
        return matchFrom(input, index, patterns, patternIndex + 1);
      }

      for (let i = matchEnds.length - 1; i >= 0; i--) {
        const match = Effect.runSync(matchFrom(input, matchEnds[i], patterns, patternIndex + 1));
        if (match) {
          return Effect.succeed(match);
        }
      }
      return Effect.succeed(null);
    }),
    Match.tag("n-times", (q) => {
      if (matchEnds.length < q.n) {
        return Effect.succeed(null);
      }

      // Start at the end of the n-th match
      return matchFrom(input, matchEnds[q.n - 1], patterns, patternIndex + 1);
    }),
    Match.tag("at-least-n-times", (q) => {
      if (matchEnds.length < q.n) {
        return Effect.succeed(null);
      }

      for (let i = matchEnds.length - 1; i >= q.n - 1; i--) {
        const match = Effect.runSync(matchFrom(input, matchEnds[i], patterns, patternIndex + 1));
        if (match !== null) {
          return Effect.succeed(match);
        }
      }
      return Effect.succeed(null);
    }),
    Match.tag("between-n-and-m-times", (q) => {
      if (matchEnds.length < q.n) {
        return Effect.succeed(null);
      }

      // start at the end of the m-th match and go until the end of the n-th match
      let startIdx = matchEnds.length < q.m ? matchEnds.length - 1 : q.m - 1;
      for (let i = startIdx; i >= q.n - 1; i--) {
        const match = Effect.runSync(matchFrom(input, matchEnds[i], patterns, patternIndex + 1));
        if (match !== null) {
          return Effect.succeed(match);
        }
      }
      return Effect.succeed(null);
    }),
    Match.orElse(() => {
      return Effect.fail(new Error("Invalid quantifier"));
    }),
  )(quantifier));
})