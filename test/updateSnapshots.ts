// Reruns the tests with UPDATE_SNAPSHOTS=1 so snapshot files are rewritten (npm run test:update).
import { spawnSync } from 'child_process';

const result = spawnSync(process.execPath, ['--test', 'out/test/**/*.test.js'], {
    stdio: 'inherit',
    env: { ...process.env, UPDATE_SNAPSHOTS: '1' }
});
process.exit(result.status ?? 1);
