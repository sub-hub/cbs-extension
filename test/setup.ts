// Import this first in every test file: it points `require('vscode')` at the mock in vscode.ts.
import Module from 'module';
import * as path from 'path';

const mockPath = path.join(__dirname, 'vscode.js');
const moduleInternals = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const originalResolve = moduleInternals._resolveFilename;

moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]): string {
    if (request === 'vscode') {
        return mockPath;
    }
    return originalResolve.call(this, request, ...rest);
};
