// The parsing algorithm used here is based off the Earley algorithm, implemented in https://nearley.js.org/
// We inlined the code and adapted to our use cases.

import moo from "moo";
import sendExtensionError from "../internal/sendExtensionError";
import type { InitialSchema } from "../internal/types";

const reject = Symbol("reject");
type InputData = (moo.Token | InitialSchema)[];
type Data = InputData | typeof reject | InitialSchema;
type Context = { flags: Set<string>; index: number };
type PreProcess = (
  ctx: Context,
  dot: number,
  rej: typeof reject
) => Context | undefined | typeof reject;
type PostProcess = (
  d: InputData,
  context: Context,
  rej: typeof reject
) => InitialSchema | typeof reject;

type RuleSymbol = string | { type: string };
type Rule = {
  name: string;
  symbols: RuleSymbol[];
  postprocess: PostProcess;
  preprocess?: PreProcess;
};

type State = {
  rule: Rule;
  dot: number;
  context: Context;
  data: Data;
  wantedBy: State[];
  isComplete?: boolean;
  left?: State;
  right?: State;
  source: string;
  id: number;
};

type Column = {
  index: number;
  states: State[];
  wants: Record<string, State[]>; // states indexed by the non-terminal they expect
  scannable: State[]; // list of states that expect a token
  completed: Record<string, State[]>; // states that are nullable
};

const newColumn = (index: number, wants: Column["wants"] = {}): Column => ({
  index,
  states: [],
  wants,
  scannable: [],
  completed: {},
});

const newContext = (index: number): Context => ({
  index,
  flags: new Set(),
});

let stateIdGen = 0;
const newState = ({
  rule,
  dot,
  context,
  wantedBy,
  source,
}: {
  rule: Rule;
  dot: number;
  context: Context;
  wantedBy: State[];
  source: string;
}): State => ({
  rule,
  dot,
  context,
  data: [],
  wantedBy,
  isComplete: dot === rule.symbols.length,
  source,
  id: stateIdGen++,
});

const START_RULE = "main";

const buildFromState = (state: State) => {
  const children: InputData = [];
  let node: State | undefined = state;
  do {
    if (Array.isArray(node.right!.data)) children.push(...node.right!.data);
    else children.push(node.right!.data as InitialSchema);
    node = node.left;
  } while (node?.left && node.right);
  children.reverse();
  return children;
};

const nextState = (
  state: State,
  child: State,
  source: string
): State | typeof reject => {
  const nextDot = state.dot + 1;
  const context = state.rule.preprocess?.(state.context, nextDot, reject) || {
    ...state.context,
  };
  if (context === reject) return reject;
  const next = newState({
    rule: state.rule,
    dot: nextDot,
    context,
    wantedBy: state.wantedBy,
    source: `next state from ${source} - ${state.id}`,
  });
  next.left = state;
  next.right = child;
  if (next.isComplete) {
    next.data = buildFromState(next);
  }
  return next;
};

const completeColumn = (col: Column, left: State, right: State) => {
  const copy = nextState(left, right, "completion");
  if (copy !== reject) col.states.push(copy);
};

const getExp = (s: State) => {
  return s.rule.symbols[s.dot];
};

const getSymbolDisplay = (symbol: RuleSymbol) => {
  if (typeof symbol === "string") return symbol;
  else return `%${symbol.type}`;
};

const ruleToString = (state: State) => {
  const symbolSequence =
    state.rule.symbols.slice(0, state.dot).map(getSymbolDisplay).join(" ") +
    " ● " +
    state.rule.symbols.slice(state.dot).map(getSymbolDisplay).join(" ");
  return `${state.rule.name} → ${symbolSequence}`;
};

const errorLogCharts = (table: Column[]) => {
  console.error(`Table length: ${table.length}\n`);
  table.forEach(function (column, index) {
    console.error(`\nChart: ${index}\n`);
    column.states.forEach(function (state) {
      console.error(
        `${state.id}: 
    rule: {${ruleToString(state)}}
    from: { index: ${state.context.index}, flags: ${Array.from(
          state.context.flags
        ).join(", ")} }
    source: ${state.source}
    data: ${JSON.stringify(state.data)}
`
      );
    });
  });
};

