/**
 * The JavaScript course's runtime: a reader's program runs in a Web Worker in their own
 * browser, and what it prints has to read exactly as it does under `node`.
 *
 * Every expected output in the course is pasted from a real `node` run, so the one thing
 * this must get right is formatting. A browser's own console prints `[1, 2]` where Node
 * prints `[ 1, 2 ]`, and it has no idea Node groups a long array into columns — so the
 * worker carries its own `console`, with `formatValue` below ported from Node's
 * `util.inspect` (lib/internal/util/inspect.js) for the values a lesson prints: primitives,
 * arrays, plain objects, class instances, Map, Set, Date, RegExp, functions, errors,
 * circular references. `javascript-runtime.test.ts` holds it to the real `util.inspect`.
 *
 * What it cannot reproduce, and so what a runnable lesson must not print: the state of a
 * Promise (`Promise { 1 }` — nothing in the language can read it), an Error's stack (Node's
 * names the file on disk), and anything from Node's own modules (`require` does not exist
 * here). The content integrity test runs every runnable sample through this source and
 * compares it with its pasted output, so a sample that breaks one of these rules fails
 * there rather than in front of a reader.
 *
 * It is a string, like the Python worker's, so the browser can start it from a Blob URL
 * without depending on how Next bundles workers, and so a test can evaluate exactly the
 * code that ships.
 *
 * A program counts as finished once it has run and no timer it set is still pending —
 * the same point at which `node` would exit. Output is streamed line by line, so a run
 * stopped at the deadline still shows what it printed before it was stopped.
 *
 * Timers run on a virtual clock: they fire in deadline order, one per real macrotask with
 * every microtask drained in between, without actually waiting. That is the order an
 * unloaded `node` keeps, and unlike a real clock it cannot be reordered by a busy machine,
 * so a lesson's output is the same on every run. `Date.now()` does not advance with it.
 */
