/** One-shot, AST-aware gettext migration. Run only on a reviewed engineering branch. */
const fs = require('node:fs');
const espree = require('espree');
const words = new Set(
    'Search Next Previous Print Source Copies Quantity Type Width Height Color Background Name Cancel Close Delete Remove Save Undo Redo Bold Italic Underline Visible Migration Design Products Orders Coupons Users Posts Top Bottom Left Right Center'.split(
        ' ',
    ),
);
const natural = (s) =>
    typeof s === 'string' &&
    !['use strict', 'Times New Roman', 'Courier New', 'bold ', 'italic '].includes(s) &&
    !/^(?:px |pt |\d+(?:\.\d+)?(?:px|pt|mm|em|rem)\b)/.test(s) &&
    !/[<>={}\\]/.test(s) &&
    !s.includes('://') &&
    (words.has(s) || /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(s));
const domain = 'ramsey-labels-independent';
const helper = `
    const __ = (message, domain) => globalThis.wp?.i18n?.__(message, domain) ?? message;
    const sprintf = (format, ...values) => {
        if (globalThis.wp?.i18n?.sprintf) return globalThis.wp.i18n.sprintf(format, ...values);
        let index = 0;
        return format.replace(/%%|%(?:(\\d+)\\$)?s/g, (token, position) => token === '%%' ? '%' : String(values[position ? Number(position) - 1 : index++]));
    };
`;
for (const file of ['assets/app.js', 'assets/core.js', 'assets/render.js', 'assets/barcodes.js']) {
    const source = fs.readFileSync(file, 'utf8');
    if (source.includes('const __ =')) throw Error('Migration already applied: ' + file);
    const tree = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'script', range: true });
    const edits = [];
    function flatten(node) {
        if (node.type === 'BinaryExpression' && node.operator === '+' && hasLiteral(node))
            return [...flatten(node.left), ...flatten(node.right)];
        return [node];
    }
    function hasLiteral(node) {
        return (
            (node.type === 'Literal' && typeof node.value === 'string') ||
            (node.type === 'BinaryExpression' &&
                node.operator === '+' &&
                (hasLiteral(node.left) || hasLiteral(node.right)))
        );
    }
    function walk(node, parent) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'BinaryExpression' && node.operator === '+') {
            const parts = flatten(node);
            if (
                parts.some((p) => p.type === 'Literal' && natural(p.value)) &&
                !parts.some(
                    (p) =>
                        p.type === 'Literal' &&
                        typeof p.value === 'string' &&
                        /[<>{}\\]/.test(p.value),
                )
            ) {
                let message = '',
                    args = [];
                for (const part of parts) {
                    if (part.type === 'Literal' && typeof part.value === 'string')
                        message += part.value.replace(/%/g, '%%');
                    else {
                        message += '%s';
                        args.push(source.slice(part.range[0], part.range[1]));
                    }
                }
                const comment = args.length
                    ? '/* translators: ' +
                      args
                          .map((v, i) => '%' + (i + 1) + '$s: ' + v.replace(/\*\//g, ''))
                          .join('; ') +
                      '. */\n'
                    : '';
                edits.push([
                    node.range[0],
                    node.range[1],
                    comment +
                        (args.length ? 'sprintf(' : '') +
                        '__(' +
                        JSON.stringify(message) +
                        ', ' +
                        JSON.stringify(domain) +
                        ')' +
                        (args.length ? ', ' + args.join(', ') + ')' : ''),
                ]);
                return;
            }
        }
        if (
            node.type === 'Literal' &&
            natural(node.value) &&
            !(parent?.type === 'Property' && parent.key === node && !parent.computed)
        ) {
            edits.push([
                node.range[0],
                node.range[1],
                '__(' + JSON.stringify(node.value) + ', ' + JSON.stringify(domain) + ')',
            ]);
            return;
        }
        for (const [key, value] of Object.entries(node))
            if (key !== 'range') {
                if (Array.isArray(value)) for (const child of value) walk(child, node);
                else if (value && typeof value === 'object') walk(value, node);
            }
    }
    walk(tree, null);
    const point = source.lastIndexOf("'use strict';") + "'use strict';".length;
    edits.push([point, point, helper]);
    let output = source;
    for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0]))
        output = output.slice(0, start) + value + output.slice(end);
    fs.writeFileSync(file, output);
    console.log(file + ': ' + (edits.length - 1) + ' gettext expressions');
}
