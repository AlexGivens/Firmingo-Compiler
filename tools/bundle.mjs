import { readFileSync } from "node:fs";
import { resolve, dirname, relative, sep } from "node:path";
import { Script } from "node:vm";

/** Bounded static-module packaging only; unsupported syntax/imports/cycles fail instead of silently transforming. */
export function bundle(root, entry) {
  root = resolve(root); const modules = new Map(), visiting = new Set(), inputs = [];
  function visit(path) {
    path = resolve(path); const id = relative(root, path).split(sep).join("/");
    if (id.startsWith("../") || !id.endsWith(".js") || !/^(src|runtime|recipes|third_party)\//.test(id)) throw new Error("Unsafe compiler import");
    if (modules.has(id)) return id;
    if (visiting.has(id) || inputs.length >= 64) throw new Error("Compiler module cycle/count limit");
    visiting.add(id);
    const bytes = readFileSync(path); if (bytes.length > 262144) throw new Error("Excessive compiler module");
    inputs.push({ path: id, bytes });
    let source = bytes.toString("utf8"), assignments = [];
    const dependency = name => { if (!name.startsWith(".")) throw new Error("External compiler import"); return JSON.stringify(visit(resolve(dirname(path), name))); };
    source = source.replace(/import\s*([^;]+?)\s*from\s*["']([^"']+)["'];/g, (_, binding, name) => {
      const dep = dependency(name); binding = binding.trim();
      if (binding.startsWith("*")) return `const ${binding.replace(/^\*\s*as\s*/, "")} = modules[${dep}];`;
      if (binding.startsWith("{")) return `const ${binding.replace(/\bas\b/g, ":")} = modules[${dep}];`;
      const match = /^(\w+)(?:\s*,\s*(\{.*\}))?$/.exec(binding);
      if (!match) throw new Error("Unsupported compiler import");
      return `const ${match[1]} = modules[${dep}].default;` + (match[2] ? `const ${match[2].replace(/\bas\b/g, ":")} = modules[${dep}];` : "");
    });
    source = source.replace(/export\s*\*\s*as\s*(\w+)\s*from\s*["']([^"']+)["'];/g, (_, name, path) => { assignments.push(`exports.${name}=modules[${dependency(path)}];`); return ""; });
    source = source.replace(/export\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];/g, (_, list, path) => {
      const dep = dependency(path);
      for (const name of list.split(",").map(item => item.trim()).filter(Boolean)) { if (!/^\w+$/.test(name)) throw new Error("Unsupported compiler reexport"); assignments.push(`exports.${name}=modules[${dep}].${name};`); }
      return "";
    });
    source = source.replace(/export\s*\{([^}]+)\};/g, (_, list) => {
      for (const name of list.split(",").map(item => item.trim()).filter(Boolean)) { const match = /^(\w+)(?:\s+as\s+(\w+))?$/.exec(name); if (!match) throw new Error("Unsupported compiler export"); assignments.push(`exports.${match[2] ?? match[1]}=${match[1]};`); }
      return "";
    });
    source = source.replace(/export\s+default\s+(\w+);/g, (_, name) => { assignments.push(`exports.default=${name};`); return ""; });
    source = source.replace(/export\s+((?:async\s+)?function|class|const|let)\s+(\w+)/g, (_, kind, name) => { assignments.push(`exports.${name}=${name};`); return `${kind} ${name}`; });
    source = source.replace(/import\.meta\.url/g, JSON.stringify("firmingo-compiler://assets/" + id));
    if (/\b(import|export)\s*(?:\{|\*|default|class|const|function|async|["'])/.test(source)) throw new Error("Unhandled compiler syntax: " + id);
    modules.set(id, `modules[${JSON.stringify(id)}]=(()=>{const exports={};\n${source}\n${assignments.join("\n")}\nreturn Object.freeze(exports);})();`);
    visiting.delete(id); return id;
  }
  const id = visit(resolve(root, entry));
  const output = `"use strict";const modules={};\n${[...modules.values()].join("\n")}\nglobalThis.FirmingoCompiler=modules[${JSON.stringify(id)}];\n`;
  if (Buffer.byteLength(output) > 262144) throw new Error("Compiler bundle size limit");
  new Script(output);
  return { output, inputs };
}
