This extension provides language features for the CBS (Curly Braced Syntaxes) grammar used in the RisuAI program.
Therefore, this extension must be created strictly following RisuAI's grammar.

The src folder in cbs_reference contains RisuAI's code.
Multiple CBS documents are located in cbs_reference\src\etc\docs.
cbs_reference\src\ts\cbs.ts and cbs_reference\src\ts\parser\parser.svelte.ts contain the actual code implementing CBS.
cbs_reference\SOURCE.txt records which upstream RisuAI commit cbs_reference\src was copied from, and how to update it.
After updating cbs_reference, run npm run check:cbs to list CBS that src\cbsData.ts is missing.
RisuAI matches CBS names after lowercasing and removing whitespace, '_' and '-' (matcher in parser.svelte.ts); cbsData lookups do the same.

..\RisuAI is the user's own RisuAI development clone. Its working tree changes often and may be on any branch, so do not read CBS behavior from it by default.
It can contain new CBS that are not merged upstream yet. Only when the user names such a CBS or branch, read it from git, e.g. git -C ..\RisuAI diff upstream/main..<branch> -- src/ts/cbs.ts src/ts/parser

Please refer to these documents carefully while coding.

There is no need to run npm compile after code modification. Review the codes you modified again to see if they are correct

Run npm test after changing the linter, formatter or inlay hints. The tests compare results with test\__snapshots__.
If a snapshot changes, check that the change is intended before running npm run test:update, and mention the change to the user.
test\upstreamCases.ts holds inputs from RisuAI's own parser tests; RisuAI accepts all of them, so new errors there are likely linter bugs.
Files in format_examples are local only (some are real user cards); copy only synthetic examples into test\fixtures.