import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// Compiled tests run from out/test, so go up two levels to the project root.
const projectRoot = path.join(__dirname, '..', '..');
export const fixturesDir = path.join(projectRoot, 'test', 'fixtures');
const snapshotsDir = path.join(projectRoot, 'test', '__snapshots__');

/**
 * Compares `actual` with test/__snapshots__/<name>.json.
 * Missing snapshots are written locally; in CI they fail. Set UPDATE_SNAPSHOTS=1 (npm run test:update) to rewrite them.
 */
export function matchSnapshot(name: string, actual: unknown): void {
    const file = path.join(snapshotsDir, `${name}.json`);
    const serialized = JSON.stringify(actual, null, 2) + '\n';
    const exists = fs.existsSync(file);

    if (!exists && process.env.CI) {
        assert.fail(`Missing snapshot ${name}.json. Run "npm run test:update" locally and commit it.`);
    }
    if (!exists || process.env.UPDATE_SNAPSHOTS) {
        fs.mkdirSync(snapshotsDir, { recursive: true });
        fs.writeFileSync(file, serialized);
        return;
    }

    const expected = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    assert.strictEqual(serialized, expected, `Snapshot ${name}.json changed. If the change is intended, run "npm run test:update".`);
}
