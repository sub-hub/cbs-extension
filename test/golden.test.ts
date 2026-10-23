import './setup';
import { test } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import { createDocument } from './document';
import { format, inlayHints, lint } from './analyze';
import { fixturesDir, matchSnapshot } from './snapshot';

// Pins the current linter, formatter and inlay hint output for each fixture.
// A snapshot diff means behavior changed: check it is intended before updating.
const fixtures = fs.readdirSync(fixturesDir).filter(file => file.endsWith('.cbs')).sort();

for (const file of fixtures) {
    test(file, () => {
        const document = createDocument(fs.readFileSync(path.join(fixturesDir, file), 'utf8'), file);
        matchSnapshot(file.replace(/\.cbs$/, ''), {
            diagnostics: lint(document),
            inlayHints: inlayHints(document),
            ...format(document)
        });
    });
}
