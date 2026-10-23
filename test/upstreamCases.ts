/**
 * CBS inputs taken from RisuAI's own parser tests (cbs_reference/src/ts/parser/tests/cbs).
 * RisuAI renders all of these, so the linter should not treat them as broken.
 * Inputs built by the tests' helpers are written out here in their expanded form.
 * Property-based inputs use one fixed example instead (a = "a", b = "b", 3 > 2).
 */

const ifBody = '\n\n  C  \n  B  \n  S  \n\n';

/** conditionals.test.ts wraps blocks as `0 {{op}}body{{/}} 9` */
const wrap = (op: string, body: string) => `0 {{${op}}}${body}{{/}} 9`;

/** loop.test.ts wraps blocks as `{{op}}body{{/}}` */
const block = (op: string, body: string) => `{{${op}}}${body}{{/}}`;

export const upstreamCases: Array<{ name: string; source: string }> = [
    // conditionals.test.ts: #if
    { name: '#if 1', source: wrap('#if 1', 'CBS') },
    { name: '#if true', source: wrap('#if true', 'CBS') },
    { name: '#if 0', source: wrap('#if 0', 'CBS') },
    { name: '#if with two spaces', source: wrap('#if  1', 'CBS') },
    { name: '#if indented body', source: wrap('#if 1', ifBody) },
    { name: '#if nested', source: wrap('#if 1', wrap('#if 0', 'CBS')) },

    // conditionals.test.ts: #if_pure
    { name: '#if_pure 1', source: wrap('#if_pure 1', 'CBS') },
    { name: '#if_pure indented body', source: wrap('#if_pure 1', ifBody) },
    { name: '#if_pure nested', source: wrap('#if_pure 1', wrap('#if_pure 0', ifBody)) },

    // conditionals.test.ts: #when
    { name: '#when::1', source: wrap('#when::1', 'CBS') },
    { name: '#when::true', source: wrap('#when::true', 'CBS') },
    { name: '#when without ::', source: wrap('#when 1', 'CBS') },
    { name: '#when nested', source: wrap('#when 1', wrap('#when 0', 'CBS')) },
    { name: '#when::is', source: wrap('#when::a::is::a', 'CBS') },
    { name: '#when::isnot', source: wrap('#when::a::isnot::b', 'CBS') },
    { name: '#when::>', source: wrap('#when::3::>::2', 'CBS') },
    { name: '#when::>=', source: wrap('#when::3::>=::2', 'CBS') },
    { name: '#when::<=', source: wrap('#when::2::<=::3', 'CBS') },
    { name: '#when::<', source: wrap('#when::2::<::3', 'CBS') },
    { name: '#when::and', source: wrap('#when::1::and::1', 'CBS') },
    { name: '#when::and::not', source: wrap('#when::1::and::not::false', 'CBS') },
    { name: '#when::or', source: wrap('#when::0::or::1', 'CBS') },
    { name: '#when::or::not', source: wrap('#when::0::or::not::false', 'CBS') },
    { name: '#when right-to-left', source: wrap('#when::1::or::0::and::0', 'CBS') },
    { name: '#when::keep', source: wrap('#when::keep::1', ifBody) },
    { name: '#when::legacy', source: wrap('#when::legacy::1', ifBody) },
    { name: '#when::var', source: wrap('#when::var::true', 'CBS') },
    { name: '#when::toggle', source: wrap('#when::toggle::true', 'CBS') },
    { name: '#when::vis', source: wrap('#when::a::vis::a', 'CBS') },
    { name: '#when::visnot', source: wrap('#when::a::visnot::b', 'CBS') },
    { name: '#when::tis', source: wrap('#when::a::tis::a', 'CBS') },
    { name: '#when::tisnot', source: wrap('#when::a::tisnot::b', 'CBS') },
    { name: '#when single line else', source: wrap('#when::1', 'CBS{{:else}}SBC') },
    { name: '#when multiline else', source: wrap('#when::1', 'CBS\n{{:else}}\nSBC') },
    { name: '#when::keep with else', source: wrap('#when::keep::1', `${ifBody}{{:else}}${[...ifBody].reverse().join('')}`) },
    {
        name: '#when else in and out of nested #when',
        source: '{{#when 1}}\n{{#when 0}}CBS{{:else}}SBC{{/}}\n{{:else}}\nABC\n{{/}}'
    },
    {
        name: '#when else in #each',
        source: '{{#each [1, 2, 3] as n}}\n{{#when::n::is::2}}\nCBS{{slot::n}}\n{{:else}}\nSBC{{slot::n}}\n{{/}}\n{{/}}'
    },

    // loop.test.ts: #each
    { name: '#each array literal', source: block('#each [1, 2, 3] as n', '{{slot::n}} ') },
    { name: '#each variable', source: block('#each {{getvar::arr}} as n', '{{slot::n}} ') },
    { name: '#each 2D array', source: block('#each::keep [[1, 2], [3, 4]] as x', block('#each::keep {{slot::x}} as y', '{{slot::y}}\n')) },
    { name: '#each empty array', source: block('#each [] as n', '{{slot::n}} ') },
    { name: '#each not an array', source: block('#each a,b,c as n', '{{slot::n}} ') },
    { name: '#each body whitespace', source: block('#each [1, 2, 3] as n', ' \n - {{slot::n}}\n  ') },
    { name: '#each nested', source: block('#each::keep [1, 2] as x', block('#each::keep [3, 4] as y', '{{slot::x}}{{slot::y}}\n')) },
    {
        name: '#each in #when else',
        source: '{{#when 1}}\n{{#each [1, 2, 3] as n}}{{slot::n}}{{/}}\n{{:else}}\n{{#each [3, 2, 1] as n}}{{slot::n}}{{/}}\n{{/}}'
    },
    { name: '#each without as', source: block('#each [1, 2, 3] n', '{{slot::n}} ') },
    { name: '#each::keep', source: block('#each::keep [1, 2, 3] as n', '  - {{slot::n}}\n') },

    // escapes.test.ts
    { name: 'bo, bc', source: '{{bo}}{{bc}}' },
    { name: 'br, cbr', source: '{{br}}{{cbr}}' },
    { name: 'decbo, decbc', source: '{{decbo}}{{decbc}}' },
    { name: ';', source: '{{;}}' },
    { name: '()', source: '{{(}}{{)}}' },
    { name: '<>', source: '{{<}}{{>}}' },
    { name: '#pure', source: '{{#pure}}text{{/}}' },
    { name: '#puredisplay', source: '{{#puredisplay}}text{{/}}' },
    { name: '#escape', source: '{{#escape}}\ntext (with) parens\n{{/}}' },
    { name: '#escape::keep', source: '{{#escape::keep}}\ntext\n{{/}}' },

    // strings.test.ts
    { name: 'startswith, endswith, contains', source: '{{startswith::Hello World::Hello}}{{endswith::Hello World::World}}{{contains::Hello World::lo Wo}}' },
    { name: 'replace', source: '{{replace::Hello World::o::0}}' },
    { name: 'split', source: '{{split::apple,banana,cherry::,}}' },
    { name: 'trim', source: '{{trim::  hello world  }}' },
    { name: 'length', source: '{{length::Hello}}' },
    { name: 'capitalize, lower, upper', source: '{{capitalize::hello world}}{{lower::Hello WORLD}}{{upper::Hello WORLD}}' }
];
