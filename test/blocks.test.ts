import { test } from 'node:test';
import * as assert from 'assert';
import { findBlockPairs } from '../src/cbsBlocks';

/** Returns each pair as [opening tag text, closing tag text] */
const pairTexts = (text: string) =>
    findBlockPairs(text).map(p => [text.substring(p.openStart, p.openEnd), text.substring(p.closeStart, p.closeEnd)]);

test('pairs nested blocks, inner block first', () => {
    const text = '{{#when::1}}a{{#each [1] as n}}{{slot::n}}{{/each}}b{{/when}}';
    assert.deepStrictEqual(pairTexts(text), [
        ['{{#each [1] as n}}', '{{/each}}'],
        ['{{#when::1}}', '{{/when}}']
    ]);
});

test('{{/}} closes the latest open block', () => {
    assert.deepStrictEqual(pairTexts('{{#if 1}}x{{/}}'), [['{{#if 1}}', '{{/}}']]);
});

test('keeps nested tags inside the opening tag', () => {
    const text = '{{#when {{getvar::a}}}}x{{/when}}';
    assert.deepStrictEqual(pairTexts(text), [['{{#when {{getvar::a}}}}', '{{/when}}']]);
});

test(':else does not open or close a block', () => {
    assert.deepStrictEqual(pairTexts('{{#when::1}}a{{:else}}b{{/}}'), [['{{#when::1}}', '{{/}}']]);
});

test('leaves out unclosed blocks and stray closing tags', () => {
    assert.deepStrictEqual(pairTexts('{{/when}}{{#when::1}}a'), []);
});