const displayToken = (token: moo.Token) =>
  `%${token.type}: ${JSON.stringify(token.value)}`;

const getError = (table: Column[], token: moo.Token) => {
  const tokenDisplay = displayToken(token);
  const lines: string[] = [];

  const lastColumnIndex = table.length - 2;
  const lastColumn = table[lastColumnIndex];
  const expectantStates = lastColumn.states.filter(function (state) {
    var nextSymbol = getExp(state);
    return nextSymbol && typeof nextSymbol !== "string";
  });

  const displayStateStack = function (stateStack: State[]) {
    stateStack.forEach((state) => {
      lines.push(`    ${ruleToString(state)}`);
    });
  };

  if (expectantStates.length === 0) {
    lines.push(
      "Unexpected " +
        tokenDisplay +
        ". I did not expect any more input. Here is the state of my parse table:\n"
    );
    displayStateStack(lastColumn.states);
  } else {
    lines.push(
      "Unexpected " +
        tokenDisplay +
        ". Instead, I was expecting to see one of the following:\n"
    );
    const buildFirstStateStack = (state: State, visited: State[]): State[] => {
      if (!state.wantedBy?.length) {
        return [state];
      }
      const prevState = state.wantedBy[0];
      const childVisited = [state].concat(visited);
      const childResult = buildFirstStateStack(prevState, childVisited);
      return [state].concat(childResult);
    };
    const stateStacks = expectantStates.map(function (state) {
      return buildFirstStateStack(state, []);
    });
    stateStacks.forEach(function (stateStack) {
      const state = stateStack[0];
      const nextSymbol = getExp(state);
      const symbolDisplay = getSymbolDisplay(nextSymbol);
      lines.push(`${symbolDisplay} based on:`);
      lines.push(
        `    [context]: { index: ${state.context.index}, flags: [${Array.from(
          state.context.flags
        ).join(", ")}]}`
      );
      displayStateStack(stateStack);
    });
  }
  lines.push("");
  return lines.join("\n");
};

export const NULL_TOKEN = String.fromCharCode(0);

export const createEmptyAtJson: PostProcess = () => ({
  content: "",
  annotations: [],
});
export const createTextAtJson: PostProcess = (data) => {
  const content = data.map((d) => ("text" in d ? d.text : d.content)).join("");
  return {
    content,
    annotations: [],
  };
};

export const combineAtJsons = (d: InputData) => {
  const [first, second] = d as [InitialSchema, InitialSchema];
  return {
    content: `${first.content}${second.content}`,
    annotations: first.annotations.concat(
      second.annotations.map((a) => ({
        ...a,
        start: a.start + first.content.length,
        end: a.end + first.content.length,
      }))
    ),
  };
};

export const head: PostProcess = (d) => d[0] as InitialSchema;

// https://github.com/spamscanner/url-regex-safe/blob/master/src/index.js
const protocol = `(?:https?://)`;
const host = "(?:(?:[a-z\\u00a1-\\uffff0-9][-_]*)*[a-z\\u00a1-\\uffff0-9]+)";
const domain = "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*";
const tld = `(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))`;
const port = "(?::\\d{2,5})?";
const path = "(?:[/?#][^\\s\"\\)']*)?";
export const URL_REGEX = new RegExp(
  `(?:${protocol}|www\\.)(?:${host}${domain}${tld})${port}${path}`
);