export const JAVASCRIPT_WORKER_SOURCE = String.raw`
"use strict";
const BREAK_LENGTH = 80;
const MAX_DEPTH = 2;
const MAX_ARRAY_LENGTH = 100;
const toTag = (v) => Object.prototype.toString.call(v).slice(8, -1);
const IDENTIFIER = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
const ESCAPES = { "\b": "\\b", "\t": "\\t", "\n": "\\n", "\f": "\\f", "\r": "\\r", "\\": "\\\\" };

function quote(str) {
  let q = "'";
  if (str.includes("'")) {
    if (!str.includes('"')) q = '"';
    else if (!str.includes("\x60") && !str.includes("\${")) q = "\x60";
  }
  let out = "";
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (ch === q) out += "\\" + ch;
    else if (ESCAPES[ch]) out += ESCAPES[ch];
    else if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) out += "\\x" + code.toString(16).toUpperCase().padStart(2, "0");
    else out += ch;
  }
  return q + out + q;
}

function formatKey(key) {
  if (typeof key === "symbol") return key.toString();
  return IDENTIFIER.test(key) ? key : quote(key);
}

function functionBase(fn) {
  const source = Function.prototype.toString.call(fn);
  if (source.startsWith("class") && /^class\b/.test(source)) {
    let base = "[class " + (fn.name || "(anonymous)");
    const parent = Object.getPrototypeOf(fn);
    if (parent && parent.name) base += " extends " + parent.name;
    return base + "]";
  }
  const tag = toTag(fn);
  const kind = tag === "AsyncFunction" || tag === "GeneratorFunction" || tag === "AsyncGeneratorFunction" ? tag : "Function";
  return "[" + kind + (fn.name ? ": " + fn.name : " (anonymous)") + "]";
}

function constructorName(value) {
  let proto = Object.getPrototypeOf(value);
  if (proto === null) return null;
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, "constructor");
    if (desc && typeof desc.value === "function" && desc.value.name) return desc.value.name;
    proto = Object.getPrototypeOf(proto);
  }
  return "Object";
}

function isBelowBreakLength(ctx, output, start, base) {
  let total = output.length + start;
  if (total + output.length > BREAK_LENGTH) return false;
  for (const entry of output) {
    total += entry.length;
    if (total > BREAK_LENGTH) return false;
  }
  return base === "" || !base.includes("\n");
}

function groupArrayElements(ctx, output, value) {
  let totalLength = 0;
  let maxLength = 0;
  let outputLength = output.length;
  if (value && value.length > MAX_ARRAY_LENGTH) outputLength--;
  const separatorSpace = 2;
  const dataLen = new Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const len = output[i].length;
    dataLen[i] = len;
    totalLength += len + separatorSpace;
    if (maxLength < len) maxLength = len;
  }
  const actualMax = maxLength + separatorSpace;
  if (actualMax * 3 + ctx.indentationLvl < BREAK_LENGTH && (totalLength / actualMax > 5 || maxLength <= 6)) {
    const averageBias = Math.sqrt(actualMax - totalLength / output.length);
    const biasedMax = Math.max(actualMax - 3 - averageBias, 1);
    const columns = Math.min(
      Math.round(Math.sqrt(2.5 * biasedMax * outputLength) / biasedMax),
      Math.floor((BREAK_LENGTH - ctx.indentationLvl) / actualMax),
      3 * 4,
      15,
    );
    if (columns <= 1) return output;
    const tmp = [];
    const maxLineLength = [];
    for (let i = 0; i < columns; i++) {
      let lineLength = 0;
      for (let j = i; j < output.length; j += columns) if (dataLen[j] > lineLength) lineLength = dataLen[j];
      maxLineLength.push(lineLength + separatorSpace);
    }
    let padStart = true;
    if (value !== undefined) {
      for (let i = 0; i < output.length; i++) {
        if (typeof value[i] !== "number" && typeof value[i] !== "bigint") {
          padStart = false;
          break;
        }
      }
    }
    for (let i = 0; i < outputLength; i += columns) {
      const max = Math.min(i + columns, outputLength);
      let str = "";
      let j = i;
      for (; j < max - 1; j++) {
        const cell = output[j] + ", ";
        str += padStart ? cell.padStart(maxLineLength[j - i], " ") : cell.padEnd(maxLineLength[j - i], " ");
      }
      str += padStart ? output[j].padStart(maxLineLength[j - i] - separatorSpace, " ") : output[j];
      tmp.push(str);
    }
    if (value && value.length > MAX_ARRAY_LENGTH) tmp.push(output[outputLength]);
    output = tmp;
  }
  return output;
}

function reduceToSingleString(ctx, output, base, braces, isArray, recurseTimes, value) {
  const entries = output.length;
  if (isArray && entries > 6) output = groupArrayElements(ctx, output, value);
  if (ctx.currentDepth - recurseTimes < 3 && entries === output.length) {
    const start = output.length + ctx.indentationLvl + braces[0].length + base.length + 10;
    if (isBelowBreakLength(ctx, output, start, base)) {
      const joined = output.join(", ");
      if (!joined.includes("\n")) return (base ? base + " " : "") + braces[0] + " " + joined + " " + braces[1];
    }
  }
  const indentation = "\n" + " ".repeat(ctx.indentationLvl);
  return (base ? base + " " : "") + braces[0] + indentation + "  " + output.join("," + indentation + "  ") + indentation + braces[1];
}

function formatPrimitive(value, nested) {
  switch (typeof value) {
    case "string": return nested ? quote(value) : value;
    case "number": return Object.is(value, -0) ? "-0" : String(value);
    case "bigint": return String(value) + "n";
    case "symbol": return value.toString();
    default: return String(value);
  }
}

function formatProperty(ctx, value, recurseTimes, key) {
  const desc = Object.getOwnPropertyDescriptor(value, key);
  let str;
  if (desc.get || desc.set) {
    str = desc.get && desc.set ? "[Getter/Setter]" : desc.get ? "[Getter]" : "[Setter]";
  } else {
    ctx.indentationLvl += 2;
    str = formatValue(ctx, desc.value, recurseTimes, true);
    ctx.indentationLvl -= 2;
  }
  return formatKey(key) + ": " + str;
}

function ownKeys(value, skipIndices) {
  const keys = Object.keys(value).filter((k) => !(skipIndices && /^(0|[1-9][0-9]*)$/.test(k)));
  for (const sym of Object.getOwnPropertySymbols(value)) {
    if (Object.prototype.propertyIsEnumerable.call(value, sym)) keys.push(sym);
  }
  return keys;
}

function formatValue(ctx, value, recurseTimes, nested) {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return formatPrimitive(value, nested);
  }
  const seenAt = ctx.seen.indexOf(value);
  if (seenAt !== -1) {
    if (!ctx.circular.has(value)) ctx.circular.set(value, ctx.circular.size + 1);
    return "[Circular *" + ctx.circular.get(value) + "]";
  }
  return formatRaw(ctx, value, recurseTimes);
}

function formatRaw(ctx, value, recurseTimes) {
  const tag = toTag(value);
  const name = constructorName(value);
  const isArray = Array.isArray(value);
  const keys = ownKeys(value, isArray);
  let braces;
  let base = "";
  let entries = [];
  let formatter = null;
  let arrayLike = false;

  if (isArray) {
    const prefix = name !== "Array" ? (name === null ? "[Array(" + value.length + "): null prototype] " : name + "(" + value.length + ") ") : "";
    if (value.length === 0 && keys.length === 0) return prefix + "[]";
    braces = [prefix + "[", "]"];
    arrayLike = true;
    formatter = () => {
      const out = [];
      const shown = Math.min(value.length, MAX_ARRAY_LENGTH);
      let holes = 0;
      for (let i = 0; i < shown; i++) {
        if (!Object.prototype.hasOwnProperty.call(value, i)) {
          holes++;
          continue;
        }
        if (holes > 0) {
          out.push("<" + holes + " empty item" + (holes > 1 ? "s" : "") + ">");
          holes = 0;
        }
        ctx.indentationLvl += 2;
        out.push(formatValue(ctx, value[i], recurseTimes, true));
        ctx.indentationLvl -= 2;
      }
      if (holes > 0) out.push("<" + holes + " empty item" + (holes > 1 ? "s" : "") + ">");
      if (value.length > MAX_ARRAY_LENGTH) {
        const rest = value.length - MAX_ARRAY_LENGTH;
        out.push("... " + rest + " more item" + (rest > 1 ? "s" : ""));
      }
      return out;
    };
  } else if (tag === "Map") {
    const prefix = (name || "[Map: null prototype]") + "(" + value.size + ") ";
    if (value.size === 0 && keys.length === 0) return prefix + "{}";
    braces = [prefix + "{", "}"];
    formatter = () => {
      const out = [];
      ctx.indentationLvl += 2;
      for (const [k, v] of value) out.push(formatValue(ctx, k, recurseTimes, true) + " => " + formatValue(ctx, v, recurseTimes, true));
      ctx.indentationLvl -= 2;
      return out;
    };
  } else if (tag === "Set") {
    const prefix = (name || "[Set: null prototype]") + "(" + value.size + ") ";
    if (value.size === 0 && keys.length === 0) return prefix + "{}";
    braces = [prefix + "{", "}"];
    formatter = () => {
      const out = [];
      ctx.indentationLvl += 2;
      for (const v of value) out.push(formatValue(ctx, v, recurseTimes, true));
      ctx.indentationLvl -= 2;
      return out;
    };
  } else if (typeof value === "function") {
    base = functionBase(value);
    if (keys.length === 0) return base;
    braces = ["{", "}"];
  } else if (tag === "Date") {
    base = Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
    if (keys.length === 0) return base;
    braces = ["{", "}"];
  } else if (tag === "RegExp") {
    base = RegExp.prototype.toString.call(value);
    if (keys.length === 0) return base;
    braces = ["{", "}"];
  } else if (tag === "Error" || value instanceof Error) {
    // Node prints the stack, which names a file on disk. Name and message are what a
    // lesson can promise; a sample that needs more prints err.message itself.
    const errName = value.name || "Error";
    base = value.message ? errName + ": " + value.message : errName;
    const shownKeys = keys.filter((k) => k !== "name" && k !== "message" && k !== "stack");
    if (shownKeys.length === 0) return base;
    keys.length = 0;
    keys.push(...shownKeys);
    braces = ["{", "}"];
  } else if (tag === "Promise") {
    return "Promise { <unknown> }";
  } else if (tag === "WeakMap" || tag === "WeakSet") {
    return tag + " { <items unknown> }";
  } else if (tag === "Arguments") {
    braces = ["[Arguments] [", "]"];
    arrayLike = true;
    if (value.length === 0) return "[Arguments] []";
    formatter = () => Array.from(value, (v) => {
      ctx.indentationLvl += 2;
      const s = formatValue(ctx, v, recurseTimes, true);
      ctx.indentationLvl -= 2;
      return s;
    });
    keys.length = 0;
  } else if (tag === "Number" || tag === "String" || tag === "Boolean") {
    const inner = formatPrimitive(value.valueOf(), true);
    base = "[" + tag + ": " + inner + "]";
    const shownKeys = tag === "String" ? keys.filter((k) => !/^(0|[1-9][0-9]*)$/.test(k)) : keys;
    if (shownKeys.length === 0) return base;
    braces = ["{", "}"];
  } else {
    const prefix = name === null ? "[Object: null prototype] " : name !== "Object" ? name + " " : "";
    if (keys.length === 0) return prefix + "{}";
    braces = [prefix + "{", "}"];
  }

  if (recurseTimes > MAX_DEPTH) {
    return "[" + (isArray ? "Array" : name || "Object") + "]";
  }

  recurseTimes++;
  ctx.seen.push(value);
  ctx.currentDepth = recurseTimes;
  if (formatter) entries = formatter();
  for (const key of keys) entries.push(formatProperty(ctx, value, recurseTimes, key));
  ctx.seen.pop();

  let res = reduceToSingleString(ctx, entries, base, braces, arrayLike, recurseTimes, isArray ? value : undefined);
  if (ctx.circular.has(value)) res = "<ref *" + ctx.circular.get(value) + "> " + res;
  return res;
}

function inspect(value) {
  return formatValue({ seen: [], circular: new Map(), indentationLvl: 0, currentDepth: 0 }, value, 0, false);
}

function format(args) {
  if (args.length === 0) return "";
  let first = args[0];
  let rest = 1;
  let out = "";
  if (typeof first === "string" && args.length > 1 && first.includes("%")) {
    let last = 0;
    for (let i = 0; i < first.length - 1; i++) {
      if (first[i] !== "%") continue;
      const spec = first[i + 1];
      let piece = null;
      if (spec === "%") { out += first.slice(last, i) + "%"; last = i + 2; i++; continue; }
      if (rest >= args.length) continue;
      const arg = args[rest];
      if (spec === "s") piece = typeof arg === "string" ? arg : typeof arg === "bigint" ? arg + "n" : typeof arg === "object" && arg !== null ? inspect(arg) : String(arg);
      else if (spec === "d") piece = typeof arg === "bigint" ? arg + "n" : formatPrimitive(Number(arg), false);
      else if (spec === "i") piece = typeof arg === "bigint" ? arg + "n" : String(parseInt(arg));
      else if (spec === "f") piece = String(parseFloat(arg));
      else if (spec === "j") piece = JSON.stringify(arg);
      else if (spec === "o" || spec === "O") piece = inspect(arg);
      else if (spec === "c") piece = "";
      if (piece === null) continue;
      out += first.slice(last, i) + piece;
      last = i + 2;
      i++;
      rest++;
    }
    out += first.slice(last);
  } else {
    out = typeof first === "string" ? first : inspect(first);
  }
  for (let i = rest; i < args.length; i++) out += " " + (typeof args[i] === "string" ? args[i] : inspect(args[i]));
  return out;
}

const realSetTimeout = self.setTimeout.bind(self);
// Timers run on a virtual clock (see the note at the top of this file); these bound a
// program whose timers never stop, which on a virtual clock would otherwise spin for ever.
const MAX_TIMER_CALLBACKS = 10000;
const MAX_VIRTUAL_MS = 10 * 60 * 1000;

self.onmessage = (event) => {
  const { id, source } = event.data;
  const timers = new Map();
  let now = 0;
  let seq = 0;
  let nextHandle = 1;
  let fired = 0;
  let stepping = false;
  let finished = false;

  const write = (stream, args) => {
    if (finished) return;
    self.postMessage({ id, type: "line", stream, text: format(args) });
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    self.postMessage({ id, type: "done" });
  };
  const crash = (error) => {
    const message = error instanceof Error ? (error.name || "Error") + ": " + error.message : "Uncaught " + inspect(error);
    write("stderr", [error instanceof Error ? "Uncaught " + message : message]);
    finish();
  };
  // One timer per real macrotask, so every microtask a callback queues has run before the
  // next timer fires — the order node keeps.
  const step = () => {
    stepping = false;
    if (finished) return;
    let next = null;
    for (const timer of timers.values()) {
      if (!next || timer.at < next.at || (timer.at === next.at && timer.seq < next.seq)) next = timer;
    }
    if (!next) {
      finish();
      return;
    }
    if (++fired > MAX_TIMER_CALLBACKS || next.at > MAX_VIRTUAL_MS) {
      write("stderr", ["Stopped: a timer keeps firing — most likely a setInterval that is never cleared."]);
      finish();
      return;
    }
    now = next.at;
    if (!next.interval) timers.delete(next.handle);
    guarded(next.fn, next.args);
    // Node re-arms an interval after its callback, behind any timer the callback set.
    if (next.interval && timers.has(next.handle)) {
      next.at = now + next.ms;
      next.seq = ++seq;
    }
    settleSoon();
  };
  const settleSoon = () => {
    if (stepping || finished) return;
    stepping = true;
    realSetTimeout(step, 0);
  };
  const addTimer = (fn, ms, args, interval) => {
    // Node's rule: anything that is not a delay from 1 to 2^31-1 ms becomes 1 ms.
    let delay = Number(ms);
    if (!(delay >= 1 && delay <= 2147483647)) delay = 1;
    const handle = nextHandle++;
    timers.set(handle, { handle, fn, args, ms: delay, at: now + delay, seq: ++seq, interval });
    return handle;
  };
  const guarded = (fn, args) => {
    try {
      if (typeof fn === "function") fn(...args);
    } catch (error) {
      crash(error);
    }
  };

  const console = {
    log: (...a) => write("stdout", a),
    info: (...a) => write("stdout", a),
    debug: (...a) => write("stdout", a),
    dir: (v) => write("stdout", [inspect(v)]),
    warn: (...a) => write("stderr", a),
    error: (...a) => write("stderr", a),
    trace: (...a) => write("stderr", ["Trace: " + format(a)]),
  };
  const setTimeout = (fn, ms, ...args) => addTimer(fn, ms, args, false);
  const setInterval = (fn, ms, ...args) => addTimer(fn, ms, args, true);
  const clearTimeout = (handle) => {
    timers.delete(handle);
  };
  const clearInterval = clearTimeout;
  // Ahead of any timer of 1 ms or more, as it is when node is already inside the loop.
  // (From the top of a script node itself leaves that order to chance; lessons avoid it.)
  const setImmediate = (fn, ...args) => {
    const handle = nextHandle++;
    timers.set(handle, { handle, fn, args, ms: 0, at: now, seq: ++seq, interval: false });
    return handle;
  };

  if (typeof self.addEventListener === "function") {
    self.addEventListener("unhandledrejection", (e) => {
      e.preventDefault();
      crash(e.reason);
    });
  }

  try {
    const program = new Function(
      "console", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate",
      source,
    );
    program(console, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearTimeout);
  } catch (error) {
    crash(error);
    return;
  }
  settleSoon();
};
`;
