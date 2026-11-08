/** Resource-bounded segments without a total label-count quota. */
(function (root, factory) {
    'use strict';
    const api = factory(
        typeof module !== 'undefined' && module.exports ? require('./core.js') : root.RLICore,
    );
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.RLIBatches = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
    'use strict';
    /** Select a segment arithmetically; never allocate one object per total label. */
    const __ = (message, domain) => globalThis.wp?.i18n?.__(message, domain) ?? message;
    let sequence = 0;
    function append(queue, records) {
        if (!Array.isArray(records))
            throw Error(__('Supply an array of print records.', 'ramsey-labels-independent'));
        const normalized = records.map((record) => {
            if (
                !record ||
                !record.values ||
                typeof record.values !== 'object' ||
                Array.isArray(record.values)
            )
                throw Error(
                    __('Each print record needs a values object.', 'ramsey-labels-independent'),
                );
            const values = Object.create(null);
            for (const [key, value] of Object.entries(record.values)) {
                if (
                    !/^[\w.:-]{1,150}$/.test(key) ||
                    ['__proto__', 'constructor', 'prototype'].includes(key) ||
                    (value !== null && !['string', 'number', 'boolean'].includes(typeof value))
                )
                    throw Error(__('Invalid printable field.', 'ramsey-labels-independent'));
                const text = value === null ? '' : String(value);
                if (text.includes('\0') || new TextEncoder().encode(text).byteLength > 20000)
                    throw Error(
                        __('Printable field exceeds its text budget.', 'ramsey-labels-independent'),
                    );
                values[key] = text;
            }
            const key = record.key === undefined ? C.uid() : String(record.key);
            const source = record.source === undefined ? 'manual' : String(record.source);
            const quantity = record.quantity ?? 1;
            if (
                !/^[A-Za-z0-9_-]{1,100}$/.test(key) ||
                !/^[a-z0-9_-]{1,100}$/.test(source) ||
                typeof quantity === 'boolean' ||
                !Number.isSafeInteger(Number(quantity)) ||
                Number(quantity) < 1 ||
                (record.selected != null && ![true, false, 0, 1].includes(record.selected))
            )
                throw Error(
                    __(
                        'Invalid print record identity, selection or quantity.',
                        'ramsey-labels-independent',
                    ),
                );
            const normalized = {
                key,
                source,
                values,
                quantity: Number(quantity),
                selected: record.selected == null ? true : Boolean(record.selected),
            };
            const order = Number.isSafeInteger(record.__queueOrder)
                ? record.__queueOrder
                : sequence++;
            Object.defineProperty(normalized, '__queueOrder', {
                value: order,
                writable: true,
                enumerable: false,
            });
            return normalized;
        });
        const result = queue.concat(normalized);
        if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 8000000)
            throw Error(
                __(
                    'Live queue exceeds its 8 MB data budget. Print or export it before adding more records.',
                    'ramsey-labels-independent',
                ),
            );
        return result;
    }
    const collator = new Intl.Collator('en-US', {
        numeric: true,
        sensitivity: 'base',
        usage: 'sort',
    });
    function compareText(left, right) {
        return (
            collator.compare(String(left), String(right)) ||
            (String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0)
        );
    }
    function sort(records, mode = 'selection') {
        const result = records.slice();
        const stable = (a, b) => a.__queueOrder - b.__queueOrder,
            name = (record) => String(record.values.name || ''),
            sku = (record) => String(record.values.sku || '');
        if (mode === 'alpha-asc') mode = 'name-asc';
        if (mode === 'alpha-desc') mode = 'name-desc';
        if (mode === 'name-asc' || mode === 'name-desc') {
            const direction = mode === 'name-desc' ? -1 : 1;
            result.sort((a, b) => direction * compareText(name(a), name(b)) || stable(a, b));
        } else if (mode === 'sku-asc' || mode === 'sku-desc') {
            const direction = mode === 'sku-desc' ? -1 : 1;
            result.sort((a, b) => {
                const left = sku(a),
                    right = sku(b);
                if (!left || !right) return left ? -1 : right ? 1 : stable(a, b);
                return direction * compareText(left, right) || stable(a, b);
            });
        } else result.sort(stable);
        return result;
    }
    function rememberManualOrder(records) {
        for (const record of records) {
            if (!Object.prototype.hasOwnProperty.call(record, '__queueOrder'))
                Object.defineProperty(record, '__queueOrder', {
                    value: sequence,
                    writable: true,
                    enumerable: false,
                });
            record.__queueOrder = sequence++;
        }
        return records;
    }
    function segment(records, profile, index = 0) {
        const errors = C.validatePage(profile);
        if (errors.length) throw Error(errors.join('\n'));
        const page = C.geometry(profile),
            slots = page.rows * page.columns;
        const pixels =
            Math.max(1, Math.round((profile.design.width * page.dpi) / 25.4)) *
            Math.max(1, Math.round((profile.design.height * page.dpi) / 25.4));
        // Reserve space for decoded RGBA, canvas memory, encoded PNG strings and compositor overhead.
        const imageBudget = Math.max(1, Math.floor((128 * 1024 * 1024) / (pixels * 10)));
        const selectedRecords = records.filter((record) => record.selected !== false).length;
        let total = 0;
        for (const record of records) {
            if (record.selected === false) continue;
            if (!Number.isSafeInteger(Number(record.quantity)) || Number(record.quantity) < 1)
                throw Error(__('Use positive safe whole quantities.', 'ramsey-labels-independent'));
            total += Number(record.quantity);
            if (!Number.isSafeInteger(total))
                throw Error(
                    __(
                        'Total quantity is outside the safely representable range.',
                        'ramsey-labels-independent',
                    ),
                );
        }
        if (!total) throw Error(__('Select at least one label.', 'ramsey-labels-independent'));
        if (!Number.isSafeInteger(total + page.start) || !Number.isSafeInteger(index))
            throw Error(
                __(
                    'Print position is outside the safely representable range.',
                    'ramsey-labels-independent',
                ),
            );
        // Bound each document to the existing validated transport/renderer budget.
        // All segments end on a physical sheet boundary, including skipped initial slots.
        const pagesPerSegment = Math.max(
            1,
            Math.floor(
                Math.min(
                    C.MAX_LABELS,
                    selectedRecords <= imageBudget ? C.MAX_LABELS : imageBudget,
                ) / slots,
            ),
        );
        const capacity = pagesPerSegment * slots;
        const count = Math.ceil((total + page.start) / capacity);
        index = Math.max(0, Math.min(count - 1, Math.trunc(index)));
        const begin = index === 0 ? 0 : index * capacity - page.start;
        const end = Math.min(total, (index + 1) * capacity - page.start);
        const output = [];
        let offset = 0;
        for (const record of records) {
            if (record.selected === false) continue;
            const next = offset + Number(record.quantity);
            const take =
                index === 0 && offset === 0
                    ? Math.max(0, Math.min(next, end))
                    : Math.max(0, Math.min(next, end) - Math.max(offset, begin));
            if (take) output.push({ ...record, quantity: take });
            offset = next;
            if (offset >= end) break;
        }
        const selectedProfile = C.clone(profile);
        if (index) selectedProfile.page.start = 0;
        return { index, count, total, begin, end, records: output, profile: selectedProfile };
    }
    return Object.freeze({ segment, append, sort, rememberManualOrder });
});
