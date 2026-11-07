/** Pure application model: templates, field binding, CSV, pagination and validation. */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.RLICore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const __ = (message, domain) => globalThis.wp?.i18n?.__(message, domain) ?? message;
    const sprintf = (format, ...values) => {
        if (globalThis.wp?.i18n?.sprintf) return globalThis.wp.i18n.sprintf(format, ...values);
        let index = 0;
        return format.replace(/%%|%(?:(\d+)\$)?s/g, (token, position) =>
            token === '%%' ? '%' : String(values[position ? Number(position) - 1 : index++]),
        );
    };

    const MAX_LABELS = 2000,
        MAX_RECORDS = 100000,
        MAX_ELEMENTS = 4096;
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const uid = () =>
        'rli-' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).slice(2));
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    const fields = [
        'id',
        'name',
        'parent_name',
        'sku',
        'barcode',
        'gtin',
        'price',
        'regular_price',
        'sale_price',
        'price_incl_tax',
        'price_excl_tax',
        'currency',
        'stock',
        'stock_status',
        'categories',
        'attributes',
        'weight',
        'length',
        'width',
        'height',
        'description',
        'short_description',
        'product_url',
        'image',
        'order.id',
        'order.number',
        'order.date',
        'order.total',
        'order.subtotal',
        'order.shipping',
        'order.tax',
        'order.discount',
        'order.status',
        'order.customer_note',
        'item.id',
        'item.name',
        'item.quantity',
        'item.total',
        'item.subtotal',
        'item.unit_price',
        'billing.name',
        'billing.first_name',
        'billing.last_name',
        'billing.company',
        'billing.address_1',
        'billing.address_2',
        'billing.city',
        'billing.state',
        'billing.postcode',
        'billing.country',
        'billing.email',
        'billing.phone',
        'shipping.name',
        'shipping.first_name',
        'shipping.last_name',
        'shipping.company',
        'shipping.address_1',
        'shipping.address_2',
        'shipping.city',
        'shipping.state',
        'shipping.postcode',
        'shipping.country',
        'shipping.phone',
        'shop.name',
        'shop.address',
        'date',
        'time',
    ];
    const aliases = {
        'product-id': 'id',
        'product-sku': 'sku',
        'product-global-unique-id': 'gtin',
        'product-name-main': 'parent_name',
        'product-name-variation': 'name',
        'product-description': 'description',
        'product-short-description': 'short_description',
        'actual-price': 'price',
        'regular-price': 'regular_price',
        'sale-price': 'sale_price',
        'actual-price-with-tax': 'price_incl_tax',
        'product-all-attr': 'attributes',
        'product-all-attr-with-names': 'attributes',
        'wc-category': 'categories',
        'order-id': 'order.id',
        'order-create-date': 'order.date',
        'order-total': 'order.total',
        'order-subtotal': 'order.subtotal',
        'order-tax': 'order.tax',
        'order-shipping': 'order.shipping',
        'order-item-name': 'item.name',
        'order-item-qty': 'item.quantity',
        'order-single-item-qty': 'item.quantity',
        'order-item-sku': 'sku',
        main_product_image_url: 'image',
        'product-image-url': 'image',
        'main-product-image-url': 'image',
        permalink: 'product_url',
    };
    function element(type = 'text', overrides = {}) {
        return Object.assign(
            {
                id: uid(),
                type,
                x: 2,
                y: 2,
                w: 35,
                h: 5,
                rotation: 0,
                content:
                    type === 'text' ? '{{name}}' : type === 'image' ? '{{image}}' : '{{sku|id}}',
                format: 'code128',
                ecc: 'M',
                showText: false,
                gs1: false,
                fontFamily: 'Arial',
                fontSize: 9,
                minFontSize: 5,
                autoFit: true,
                align: 'center',
                direction: 'inherit',
                vAlign: 'middle',
                bold: false,
                italic: false,
                underline: false,
                color: '#000000',
                background: 'transparent',
                strokeWidth: 0.25,
                prefix: '',
                suffix: '',
                transform: 'none',
                condition: '',
                visible: true,
                fit: 'contain',
            },
            overrides,
        );
    }
    function defaultDesign() {
        return {
            width: 50.8,
            height: 25.4,
            mode: 'visual',
            html: '',
            css: '',
            htmlBarcodeFormat: 'code128',
            htmlBarcodeSource: '{{sku|id}}',
            showCurrency: true,
            elements: [
                element('text', {
                    id: 'title',
                    x: 1.5,
                    y: 1,
                    w: 47.8,
                    h: 5.5,
                    content: '{{name}}',
                    bold: true,
                    fontSize: 10,
                }),
                element('barcode', {
                    id: 'barcode',
                    x: 1.5,
                    y: 7,
                    w: 47.8,
                    h: 9,
                    content: '{{sku|id}}',
                }),
                element('text', {
                    id: 'sku',
                    x: 1.5,
                    y: 16.5,
                    w: 47.8,
                    h: 3,
                    content: '{{sku}}',
                    fontSize: 7,
                }),
                element('text', {
                    id: 'price',
                    x: 1.5,
                    y: 20,
                    w: 47.8,
                    h: 4,
                    content: '{{price}}',
                    fontSize: 11,
                    bold: true,
                }),
            ],
        };
    }
    function defaultPage() {
        return {
            mode: 'roll',
            width: 50.8,
            height: 25.4,
            columns: 1,
            rows: 1,
            marginTop: 0,
            marginRight: 0,
            marginBottom: 0,
            marginLeft: 0,
            gapX: 0,
            gapY: 0,
            offsetX: 0,
            offsetY: 0,
            start: 0,
            flow: 'row',
            dpi: 300,
            outlines: false,
        };
    }
    function defaultProfile() {
        return {
            id: 'thermal-2x1',
            name: 'Thermal 2 × 1 inches',
            design: defaultDesign(),
            page: defaultPage(),
            quantityMode: 'one',
            roles: [],
        };
    }
    function defaultLibrary() {
        const base = defaultProfile();
        const sheet = clone(base);
        sheet.id = 'a4-65';
        sheet.name = 'A4 · 65 labels · 38.1 × 21.2 mm';
        sheet.design.width = 38.1;
        sheet.design.height = 21.2;
        sheet.design.elements.forEach((e) => {
            e.x *= 38.1 / 50.8;
            e.w *= 38.1 / 50.8;
            e.y *= 21.2 / 25.4;
            e.h *= 21.2 / 25.4;
        });
        Object.assign(sheet.page, {
            mode: 'sheet',
            width: 210,
            height: 297,
            columns: 5,
            rows: 13,
            marginLeft: 4.65,
            marginRight: 4.65,
            marginTop: 10.7,
            marginBottom: 10.7,
            gapX: 2.55,
            gapY: 0,
        });
        const qr = clone(base.design);
        qr.elements = [
            element('barcode', {
                id: 'qr',
                format: 'qrcode',
                x: 1,
                y: 1,
                w: 23,
                h: 23,
                content: '{{sku|id}}',
            }),
            element('text', {
                id: 'qr-name',
                x: 25,
                y: 2,
                w: 24,
                h: 11,
                content: '{{name}}',
                bold: true,
            }),
            element('text', {
                id: 'qr-price',
                x: 25,
                y: 15,
                w: 24,
                h: 7,
                content: '{{price}}',
                fontSize: 12,
            }),
        ];
        const image = clone(base.design);
        image.elements = [
            element('image', { id: 'product-image', x: 1, y: 1, w: 17, h: 17 }),
            element('text', { id: 'image-name', x: 19, y: 1, w: 30, h: 8, bold: true }),
            element('text', {
                id: 'image-price',
                x: 19,
                y: 10,
                w: 30,
                h: 5,
                content: '{{price}}',
                bold: true,
            }),
            element('barcode', {
                id: 'image-code',
                x: 1,
                y: 19,
                w: 48.8,
                h: 5,
                content: '{{sku|id}}',
            }),
        ];
        // Built-in card layout; use SKU for POS-compatible QR payload, never product URL.
        const qrCard = clone(base.design);
        qrCard.elements = [
            element('barcode', {
                id: 'qr',
                format: 'qrcode',
                x: 1.8,
                y: 1.4,
                w: 18.6,
                h: 18.6,
                content: '{{sku|id}}',
                showText: false,
            }),
            element('text', {
                id: 'qr-price',
                x: 22,
                y: 1.4,
                w: 27,
                h: 5.4,
                content: '{{price}}',
                fontSize: 12,
                minFontSize: 7,
                align: 'left',
            }),
            element('text', {
                id: 'qr-name',
                x: 22,
                y: 7.2,
                w: 27,
                h: 15.8,
                content: '{{name}}',
                fontSize: 9,
                minFontSize: 5,
                align: 'left',
                vAlign: 'top',
            }),
            element('text', {
                id: 'qr-sku',
                x: 1.2,
                y: 20.1,
                w: 19.8,
                h: 3.5,
                content: '{{sku|id}}',
                fontSize: 7,
                minFontSize: 5,
                align: 'center',
            }),
        ];
        return {
            schema: 1,
            revision: 0,
            defaultProfile: base.id,
            profiles: [base, sheet],
            templates: [
                {
                    id: 'basic',
                    name: __('Product barcode', 'ramsey-labels-independent'),
                    design: clone(base.design),
                },
                { id: 'qr', name: __('QR with text', 'ramsey-labels-independent'), design: qr },
                {
                    id: 'image',
                    name: __('Product image with barcode', 'ramsey-labels-independent'),
                    design: image,
                },
                {
                    id: 'qr-card',
                    name: __('QR left · price/name right · SKU below', 'ramsey-labels-independent'),
                    design: qrCard,
                },
            ],
            papers: [
                { id: 'a4', name: 'A4', width: 210, height: 297 },
                {
                    id: 'letter',
                    name: __('US Letter', 'ramsey-labels-independent'),
                    width: 215.9,
                    height: 279.4,
                },
                { id: 'p4', name: 'P4', width: 215, height: 280 },
            ],
        };
    }
    function resolveToken(raw, values) {
        for (let key of raw.split('|').map((s) => s.trim())) {
            key = aliases[key] || key;
            if (
                Object.prototype.hasOwnProperty.call(values, key) &&
                values[key] !== null &&
                values[key] !== undefined &&
                String(values[key]) !== ''
            )
                return String(values[key]);
        }
        return '';
    }
    function legacyKey(key, args) {
        if (['barcode_image', 'barcode_img_url'].includes(key)) return 'barcode_image';
        if (aliases[key]) return aliases[key];
        if (/^(billing|shipping)-/.test(key.replace(/^order-/, '')))
            return key
                .replace(/^order-/, '')
                .replace(/-/, '.')
                .replace(/-/g, '_');
        if (
            [
                'name',
                'sku',
                'id',
                'price',
                'barcode',
                'line1',
                'line2',
                'line3',
                'line4',
                'date',
                'time',
            ].includes(key)
        )
            return key;
        const prefixes = {
            cf: 'meta:',
            attr: 'attr:',
            'order-custom-field': 'order_meta:',
            'order-item-meta-field': 'item_meta:',
            taxonomy: 'tax:',
        };
        const match = String(args || '').match(
            /(?:value|name)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/,
        );
        return prefixes[key] && match ? prefixes[key] + (match[1] || match[2] || match[3]) : null;
    }
    function legacyArgs(args, direct) {
        return direct === undefined
            ? args
            : /^(?:value|name)=/.test(direct)
              ? direct
              : 'value=' + direct;
    }
    function resolve(text, record, options = {}) {
        const values = record.values || record;
        const source = String(text || '');
        let length = source.length;
        const bounded = (full, value) => {
            value = options.escape ? options.escape(value) : value;
            length += value.length - full.length;
            if (length > (options.maxLength || 20000))
                throw Error(
                    __(
                        'Resolved label text exceeds its rendering budget.',
                        'ramsey-labels-independent',
                    ),
                );
            return value;
        };
        if (length > (options.maxLength || 20000))
            throw Error(
                __('Template text exceeds its rendering budget.', 'ramsey-labels-independent'),
            );
        // Parse only the original template: product/customer values are data, not nested expressions.
        return source.replace(
            /\{\{([^{}]+)\}\}|\[([a-zA-Z][\w-]*)(?:\s+([^\]]*)|=([^\]]*))?\]/g,
            (full, curly, key, args, direct) => {
                if (curly) return bounded(full, resolveToken(curly, values));
                args = legacyArgs(args, direct);
                const token = legacyKey(key, args);
                if (!token) return full;
                let value = resolveToken(token, values);
                const before = String(args || '').match(/before=['"]([^'"]*)['"]/),
                    after = String(args || '').match(/after=['"]([^'"]*)['"]/);
                if (value) value = (before ? before[1] : '') + value + (after ? after[1] : '');
                return bounded(full, value);
            },
        );
    }
    function requestedFields(design) {
        const output = new Set(fields);
        const strings = [
            design.html,
            design.css,
            design.htmlBarcodeSource,
            ...design.elements.flatMap((e) => [e.content, e.condition]),
        ];
        strings.forEach((text) =>
            String(text || '').replace(/\{\{([^{}]+)\}\}/g, (_, raw) => {
                raw.split('|').forEach((f) => output.add(f.trim()));
                return '';
            }),
        );
        strings.forEach((text) =>
            String(text || '').replace(
                /\[([a-zA-Z][\w-]*)(?:\s+([^\]]*)|=([^\]]*))?\]/g,
                (_, key, args, direct) => {
                    const field = legacyKey(key, legacyArgs(args, direct));
                    if (field) output.add(field);
                    return '';
                },
            ),
        );
        return Array.from(output);
    }
    function validateDesign(design) {
        const errors = [];
        if (!design || typeof design !== 'object')
            return [__('Missing design.', 'ramsey-labels-independent')];
        for (const key of ['width', 'height'])
            if (
                !Number.isFinite(Number(design[key])) ||
                Number(design[key]) < 5 ||
                Number(design[key]) > 500
            )
                errors.push(
                    /* translators: %1$s: key. */
                    sprintf(__('Label %s must be 5–500 mm.', 'ramsey-labels-independent'), key),
                );
        if (!['visual', 'html'].includes(design.mode || 'visual'))
            errors.push(__('Invalid design mode.', 'ramsey-labels-independent'));
        if (design.showCurrency !== undefined && typeof design.showCurrency !== 'boolean')
            errors.push(
                __('Invalid currency symbol visibility setting.', 'ramsey-labels-independent'),
            );
        if (!Array.isArray(design.elements) || design.elements.length > MAX_ELEMENTS)
            return errors.concat(
                sprintf(
                    /* translators: %s: maximum design element count. */
                    __('Use at most %s elements.', 'ramsey-labels-independent'),
                    MAX_ELEMENTS,
                ),
            );
        const ids = new Set();
        for (const e of design.elements) {
            if (!e.id || ids.has(e.id))
                errors.push(__('Element IDs must be unique.', 'ramsey-labels-independent'));
            ids.add(e.id);
            if (!['text', 'barcode', 'image', 'rect', 'line', 'ellipse'].includes(e.type))
                errors.push(__('Invalid element type.', 'ramsey-labels-independent'));
            if (!['inherit', 'ltr', 'rtl'].includes(e.direction || 'inherit'))
                errors.push(__('Invalid text direction.', 'ramsey-labels-independent'));
            for (const key of [
                'x',
                'y',
                'w',
                'h',
                'rotation',
                'fontSize',
                'minFontSize',
                'strokeWidth',
            ])
                if (!Number.isFinite(Number(e[key])))
                    errors.push(
                        /* translators: %1$s: e.id; %2$s: key. */
                        sprintf(
                            /* translators: element identifier; invalid field name. */ __(
                                'Element %1$s has an invalid %2$s.',
                                'ramsey-labels-independent',
                            ),
                            e.id,
                            key,
                        ),
                    );
            if (e.w <= 0 || e.h <= 0)
                errors.push(
                    /* translators: %1$s: e.id. */
                    sprintf(
                        /* translators: element identifier. */ __(
                            'Element %s must have positive dimensions.',
                            'ramsey-labels-independent',
                        ),
                        e.id,
                    ),
                );
            if (
                e.x < -0.01 ||
                e.y < -0.01 ||
                e.x + e.w > design.width + 0.01 ||
                e.y + e.h > design.height + 0.01
            )
                errors.push(
                    /* translators: %1$s: e.id. */
                    sprintf(
                        __('Element %s is outside the label.', 'ramsey-labels-independent'),
                        e.id,
                    ),
                );
            if (!/^#[0-9a-f]{6}$/i.test(e.color || '#000000'))
                errors.push(__('Invalid element color.', 'ramsey-labels-independent'));
        }
        return Array.from(new Set(errors));
    }
    function geometry(profile) {
        const p = Object.assign(defaultPage(), profile.page),
            d = profile.design;
        if (p.mode === 'roll')
            return Object.assign(p, {
                width: d.width,
                height: d.height,
                columns: 1,
                rows: 1,
                marginLeft: 0,
                marginRight: 0,
                marginTop: 0,
                marginBottom: 0,
                gapX: 0,
                gapY: 0,
                start: 0,
            });
        return p;
    }
    function validatePage(profile) {
        const p = geometry(profile),
            d = profile.design,
            errors = [];
        for (const key of [
            'width',
            'height',
            'columns',
            'rows',
            'marginTop',
            'marginRight',
            'marginBottom',
            'marginLeft',
            'gapX',
            'gapY',
            'offsetX',
            'offsetY',
            'start',
            'dpi',
        ])
            if (!Number.isFinite(Number(p[key])))
                errors.push(
                    /* translators: %1$s: key. */
                    sprintf(__('Invalid page value: %s', 'ramsey-labels-independent'), key),
                );
        if (p.width < 5 || p.width > 1000 || p.height < 5 || p.height > 1000)
            errors.push(__('Page dimensions must be 5–1,000 mm.', 'ramsey-labels-independent'));
        if (
            !Number.isInteger(p.columns) ||
            !Number.isInteger(p.rows) ||
            p.columns < 1 ||
            p.rows < 1 ||
            p.columns * p.rows > 1000
        )
            errors.push(
                __(
                    'Use positive whole rows and columns, at most 1,000 slots.',
                    'ramsey-labels-independent',
                ),
            );
        if (!Number.isInteger(p.start) || p.start < 0 || p.start >= p.columns * p.rows)
            errors.push(
                __(
                    'Skipped slots must be less than the number of labels per sheet.',
                    'ramsey-labels-independent',
                ),
            );
        if (
            p.columns * d.width + (p.columns - 1) * p.gapX + p.marginLeft + p.marginRight >
            p.width + 0.02
        )
            errors.push(
                __(
                    'Labels and horizontal gaps/margins do not fit the page width.',
                    'ramsey-labels-independent',
                ),
            );
        if (
            p.rows * d.height + (p.rows - 1) * p.gapY + p.marginTop + p.marginBottom >
            p.height + 0.02
        )
            errors.push(
                __(
                    'Labels and vertical gaps/margins do not fit the page height.',
                    'ramsey-labels-independent',
                ),
            );
        if (p.dpi < 72 || p.dpi > 600)
            errors.push(__('Resolution must be 72–600 dpi.', 'ramsey-labels-independent'));
        for (const k of ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gapX', 'gapY'])
            if (p[k] < 0)
                errors.push(
                    __('Margins and gaps cannot be negative.', 'ramsey-labels-independent'),
                );
        return errors;
    }
    function paginate(records, profile, options = {}) {
        if (!Array.isArray(records) || (!options.segmented && records.length > MAX_RECORDS))
            throw new Error(
                /* translators: %1$s: MAX_RECORDS. */
                sprintf(
                    /* translators: maximum records in this request. */ __(
                        'Use at most %s records per print job.',
                        'ramsey-labels-independent',
                    ),
                    MAX_RECORDS,
                ),
            );
        const errors = validatePage(profile);
        if (errors.length) throw new Error(errors.join('\n'));
        const p = geometry(profile),
            slots = p.columns * p.rows,
            pages = [],
            total = records.reduce(
                (sum, r) => sum + (r.selected === false ? 0 : Number(r.quantity)),
                0,
            );
        if (!Number.isSafeInteger(total) || total < 1 || (!options.segmented && total > MAX_LABELS))
            throw new Error(
                /* translators: %1$s: MAX_LABELS. */
                sprintf(
                    /* translators: maximum labels per segment. */ __(
                        'Select between 1 and %s labels per print job.',
                        'ramsey-labels-independent',
                    ),
                    MAX_LABELS,
                ),
            );
        let absolute = p.start;
        records.forEach((record, recordIndex) => {
            if (record.selected === false) return;
            if (
                !Number.isInteger(Number(record.quantity)) ||
                Number(record.quantity) < 1 ||
                !Number.isSafeInteger(Number(record.quantity)) ||
                (!options.segmented && Number(record.quantity) > MAX_LABELS)
            )
                throw new Error(
                    /* translators: %1$s: record.values.name || record.key. */
                    sprintf(
                        /* translators: record name. */ __(
                            'Invalid quantity for %s',
                            'ramsey-labels-independent',
                        ),
                        record.values.name || record.key,
                    ),
                );
            for (let copy = 0; copy < record.quantity; copy++, absolute++) {
                const page = Math.floor(absolute / slots),
                    slot = absolute % slots;
                if (!pages[page]) pages[page] = [];
                const column = p.flow === 'column' ? Math.floor(slot / p.rows) : slot % p.columns;
                const row = p.flow === 'column' ? slot % p.rows : Math.floor(slot / p.columns);
                pages[page].push({
                    recordIndex,
                    copy,
                    quantity: options.segmented ? Number(record.quantity) : 1,
                    x: p.marginLeft + p.offsetX + column * (profile.design.width + p.gapX),
                    y: p.marginTop + p.offsetY + row * (profile.design.height + p.gapY),
                });
            }
        });
        return { pages, page: p, total };
    }
    /** RFC4180-style parser. Leading zeros are preserved; malformed quotes are rejected. */
    function parseCSV(text, delimiter = ',') {
        text = String(text).replace(/^\uFEFF/, '');
        if (text.length > 8000000)
            throw new Error(
                __('CSV exceeds the 8 MB transfer budget.', 'ramsey-labels-independent'),
            );
        if (![',', ';', '\t'].includes(delimiter))
            throw new Error(__('Unsupported delimiter.', 'ramsey-labels-independent'));
        const rows = [];
        let row = [],
            field = '',
            quoted = false,
            closed = false;
        for (let i = 0; i <= text.length; i++) {
            const c = i === text.length ? null : text[i];
            if (quoted) {
                if (c === null)
                    throw new Error(__('Unclosed quoted CSV field.', 'ramsey-labels-independent'));
                if (c === '"') {
                    if (text[i + 1] === '"') {
                        field += '"';
                        i++;
                    } else {
                        quoted = false;
                        closed = true;
                    }
                } else field += c;
            } else if (c === delimiter || c === '\r' || c === '\n' || c === null) {
                row.push(field);
                field = '';
                closed = false;
                if (c !== delimiter) {
                    if (row.some((v) => v !== '')) rows.push(row);
                    row = [];
                    if (c === '\r' && text[i + 1] === '\n') i++;
                }
            } else if (c === '"') {
                if (field || closed)
                    throw new Error(__('Unexpected quote in CSV.', 'ramsey-labels-independent'));
                quoted = true;
            } else {
                if (closed)
                    throw new Error(
                        __(
                            'Unexpected text after a closing CSV quote.',
                            'ramsey-labels-independent',
                        ),
                    );
                field += c;
            }
        }
        if (!rows.length) return [];
        const headers = rows.shift().map((h) => h.trim());
        if (
            headers.some(
                (h) =>
                    !h ||
                    !/^[\w.:-]+$/.test(h) ||
                    ['__proto__', 'prototype', 'constructor'].includes(h),
            )
        )
            throw new Error(
                __(
                    'Headers must be non-empty field names (letters, digits, dots, colons, underscores or hyphens).',
                    'ramsey-labels-independent',
                ),
            );
        if (new Set(headers).size !== headers.length)
            throw new Error(__('Duplicate CSV column name.', 'ramsey-labels-independent'));
        if (rows.length > 100000)
            throw new Error(
                /* translators: %1$s: MAX_RECORDS. */
                sprintf(
                    /* translators: %s: CSV rows allowed per import. */
                    __('At most %s CSV records are allowed.', 'ramsey-labels-independent'),
                    100000,
                ),
            );
        return rows.map((r, index) => {
            if (r.length !== headers.length)
                throw new Error(
                    'Row ' +
                        (index + 2) +
                        ' has ' +
                        r.length +
                        ' cells; expected ' +
                        headers.length +
                        '.',
                );
            const result = Object.create(null);
            headers.forEach((key, i) => {
                result[key] = r[i];
            });
            if (result._rli_csv_escaped === '1')
                for (const key of headers)
                    if (result[key].startsWith("'")) result[key] = result[key].slice(1);
            delete result._rli_csv_escaped;
            return result;
        });
    }
    function csvRecords(text, delimiter = ',', options = {}) {
        return parseCSV(text, delimiter).map((values, i) => {
            const raw =
                values.quantity === undefined || values.quantity === '' ? '1' : values.quantity;
            if (
                !/^\d+$/.test(raw) ||
                !Number.isSafeInteger(Number(raw)) ||
                Number(raw) < 1 ||
                Number(raw) > (options.segmented ? Number.MAX_SAFE_INTEGER : MAX_LABELS)
            )
                throw new Error(
                    /* translators: %1$s: i + 2. */
                    sprintf(
                        /* translators: CSV row number. */ __(
                            'Invalid quantity in CSV row %s.',
                            'ramsey-labels-independent',
                        ),
                        i + 2,
                    ),
                );
            const quantity = Number(raw);
            delete values.quantity;
            if (!values.name)
                values.name =
                    values.sku ||
                    values.barcode /* translators: %1$s: i + 1. */ ||
                    sprintf(
                        /* translators: CSV row number. */ __(
                            'Manual label %s',
                            'ramsey-labels-independent',
                        ),
                        i + 1,
                    );
            return { key: uid(), source: 'manual', values, quantity, selected: true };
        });
    }
    function exportCSV(records) {
        const fields = new Set(['quantity', 'name', 'sku', 'barcode', 'price']);
        records.forEach((r) => Object.keys(r.values).forEach((k) => fields.add(k)));
        const keys = Array.from(fields).filter((k) => k !== '_rli_csv_escaped');
        keys.push('_rli_csv_escaped');
        const quote = (text) => '"' + String(text).replace(/"/g, '""') + '"';
        const lines = [keys.map(quote).join(',')];
        records.forEach((r) => {
            const values = Object.assign({}, r.values, {
                quantity: String(r.quantity),
                _rli_csv_escaped: '1',
            });
            lines.push(
                keys
                    .map((key) => {
                        let v = String(values[key] === undefined ? '' : values[key]);
                        if (/^[=+\-@\t\r']/.test(v)) v = "'" + v;
                        return quote(v);
                    })
                    .join(','),
            );
        });
        return '\uFEFF' + lines.join('\r\n') + '\r\n';
    }
    function validateLibrary(library) {
        if (
            !library ||
            library.schema !== 1 ||
            !Array.isArray(library.profiles) ||
            !library.profiles.length ||
            !Array.isArray(library.templates) ||
            !Array.isArray(library.papers)
        )
            throw new Error(
                __(
                    'Invalid Ramsey Labels library (schema 1 and valid collections required).',
                    'ramsey-labels-independent',
                ),
            );
        const ids = new Set();
        if (new TextEncoder().encode(JSON.stringify(library)).byteLength > 2200000)
            throw Error(
                __(
                    'Library exceeds the 2.2 MB document budget. Export or split the document before saving.',
                    'ramsey-labels-independent',
                ),
            );
        library.profiles.forEach((p) => {
            if (!p.id || ids.has(p.id))
                throw new Error(__('Duplicate/missing profile ID.', 'ramsey-labels-independent'));
            ids.add(p.id);
            const errors = validateDesign(p.design).concat(validatePage(p));
            if (errors.length) throw new Error(p.name + ': ' + errors.join(' '));
        });
        library.templates.forEach((t) => {
            const errors = validateDesign(t.design);
            if (errors.length) throw new Error(t.name + ': ' + errors.join(' '));
        });
        if (!ids.has(library.defaultProfile))
            throw new Error(__('Default profile does not exist.', 'ramsey-labels-independent'));
        return library;
    }
    return Object.freeze({
        MAX_LABELS,
        MAX_RECORDS,
        MAX_ELEMENTS,
        uid,
        clone,
        clamp,
        fields,
        aliases,
        element,
        defaultDesign,
        defaultPage,
        defaultProfile,
        defaultLibrary,
        resolve,
        requestedFields,
        validateDesign,
        geometry,
        validatePage,
        paginate,
        parseCSV,
        csvRecords,
        exportCSV,
        validateLibrary,
    });
});
