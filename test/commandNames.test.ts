import './setup';
import { test } from 'node:test';
import * as assert from 'assert';
import { createDocument } from './document';
import { lint } from './analyze';

const unknownCommandErrors = (source: string) =>
    lint(createDocument(source)).filter(message => message.includes('Unknown command'));

test('names are matched like RisuAI: case, whitespace, "_" and "-" are ignored', () => {
    for (const source of ['{{get_var::a}}', '{{Get-Var::a}}', '{{GETVAR::a}}', '{{previouscharchat}}', '{{previous-char-chat}}', '{{chat_index}}', '{{chatindex}}']) {
        assert.deepStrictEqual(unknownCommandErrors(source), [], source);
    }
});

test('names without a letter or digit at the start still need an exact match', () => {
    assert.strictEqual(unknownCommandErrors('{{_}}').length, 1);
    assert.strictEqual(unknownCommandErrors('{{-}}').length, 1);
});

test('CBS added in RisuAI after 2025-12 are known', () => {
    for (const source of ['{{authornote}}', '{{author_note}}', '{{bkspc}}', '{{erase}}', '{{declare::a}}', '{{rollpick}}']) {
        assert.deepStrictEqual(unknownCommandErrors(source), [], source);
    }
});

test('#if-pure is warned about because RisuAI runs it as #if', () => {
    const warnings = (source: string) => lint(createDocument(source)).filter(message => message.includes("'{{#if-pure}}'"));
    assert.strictEqual(warnings('{{#if-pure 1}}\n  a\n{{/if-pure}}').length, 1);
    assert.strictEqual(warnings('{{#if_pure 1}}\n  a\n{{/if_pure}}').length, 0);
});

test('unknown names are still reported', () => {
    assert.strictEqual(unknownCommandErrors('{{definitely_not_a_cbs}}').length, 1);
});
