// Compares the CBS names and aliases registered in RisuAI (cbs_reference/src/ts/cbs.ts)
// with src/cbsData.ts and prints what is missing or different. Run with: npm run check:cbs
// cbs_reference is not in git, so this runs locally, not in CI.
import * as fs from 'fs';
import * as path from 'path';
import { cbsCommandsData } from '../src/cbsData';

interface UpstreamEntry {
    name: string;
    aliases: string[];
    internalOnly: boolean;
    deprecated: boolean;
}

const projectRoot = path.join(__dirname, '..', '..');
const cbsSource = path.join(projectRoot, 'cbs_reference', 'src', 'ts', 'cbs.ts');

/** RisuAI's matcher lowercases the name and drops whitespace, '_' and '-' before looking it up */
const normalize = (name: string) => name.toLocaleLowerCase().replace(/[\s_-]/g, '');

/** Block syntax (#if, :else, ...) is parsed separately and offered through snippets, not cbsData */
const isBlockSyntax = (name: string) => /^[#:]/.test(name);

function readUpstream(): UpstreamEntry[] {
    const text = fs.readFileSync(cbsSource, 'utf8').replace(/\r\n/g, '\n');
    // Each CBS is a `registerFunction({ ... })` call whose top-level keys are indented by 8 spaces
    return text.split(/\n\s*registerFunction\(\{\n/).slice(1).map(block => {
        const name = /^ {8}name: *['"]([^'"]+)['"]/m.exec(block)?.[1] ?? '';
        const aliasList = /^ {8}alias: *\[([^\]]*)\]/m.exec(block)?.[1] ?? '';
        return {
            name,
            aliases: [...aliasList.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]),
            internalOnly: /^ {8}internalOnly: *true/m.test(block),
            deprecated: /^ {8}deprecated:/m.test(block)
        };
    }).filter(entry => entry.name);
}

const upstream = readUpstream();
const upstreamFunctions = upstream.filter(entry => !isBlockSyntax(entry.name) && !entry.internalOnly);

// Map every normalized local name or alias to its command
const localByName = new Map<string, typeof cbsCommandsData[number]>();
for (const cmd of cbsCommandsData) {
    for (const name of [cmd.name, ...(cmd.aliases ?? [])]) {
        localByName.set(normalize(name), cmd);
    }
}
const upstreamNames = new Set(upstream.flatMap(entry => [entry.name, ...entry.aliases].map(normalize)));

const missing = upstreamFunctions.filter(entry => !localByName.has(normalize(entry.name)));
const missingAliases = upstreamFunctions
    .filter(entry => localByName.has(normalize(entry.name)))
    .map(entry => ({ name: entry.name, aliases: entry.aliases.filter(alias => !localByName.has(normalize(alias))) }))
    .filter(diff => diff.aliases.length);
const deprecationDiffs = upstreamFunctions.filter(entry => {
    const local = localByName.get(normalize(entry.name));
    return local && entry.deprecated !== !!local.deprecated;
});
const onlyLocal = cbsCommandsData.filter(cmd => ![cmd.name, ...(cmd.aliases ?? [])].some(name => upstreamNames.has(normalize(name))));
const blocks = upstream.filter(entry => isBlockSyntax(entry.name));

console.log(`Upstream: ${upstream.length} registered (${blocks.length} block syntax, ${upstream.filter(e => e.internalOnly).length} internal only). Local: ${cbsCommandsData.length}.`);
console.log('Names are compared the way RisuAI matches them: case, whitespace, "_" and "-" are ignored.');
const section = (title: string, lines: string[]) => {
    console.log(`\n${title} (${lines.length})`);
    lines.forEach(line => console.log(`  ${line}`));
};
section('Missing in cbsData', missing.map(e => `${e.name}${e.aliases.length ? ` (aliases: ${e.aliases.join(', ')})` : ''}${e.deprecated ? ' [deprecated]' : ''}`));
section('Missing aliases', missingAliases.map(d => `${d.name}: ${d.aliases.join(', ')}`));
section('Deprecation differs', deprecationDiffs.map(e => `${e.name}: upstream is ${e.deprecated ? 'deprecated' : 'not deprecated'}`));
section('Only in cbsData (check the parser handles them)', onlyLocal.map(cmd => cmd.name));
section('Block syntax in upstream (check snippets and linter)', blocks.map(e => `${e.name}${e.aliases.length ? ` (aliases: ${e.aliases.join(', ')})` : ''}${e.deprecated ? ' [deprecated]' : ''}`));
