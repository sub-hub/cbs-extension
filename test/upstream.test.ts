import './setup';
import { test } from 'node:test';
import { createDocument } from './document';
import { lint } from './analyze';
import { matchSnapshot } from './snapshot';
import { upstreamCases } from './upstreamCases';

// Records what the linter reports for inputs RisuAI itself accepts.
// Any diagnostic listed in the snapshot is a known gap between the linter and RisuAI.
test('RisuAI parser test inputs', () => {
    const results: Record<string, string[]> = {};
    for (const { name, source } of upstreamCases) {
        results[name] = lint(createDocument(source));
    }
    matchSnapshot('upstream-cases', results);
});
