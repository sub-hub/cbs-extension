/**
 * A block's opening tag ({{#when ...}}) and the tag that closes it ({{/when}} or {{/}}), as text offsets.
 * Each range covers the whole tag including the braces; the end offset is exclusive.
 */
export interface CbsBlockPair {
    name: string;
    openStart: number;
    openEnd: number;
    closeStart: number;
    closeEnd: number;
}

/**
 * Pairs block tags the same way the linter's block check does: braces are counted so nested tags
 * stay inside their tag, and any {{/...}} closes the most recently opened block, as in RisuAI.
 * Unclosed blocks and stray closing tags are left out.
 */
export function findBlockPairs(text: string): CbsBlockPair[] {
    const pairs: CbsBlockPair[] = [];
    const openBlocks: Array<{ name: string; start: number; end: number }> = [];

    let index = 0;
    while (index < text.length) {
        if (text.startsWith('{{', index)) {
            let braceCount = 1;
            let endIndex = index + 2;
            while (endIndex < text.length && braceCount > 0) {
                if (text.startsWith('{{', endIndex)) {
                    braceCount++;
                    endIndex += 2;
                } else if (text.startsWith('}}', endIndex)) {
                    braceCount--;
                    endIndex += 2;
                } else {
                    endIndex++;
                }
            }

            const tagContent = text.substring(index + 2, endIndex - 2).trim();
            if (tagContent.startsWith('#')) {
                const name = /^#([\w-]+)/.exec(tagContent)?.[1];
                if (name) {
                    openBlocks.push({ name, start: index, end: endIndex });
                }
            } else if (tagContent.startsWith('/')) {
                const open = openBlocks.pop();
                if (open) {
                    pairs.push({ name: open.name, openStart: open.start, openEnd: open.end, closeStart: index, closeEnd: endIndex });
                }
            }
            index = endIndex;
        } else {
            index++;
        }
    }

    return pairs;
}
