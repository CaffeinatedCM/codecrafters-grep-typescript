export type Quantifier =
  | { readonly _tag: "one-or-more" }
  | { readonly _tag: "zero-or-one" }
  | { readonly _tag: "zero-or-more" }
  | { readonly _tag: "n-times"; readonly n: number }

export type Pattern = 
  | { readonly _tag: "start"; quantifier?: Quantifier }
  | { readonly _tag: "literal"; readonly value: string; quantifier?: Quantifier }
  | { readonly _tag: "digit"; quantifier?: Quantifier }
  | { readonly _tag: "word"; quantifier?: Quantifier }
  | { readonly _tag: "character-class"; readonly value: string; readonly negated: boolean; quantifier?: Quantifier }
  | { readonly _tag: "wildcard"; quantifier?: Quantifier }
  | { readonly _tag :"alternation"; readonly patterns: Pattern[][], quantifier?: Quantifier }
  | { readonly _tag: "end"; quantifier?: Quantifier }