const atJsonParser = ({
  lexerRules,
  grammarRules,
}: {
  lexerRules: moo.Rules;
  grammarRules: Rule[];
}): ((s: string, opts?: { debug?: true }) => InitialSchema) => {
  const lexer = moo.compile(lexerRules);
  const grammarRulesByName: Record<string, Rule[]> = {};
  grammarRules.forEach((r) => {
    grammarRulesByName[r.name] = (grammarRulesByName[r.name] || []).concat(r);
  });
  if (!grammarRulesByName[START_RULE])
    throw new Error(`At least one rule named \`${START_RULE}\` is required`);
  const predict = (col: Column, ruleName: string, context: Context) => {
    const rules = grammarRulesByName[ruleName] || [];
    rules.forEach((rule) => {
      const wantedBy = col.wants[ruleName];
      const s = newState({
        rule,
        dot: 0,
        context: {
          ...context,
          index: col.index,
        },
        wantedBy,
        source: `predict - ${ruleName}`,
      });
      col.states.push(s);
    });
  };
  const processColumn = (col: Column) => {
    const { states, wants, completed } = col;
    for (var w = 0; w < states.length; w++) {
      // we push() during iteration
      const state = states[w];

      if (state.isComplete) {
        const output = state.rule.postprocess(
          state.data as InputData,
          state.context,
          reject
        );
        if (output !== reject) {
          state.data = output;
          state.wantedBy.forEach((s) => completeColumn(col, s, state));

          if (state.context.index === col.index) {
            const exp = state.rule.name;
            if (exp)
              (col.completed[exp] = col.completed[exp] || []).push(state);
          }
        }
      } else {
        const exp = getExp(state);
        if (typeof exp === "object") {
          col.scannable.push(state);
          continue;
        }

        if (wants[exp]) {
          wants[exp].push(state);
          (completed[exp] || []).forEach((right) =>
            completeColumn(col, state, right)
          );
        } else {
          wants[exp] = [state];
          predict(col, exp, state.context);
        }
      }
    }
  };
  return function parse(content, opts = {}) {
    const buffer = lexer.reset(content);
    stateIdGen = 0;
    const table = [newColumn(0, { [START_RULE]: [] })];
    predict(table[0], START_RULE, newContext(0));
    processColumn(table[0]);
    let current = 0;
    while (true) {
      const token = buffer.next();
      if (!token) break;
      const { scannable } = table[current];
      if (!opts.debug) delete table[current - 1];
      else console.log(current, "-", displayToken(token));

      const nextColumn = newColumn(current + 1);
      table.push(nextColumn);

      scannable.reverse().forEach((state) => {
        const expect = getExp(state);
        if (typeof expect === "object" && expect.type === token.type) {
          const next = nextState(
            state,
            {
              data: [token],
              context: { ...state.context, index: current },
              source: `scanned - ${state.id}`,
              id: stateIdGen++,
              rule: state.rule,
              dot: state.dot,
              wantedBy: [],
            },
            "scanning"
          );
          if (next !== reject) nextColumn.states.push(next);
        }
      });

      processColumn(nextColumn);

      if (nextColumn.states.length === 0) {
        if (process.env.NODE_ENV === "production") {
          sendExtensionError({
            type: "At JSON Parser encountered an unexpected token",
            data: {
              input: content,
            },
          });
        } else {
          errorLogCharts(table);
        }
        throw new Error(getError(table, token));
      }

      current++;
    }

    const results: InitialSchema[] = [];
    const column = table[table.length - 1];
    column.states.forEach(function (t) {
      if (
        t.rule &&
        t.rule.name === START_RULE &&
        t.dot === t.rule.symbols.length &&
        t.context.index === 0 &&
        t.data !== reject &&
        !Array.isArray(t.data)
      ) {
        results.push(t.data);
      }
    });
    if (results.length > 1) {
      if (process.env.NODE_ENV === "production") {
        sendExtensionError({
          type: "AtJson Parser returned multiple ambiguous results",
          data: {
            input: content,
            results,
          },
        });
      } else {
        results.forEach((r) => {
          console.error("RESULT");
          console.error(JSON.stringify(r));
          console.error("");
        });
        errorLogCharts(table);
        throw new Error(
          `AtJson Parser returned multiple ambiguous results (${results.length})`
        );
      }
    }
    if (results.length === 0) {
      if (process.env.NODE_ENV === "production") {
        sendExtensionError({
          type: "At JSON Parser returned no results",
          data: {
            input: content,
          },
        });
      } else {
        errorLogCharts(table);
      }
      // What's better then throwing an error? The below is not guaranteed to return a valid enough state
      // const lastColumnStateData =
      //   (table[table.length - 1]?.states.find((s) => s.context.index === 0)
      //     ?.data as InitialSchema) || createTextAtJson(content);
      // results.push(lastColumnStateData);
      throw new Error("AtJson Parser returned no results");
    }
    const [data] = results;

    return data;
  };
};

export default atJsonParser;
