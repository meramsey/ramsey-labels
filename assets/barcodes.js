/**
 * Ramsey Labels — independent barcode encoders.
 * Symbol tables are standardized data, not source from the reference plugin.
 * Every encoder returns modules; the renderer owns physical sizing and quiet zones.
 * QR: Model 2, byte mode + UTF-8 ECI, versions 1–40, all four correction levels.
 * Data Matrix: ECC200 ASCII encoding + UTF-8 ECI, all square symbol sizes.
 */
(function (root, factory) {
    'use strict';
    const api = factory(
        typeof module !== 'undefined' && module.exports
            ? require('./symbol-tables.js')
            : root.RLISymbolTables,
    );
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.RLIBarcodes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (tables) {
    'use strict';
    const __ = (message, domain) => globalThis.wp?.i18n?.__(message, domain) ?? message;
    const sprintf = (format, ...values) => {
        if (globalThis.wp?.i18n?.sprintf) return globalThis.wp.i18n.sprintf(format, ...values);
        let index = 0;
        return format.replace(/%%|%(?:(\d+)\$)?s/g, (token, position) =>
            token === '%%' ? '%' : String(values[position ? Number(position) - 1 : index++]),
        );
    };

    const formats = ['code128', 'code39', 'ean13', 'ean8', 'upca', 'upce', 'qrcode', 'datamatrix'];
    const left = [
        '0001101',
        '0011001',
        '0010011',
        '0111101',
        '0100011',
        '0110001',
        '0101111',
        '0111011',
        '0110111',
        '0001011',
    ];
    const even = [
        '0100111',
        '0110011',
        '0011011',
        '0100001',
        '0011101',
        '0111001',
        '0000101',
        '0010001',
        '0001001',
        '0010111',
    ];
    const right = left.map((s) => s.replace(/[01]/g, (c) => (c === '1' ? '0' : '1')));
    const parity = [
        'LLLLLL',
        'LLGLGG',
        'LLGGLG',
        'LLGGGL',
        'LGLLGG',
        'LGGLLG',
        'LGGGLL',
        'LGLGLG',
        'LGLGGL',
        'LGGLGL',
    ];

    function oneDimensional(bits, value, quiet = 10) {
        return {
            matrix: [Array.from(bits, (c) => Number(c))],
            width: bits.length,
            height: 1,
            quiet,
            text: value,
            kind: 'linear',
        };
    }
    function widthsToBits(widths) {
        return Array.from(widths, (w, i) => (i % 2 ? '0' : '1').repeat(Number(w))).join('');
    }
    function checkDigit(body) {
        if (!/^\d+$/.test(body))
            throw new Error(
                __('A retail barcode must contain digits only.', 'ramsey-labels-independent'),
            );
        let sum = 0;
        for (let i = body.length - 1, weight = 3; i >= 0; i--, weight = 4 - weight)
            sum += Number(body[i]) * weight;
        return String((10 - (sum % 10)) % 10);
    }
    function checkedDigits(value, length) {
        if (!/^\d+$/.test(value) || ![length - 1, length].includes(value.length)) {
            throw new Error(
                /* translators: %1$s: length - 1; %2$s: length. */
                sprintf(
                    /* translators: expected numeric input lengths. */ __(
                        'Expected %1$s digits, or %2$s digits including the check digit.',
                        'ramsey-labels-independent',
                    ),
                    length - 1,
                    length,
                ),
            );
        }
        const body = value.slice(0, length - 1),
            check = checkDigit(body);
        if (value.length === length && value[length - 1] !== check)
            throw new Error(
                /* translators: %1$s: check. */
                sprintf(
                    /* translators: expected numeric input lengths. */ __(
                        'Incorrect check digit; expected %s.',
                        'ramsey-labels-independent',
                    ),
                    check,
                ),
            );
        return body + check;
    }
    function retail(value, format) {
        if (format === 'upce') return upce(value);
        const length = format === 'ean8' ? 8 : format === 'upca' ? 12 : 13;
        const normalized = checkedDigits(value, length);
        const digits = format === 'upca' ? '0' + normalized : normalized;
        let bits = '101';
        if (format === 'ean8') {
            for (let i = 0; i < 4; i++) bits += left[Number(digits[i])];
            bits += '01010';
            for (let i = 4; i < 8; i++) bits += right[Number(digits[i])];
        } else {
            for (let i = 1; i < 7; i++)
                bits += (parity[Number(digits[0])][i - 1] === 'L' ? left : even)[Number(digits[i])];
            bits += '01010';
            for (let i = 7; i < 13; i++) bits += right[Number(digits[i])];
        }
        return oneDimensional(bits + '101', normalized, 11);
    }
    function upce(value) {
        if (!/^\d{6,8}$/.test(value))
            throw new Error(
                __(
                    'UPC-E needs six compressed digits, optionally a number system and check digit.',
                    'ramsey-labels-independent',
                ),
            );
        const ns = value.length === 6 ? '0' : value[0];
        if (!['0', '1'].includes(ns))
            throw new Error(__('UPC-E number system must be 0 or 1.', 'ramsey-labels-independent'));
        const d = value.length === 6 ? value : value.slice(1, 7),
            last = d[5];
        let body;
        if ('012'.includes(last)) body = ns + d.slice(0, 2) + last + '0000' + d.slice(2, 5);
        else if (last === '3') body = ns + d.slice(0, 3) + '00000' + d.slice(3, 5);
        else if (last === '4') body = ns + d.slice(0, 4) + '00000' + d[4];
        else body = ns + d.slice(0, 5) + '0000' + last;
        const check = checkDigit(body);
        if (value.length === 8 && value[7] !== check)
            throw new Error(
                /* translators: %1$s: check. */
                sprintf(
                    /* translators: expected numeric input lengths. */ __(
                        'Incorrect UPC-E check digit; expected %s.',
                        'ramsey-labels-independent',
                    ),
                    check,
                ),
            );
        let p = [
            'GGGLLL',
            'GGLGLL',
            'GGLLGL',
            'GGLLLG',
            'GLGGLL',
            'GLLGGL',
            'GLLLGG',
            'GLGLGL',
            'GLGLLG',
            'GLLGLG',
        ][Number(check)];
        if (ns === '1') p = p.replace(/[GL]/g, (c) => (c === 'G' ? 'L' : 'G'));
        let bits = '101';
        for (let i = 0; i < 6; i++) bits += (p[i] === 'L' ? left : even)[Number(d[i])];
        const result = oneDimensional(bits + '010101', ns + d + check, 11);
        result.expanded = body + check;
        return result;
    }
    function code39(value) {
        if (!/^[0-9A-Z .\-$/+%]+$/.test(value))
            throw new Error(
                __(
                    'CODE39 accepts uppercase letters, digits, space and - . $ / + %.',
                    'ramsey-labels-independent',
                ),
            );
        const bits = Array.from('*' + value + '*', (c) => widthsToBits(tables.code39[c])).join('0');
        return oneDimensional(bits, value);
    }
    function code128(value, options) {
        if (!/^[\x00-\x7f]+$/.test(value))
            throw new Error(
                __(
                    'CODE128 requires ASCII. Use QR or Data Matrix for Unicode.',
                    'ramsey-labels-independent',
                ),
            );
        const runAt = (i) => (value.slice(i).match(/^\d+/) || [''])[0].length;
        let set = runAt(0) >= 4 ? 'C' : value.charCodeAt(0) < 32 ? 'A' : 'B';
        const words = [{ A: 103, B: 104, C: 105 }[set]];
        if (options.gs1) words.push(102);
        for (let i = 0; i < value.length;) {
            const chr = value.charCodeAt(i),
                digits = runAt(i);
            if (options.gs1 && chr === 29) {
                words.push(102);
                i++;
                continue;
            }
            if (set === 'C') {
                if (digits >= 2) {
                    words.push(Number(value.slice(i, i + 2)));
                    i += 2;
                    continue;
                }
                set = chr < 32 ? 'A' : 'B';
                words.push(set === 'A' ? 101 : 100);
                continue;
            }
            if (digits >= 4 || (digits === 2 && i + 2 === value.length)) {
                if (digits % 2 === 0) {
                    words.push(99);
                    set = 'C';
                    continue;
                }
            }
            if (set === 'A' && chr > 95) {
                words.push(100);
                set = 'B';
                continue;
            }
            if (set === 'B' && chr < 32) {
                words.push(101);
                set = 'A';
                continue;
            }
            words.push(set === 'A' && chr < 32 ? chr + 64 : chr - 32);
            i++;
        }
        let checksum = words[0];
        for (let i = 1; i < words.length; i++) checksum += words[i] * i;
        words.push(checksum % 103, 106);
        return oneDimensional(words.map((w) => widthsToBits(tables.code128[w])).join(''), value);
    }

    /** Reed–Solomon over GF(256). QR uses 0x11d/root 0; ECC200 uses 0x12d/root 1. */
    function reedSolomon(data, count, primitive = 0x11d, firstRoot = 0) {
        const exp = new Uint16Array(512),
            log = new Uint16Array(256);
        let v = 1;
        for (let i = 0; i < 255; i++) {
            exp[i] = v;
            log[v] = i;
            v <<= 1;
            if (v & 256) v ^= primitive;
        }
        for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
        const mul = (a, b) => (a && b ? exp[log[a] + log[b]] : 0);
        let polynomial = [1];
        for (let i = 0; i < count; i++) {
            const next = new Array(polynomial.length + 1).fill(0);
            for (let j = 0; j < polynomial.length; j++) {
                next[j] ^= polynomial[j];
                next[j + 1] ^= mul(polynomial[j], exp[i + firstRoot]);
            }
            polynomial = next;
        }
        const remainder = new Array(count).fill(0);
        for (const b of data) {
            const factor = b ^ remainder.shift();
            remainder.push(0);
            for (let i = 0; i < count; i++) remainder[i] ^= mul(polynomial[i + 1], factor);
        }
        return remainder;
    }
    function qrBlocks(version, level) {
        const spec = tables.qrBlocks[(version - 1) * 4 + { L: 0, M: 1, Q: 2, H: 3 }[level]],
            result = [];
        for (let i = 0; i < spec.length; i += 3)
            for (let j = 0; j < spec[i]; j++)
                result.push({ total: spec[i + 1], data: spec[i + 2] });
        return result;
    }
    function qr(value, options) {
        const bytes = Array.from(new TextEncoder().encode(value)),
            unicode = /[^\x00-\x7f]/.test(value);
        const level = String(options.ecc || 'M').toUpperCase();
        if (!['L', 'M', 'Q', 'H'].includes(level))
            throw new Error(__('Invalid QR error-correction level.', 'ramsey-labels-independent'));
        let version = Number(options.version || 1),
            blocks,
            capacity;
        if (!Number.isInteger(version) || version < 1 || version > 40)
            throw new Error(__('QR version must be 1–40.', 'ramsey-labels-independent'));
        while (version <= 40) {
            blocks = qrBlocks(version, level);
            capacity = blocks.reduce((s, b) => s + b.data, 0);
            const needed = (unicode ? 12 : 0) + 4 + (version < 10 ? 8 : 16) + bytes.length * 8;
            if (needed <= capacity * 8 && (version >= 10 || bytes.length <= 255)) break;
            if (options.version)
                throw new Error(
                    __(
                        'Data does not fit the selected QR version and correction level.',
                        'ramsey-labels-independent',
                    ),
                );
            version++;
        }
        if (version > 40)
            throw new Error(
                __(
                    'Text exceeds QR capacity at this error-correction level.',
                    'ramsey-labels-independent',
                ),
            );
        const bits = [],
            push = (n, size) => {
                for (let i = size - 1; i >= 0; i--) bits.push((n >>> i) & 1);
            };
        if (unicode) {
            push(7, 4);
            push(26, 8);
        }
        push(4, 4);
        push(bytes.length, version < 10 ? 8 : 16);
        bytes.forEach((b) => push(b, 8));
        for (let i = Math.min(4, capacity * 8 - bits.length); i > 0; i--) bits.push(0);
        while (bits.length % 8) bits.push(0);
        const data = [];
        for (let i = 0; i < bits.length; i += 8)
            data.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
        for (let i = 0; data.length < capacity; i++) data.push(i % 2 ? 0x11 : 0xec);
        let cursor = 0;
        const encoded = blocks.map((b) => {
            const d = data.slice(cursor, (cursor += b.data));
            return { d, e: reedSolomon(d, b.total - b.data) };
        });
        const words = [];
        for (let i = 0; i < Math.max(...blocks.map((b) => b.data)); i++)
            for (const b of encoded) if (i < b.d.length) words.push(b.d[i]);
        for (let i = 0; i < encoded[0].e.length; i++) for (const b of encoded) words.push(b.e[i]);
        let best,
            score = Infinity,
            chosen = 0;
        const masks =
            options.mask === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [Number(options.mask)];
        if (masks.some((n) => !Number.isInteger(n) || n < 0 || n > 7))
            throw new Error(__('Invalid QR mask.', 'ramsey-labels-independent'));
        for (const mask of masks) {
            const matrix = qrMatrix(version, level, words, mask),
                p = qrPenalty(matrix);
            if (p < score) {
                score = p;
                best = matrix;
                chosen = mask;
            }
        }
        return {
            matrix: best,
            width: best.length,
            height: best.length,
            quiet: 4,
            kind: 'matrix',
            text: value,
            version,
            ecc: level,
            mask: chosen,
        };
    }
    function qrMatrix(version, level, words, mask) {
        const n = 17 + 4 * version,
            grid = Array.from({ length: n }, () => new Array(n).fill(null));
        const set = (x, y, b) => {
            if (x >= 0 && y >= 0 && x < n && y < n) grid[y][x] = b ? 1 : 0;
        };
        const finder = (cx, cy) => {
            for (let y = -4; y <= 4; y++)
                for (let x = -4; x <= 4; x++) {
                    const d = Math.max(Math.abs(x), Math.abs(y));
                    set(cx + x, cy + y, d !== 2 && d !== 4);
                }
        };
        finder(3, 3);
        finder(n - 4, 3);
        finder(3, n - 4);
        for (const cy of tables.qrAlign[version - 1])
            for (const cx of tables.qrAlign[version - 1]) {
                if (grid[cy][cx] !== null) continue;
                for (let y = -2; y <= 2; y++)
                    for (let x = -2; x <= 2; x++)
                        set(cx + x, cy + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
            }
        for (let i = 8; i < n - 8; i++) {
            if (grid[6][i] === null) set(i, 6, i % 2 === 0);
            if (grid[i][6] === null) set(6, i, i % 2 === 0);
        }
        function format() {
            const value = ({ L: 1, M: 0, Q: 3, H: 2 }[level] << 3) | mask;
            let r = value << 10;
            for (let i = 14; i >= 10; i--) if ((r >>> i) & 1) r ^= 0x537 << (i - 10);
            const f = ((value << 10) | r) ^ 0x5412,
                bit = (i) => (f >>> i) & 1;
            for (let i = 0; i < 6; i++) set(8, i, bit(i));
            set(8, 7, bit(6));
            set(8, 8, bit(7));
            set(7, 8, bit(8));
            for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
            for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i));
            for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(i));
            set(8, n - 8, 1);
        }
        format();
        if (version >= 7) {
            let rem = version << 12;
            for (let i = 17; i >= 12; i--) if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
            const v = (version << 12) | rem;
            for (let i = 0; i < 18; i++) {
                const a = n - 11 + (i % 3),
                    b = Math.floor(i / 3);
                set(a, b, (v >>> i) & 1);
                set(b, a, (v >>> i) & 1);
            }
        }
        const masked = (x, y) =>
            [
                (x + y) % 2 === 0,
                y % 2 === 0,
                x % 3 === 0,
                (x + y) % 3 === 0,
                (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
                ((x * y) % 2) + ((x * y) % 3) === 0,
                (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
                (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
            ][mask];
        let index = 0,
            up = true;
        for (let x = n - 1; x >= 1; x -= 2) {
            if (x === 6) x--;
            for (let k = 0; k < n; k++) {
                const y = up ? n - 1 - k : k;
                for (let dx = 0; dx < 2; dx++)
                    if (grid[y][x - dx] === null) {
                        const dataBit =
                            index < words.length * 8
                                ? (words[Math.floor(index / 8)] >>> (7 - (index % 8))) & 1
                                : 0;
                        set(x - dx, y, dataBit ^ Number(masked(x - dx, y)));
                        index++;
                    }
            }
            up = !up;
        }
        return grid;
    }
    function qrPenalty(matrix) {
        const n = matrix.length;
        let penalty = 0,
            dark = 0;
        for (let axis = 0; axis < 2; axis++)
            for (let i = 0; i < n; i++) {
                const line = Array.from({ length: n }, (_, j) =>
                    axis ? matrix[j][i] : matrix[i][j],
                );
                let run = 1;
                for (let j = 1; j <= n; j++) {
                    if (j < n && line[j] === line[j - 1]) run++;
                    else {
                        if (run >= 5) penalty += run - 2;
                        run = 1;
                    }
                }
                const text = line.join('');
                for (let j = 0; j <= n - 11; j++)
                    if (['10111010000', '00001011101'].includes(text.slice(j, j + 11)))
                        penalty += 40;
            }
        for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
                dark += matrix[y][x];
                if (
                    x &&
                    y &&
                    matrix[y][x] === matrix[y - 1][x] &&
                    matrix[y][x] === matrix[y][x - 1] &&
                    matrix[y][x] === matrix[y - 1][x - 1]
                )
                    penalty += 3;
            }
        return penalty + Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
    }

    // [symbol side, total data words, total parity words, regions per axis, RS blocks].
    const dmSpecs = [
        [10, 3, 5, 1, 1],
        [12, 5, 7, 1, 1],
        [14, 8, 10, 1, 1],
        [16, 12, 12, 1, 1],
        [18, 18, 14, 1, 1],
        [20, 22, 18, 1, 1],
        [22, 30, 20, 1, 1],
        [24, 36, 24, 1, 1],
        [26, 44, 28, 1, 1],
        [32, 62, 36, 2, 1],
        [36, 86, 42, 2, 1],
        [40, 114, 48, 2, 1],
        [44, 144, 56, 2, 1],
        [48, 174, 68, 2, 1],
        [52, 204, 84, 2, 2],
        [64, 280, 112, 4, 2],
        [72, 368, 144, 4, 4],
        [80, 456, 192, 4, 4],
        [88, 576, 224, 4, 4],
        [96, 696, 272, 4, 4],
        [104, 816, 336, 4, 6],
        [120, 1050, 408, 6, 6],
        [132, 1304, 496, 6, 8],
        [144, 1558, 620, 6, 10],
    ];
    function dataMatrix(value, options) {
        const bytes = Array.from(new TextEncoder().encode(value)),
            words = [];
        if (/[^\x00-\x7f]/.test(value)) words.push(241, 27); // ECI assignment 26: UTF-8.
        if (options.gs1) words.push(232);
        for (let i = 0; i < bytes.length; i++) {
            if (
                bytes[i] >= 48 &&
                bytes[i] <= 57 &&
                i + 1 < bytes.length &&
                bytes[i + 1] >= 48 &&
                bytes[i + 1] <= 57
            ) {
                words.push(130 + (bytes[i] - 48) * 10 + bytes[++i] - 48);
            } else if (options.gs1 && bytes[i] === 29) words.push(232);
            else if (bytes[i] > 127) words.push(235, bytes[i] - 127);
            else words.push(bytes[i] + 1);
        }
        const spec = dmSpecs.find(
            (s) => s[1] >= words.length && (!options.size || s[0] === Number(options.size)),
        );
        if (!spec)
            throw new Error(
                __(
                    'Data does not fit a supported square Data Matrix ECC200 symbol.',
                    'ramsey-labels-independent',
                ),
            );
        const [side, capacity, ecc, regions, count] = spec;
        if (words.length < capacity) words.push(129);
        while (words.length < capacity) {
            const randomized = 129 + ((149 * (words.length + 1)) % 253) + 1;
            words.push(randomized <= 254 ? randomized : randomized - 254);
        }
        const eccBlocks = [];
        for (let b = 0; b < count; b++) {
            const block = [];
            for (let i = b; i < capacity; i += count) block.push(words[i]);
            eccBlocks.push(reedSolomon(block, ecc / count, 0x12d, 1));
        }
        for (let i = 0; i < ecc / count; i++)
            for (let b = 0; b < count; b++) words.push(eccBlocks[b][i]);
        const dataSide = side - 2 * regions,
            placement = dmPlace(words, dataSide, dataSide);
        const matrix = Array.from({ length: side }, () => new Array(side).fill(0)),
            regionData = dataSide / regions;
        for (let ry = 0; ry < regions; ry++)
            for (let rx = 0; rx < regions; rx++) {
                const ox = rx * (regionData + 2),
                    oy = ry * (regionData + 2);
                for (let x = 0; x < regionData + 2; x++) {
                    matrix[oy][ox + x] = x % 2 === 0 ? 1 : 0;
                    matrix[oy + regionData + 1][ox + x] = 1;
                }
                for (let y = 0; y < regionData; y++) {
                    matrix[oy + y + 1][ox] = 1;
                    matrix[oy + y + 1][ox + regionData + 1] = y % 2 === 0 ? 1 : 0;
                    for (let x = 0; x < regionData; x++)
                        matrix[oy + y + 1][ox + x + 1] =
                            placement[ry * regionData + y][rx * regionData + x];
                }
            }
        return { matrix, width: side, height: side, quiet: 1, kind: 'matrix', text: value };
    }
    function dmPlace(words, rows, columns) {
        const grid = Array.from({ length: rows }, () => new Array(columns).fill(null));
        function bit(row, col, word, position) {
            if (row < 0) {
                row += rows;
                col += 4 - ((rows + 4) % 8);
            }
            if (col < 0) {
                col += columns;
                row += 4 - ((columns + 4) % 8);
            }
            row %= rows;
            col %= columns;
            grid[row][col] = ((words[word] || 0) >>> (8 - position)) & 1;
        }
        function shape(points, word) {
            points.forEach(([r, c], i) => bit(r, c, word, i + 1));
        }
        function utah(r, c, w) {
            shape(
                [
                    [r - 2, c - 2],
                    [r - 2, c - 1],
                    [r - 1, c - 2],
                    [r - 1, c - 1],
                    [r - 1, c],
                    [r, c - 2],
                    [r, c - 1],
                    [r, c],
                ],
                w,
            );
        }
        let row = 4,
            col = 0,
            word = 0;
        do {
            if (row === rows && col === 0)
                shape(
                    [
                        [rows - 1, 0],
                        [rows - 1, 1],
                        [rows - 1, 2],
                        [0, columns - 2],
                        [0, columns - 1],
                        [1, columns - 1],
                        [2, columns - 1],
                        [3, columns - 1],
                    ],
                    word++,
                );
            if (row === rows - 2 && col === 0 && columns % 4 !== 0)
                shape(
                    [
                        [rows - 3, 0],
                        [rows - 2, 0],
                        [rows - 1, 0],
                        [0, columns - 4],
                        [0, columns - 3],
                        [0, columns - 2],
                        [0, columns - 1],
                        [1, columns - 1],
                    ],
                    word++,
                );
            if (row === rows - 2 && col === 0 && columns % 8 === 4)
                shape(
                    [
                        [rows - 3, 0],
                        [rows - 2, 0],
                        [rows - 1, 0],
                        [0, columns - 2],
                        [0, columns - 1],
                        [1, columns - 1],
                        [2, columns - 1],
                        [3, columns - 1],
                    ],
                    word++,
                );
            if (row === rows + 4 && col === 2 && columns % 8 === 0)
                shape(
                    [
                        [rows - 1, 0],
                        [rows - 1, columns - 1],
                        [0, columns - 3],
                        [0, columns - 2],
                        [0, columns - 1],
                        [1, columns - 3],
                        [1, columns - 2],
                        [1, columns - 1],
                    ],
                    word++,
                );
            do {
                if (row < rows && col >= 0 && grid[row][col] === null) utah(row, col, word++);
                row -= 2;
                col += 2;
            } while (row >= 0 && col < columns);
            row++;
            col += 3;
            do {
                if (row >= 0 && col < columns && grid[row][col] === null) utah(row, col, word++);
                row += 2;
                col -= 2;
            } while (row < rows && col >= 0);
            row += 3;
            col++;
        } while (row < rows || col < columns);
        if (grid[rows - 1][columns - 1] === null) {
            grid[rows - 1][columns - 1] = 1;
            grid[rows - 2][columns - 2] = 1;
        }
        return grid.map((line) => line.map((v) => (v === null ? 0 : v)));
    }
    /** GS1-128 element strings: common verified AIs, not every GS1 family. */
    function gs1Payload(input) {
        const specs = {
            '00': { length: 18, check: true },
            '01': { length: 14, check: true },
            '02': { length: 14, check: true },
            10: { max: 20 },
            11: { length: 6, date: true },
            15: { length: 6, date: true },
            17: { length: 6, date: true },
            21: { max: 20 },
            30: { max: 8, numeric: true },
            37: { max: 8, numeric: true },
        };
        const text = String(input),
            parts = [];
        if (text.startsWith('(')) {
            const expression = /\((\d{2})\)([^()]*)/g;
            let match,
                end = 0;
            while ((match = expression.exec(text))) {
                if (match.index !== end)
                    throw Error(
                        __('Malformed GS1 application identifiers.', 'ramsey-labels-independent'),
                    );
                parts.push([match[1], match[2]]);
                end = expression.lastIndex;
            }
            if (end !== text.length || !parts.length)
                throw Error(
                    __('Malformed GS1 application identifiers.', 'ramsey-labels-independent'),
                );
        } else {
            let cursor = 0;
            while (cursor < text.length) {
                const ai = text.slice(cursor, cursor + 2),
                    spec = specs[ai];
                cursor += 2;
                if (!spec)
                    throw Error(
                        __('Unsupported GS1 application identifier.', 'ramsey-labels-independent'),
                    );
                let end = spec.length ? cursor + spec.length : text.indexOf('\x1d', cursor);
                if (end < 0) end = text.length;
                parts.push([ai, text.slice(cursor, end)]);
                cursor = end;
                if (text[cursor] === '\x1d') cursor++;
            }
        }
        for (const [ai, value] of parts) {
            const spec = specs[ai];
            if (!spec)
                throw Error(
                    __('Unsupported GS1 application identifier.', 'ramsey-labels-independent'),
                );
            if (
                !value ||
                (spec.length && value.length !== spec.length) ||
                (spec.max && value.length > spec.max)
            )
                throw Error(__('Invalid GS1 field length.', 'ramsey-labels-independent'));
            if (
                spec.length || spec.numeric
                    ? !/^\d+$/.test(value)
                    : !/^[A-Za-z0-9 .\/-]+$/.test(value)
            )
                throw Error(
                    __('Unsupported characters in this GS1 field.', 'ramsey-labels-independent'),
                );
            if (spec.check && checkDigit(value.slice(0, -1)) !== value.slice(-1))
                throw Error(__('Incorrect GS1 check digit.', 'ramsey-labels-independent'));
            if (spec.date) {
                const month = Number(value.slice(2, 4)),
                    day = Number(value.slice(4, 6));
                const date = new Date(
                    Date.UTC(2000 + Number(value.slice(0, 2)), month - 1, day || 1),
                );
                if (month < 1 || month > 12 || day > 31 || date.getUTCMonth() !== month - 1)
                    throw Error(__('Invalid GS1 date.', 'ramsey-labels-independent'));
            }
        }
        return parts
            .map(
                ([ai, value], index) =>
                    ai + value + (specs[ai].max && index + 1 < parts.length ? '\x1d' : ''),
            )
            .join('');
    }
    function encode(format, value, options = {}) {
        format = String(format).toLowerCase();
        value = String(value);
        if (!value.length)
            throw new Error(
                __(
                    'Barcode data is empty. Choose another source field or supply a value.',
                    'ramsey-labels-independent',
                ),
            );
        if (value.length > 6000)
            throw new Error(
                __(
                    'Barcode input is too long (maximum 6,000 characters).',
                    'ramsey-labels-independent',
                ),
            );
        if (!formats.includes(format))
            throw new Error(
                /* translators: %1$s: format. */
                sprintf(__('Unsupported barcode format: %s', 'ramsey-labels-independent'), format),
            );
        if (options.gs1) {
            if (format !== 'code128')
                throw Error(
                    __(
                        'GS1 mode is supported only for GS1-128; other GS1 families are not advertised.',
                        'ramsey-labels-independent',
                    ),
                );
            value = gs1Payload(value);
        }
        if (format === 'code128') return code128(value, options);
        if (format === 'code39') return code39(value);
        if (format === 'qrcode') return qr(value, options);
        if (format === 'datamatrix') return dataMatrix(value, options);
        return retail(value, format);
    }
    function toSVG(symbol, moduleSize = 3, barHeight = 100) {
        if (
            !Number.isFinite(moduleSize) ||
            moduleSize <= 0 ||
            !Number.isFinite(barHeight) ||
            barHeight <= 0
        )
            throw Error(
                __('SVG dimensions must be positive finite numbers.', 'ramsey-labels-independent'),
            );
        const q = symbol.quiet,
            matrix = symbol.matrix,
            width = (symbol.width + 2 * q) * moduleSize;
        const height = symbol.kind === 'linear' ? barHeight : (symbol.height + 2 * q) * moduleSize;
        const shapes = [];
        for (let y = 0; y < matrix.length; y++)
            for (let x = 0; x < matrix[y].length; x++)
                if (matrix[y][x]) {
                    shapes.push(
                        '<rect x="' +
                            (x + q) * moduleSize +
                            '" y="' +
                            (symbol.kind === 'linear' ? 0 : (y + q) * moduleSize) +
                            '" width="' +
                            moduleSize +
                            '" height="' +
                            (symbol.kind === 'linear' ? height : moduleSize) +
                            '"/>',
                    );
                }
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="' +
            width +
            '" height="' +
            height +
            '" viewBox="0 0 ' +
            width +
            ' ' +
            height +
            '"><rect width="100%" height="100%" fill="white"/><g fill="black">' +
            shapes.join('') +
            '</g></svg>'
        );
    }
    return Object.freeze({ formats, encode, checkDigit, toSVG, reedSolomon, gs1Payload });
});
