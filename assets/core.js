/** Pure application model: templates, field binding, CSV, pagination and validation. */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.RLICore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const MAX_LABELS = 2000, MAX_RECORDS = 1000, MAX_ELEMENTS = 80;
    const clone = value => JSON.parse(JSON.stringify(value));
    const uid = () => 'rli-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    const fields = ['id', 'name', 'parent_name', 'sku', 'barcode', 'gtin', 'price', 'regular_price', 'sale_price', 'price_incl_tax', 'price_excl_tax', 'currency', 'stock', 'stock_status', 'categories', 'attributes', 'weight', 'length', 'width', 'height', 'description', 'short_description', 'product_url', 'image', 'order.id', 'order.number', 'order.date', 'order.total', 'order.subtotal', 'order.shipping', 'order.tax', 'order.discount', 'order.status', 'order.customer_note', 'item.id', 'item.name', 'item.quantity', 'item.total', 'item.subtotal', 'item.unit_price', 'billing.name', 'billing.first_name', 'billing.last_name', 'billing.company', 'billing.address_1', 'billing.address_2', 'billing.city', 'billing.state', 'billing.postcode', 'billing.country', 'billing.email', 'billing.phone', 'shipping.name', 'shipping.first_name', 'shipping.last_name', 'shipping.company', 'shipping.address_1', 'shipping.address_2', 'shipping.city', 'shipping.state', 'shipping.postcode', 'shipping.country', 'shipping.phone', 'shop.name', 'shop.address', 'date', 'time'];
    const aliases = {'product-id':'id', 'product-sku':'sku', 'product-global-unique-id':'gtin', 'product-name-main':'parent_name', 'product-name-variation':'name', 'product-description':'description', 'product-short-description':'short_description', 'actual-price':'price', 'regular-price':'regular_price', 'sale-price':'sale_price', 'actual-price-with-tax':'price_incl_tax', 'product-all-attr':'attributes', 'product-all-attr-with-names':'attributes', 'wc-category':'categories', 'order-id':'order.id', 'order-create-date':'order.date', 'order-total':'order.total', 'order-subtotal':'order.subtotal', 'order-tax':'order.tax', 'order-shipping':'order.shipping', 'order-item-name':'item.name', 'order-item-qty':'item.quantity', 'order-single-item-qty':'item.quantity', 'order-item-sku':'sku', 'main_product_image_url':'image', 'product-image-url':'image', 'main-product-image-url':'image', 'permalink':'product_url'};
    function element(type = 'text', overrides = {}) {
        return Object.assign({id: uid(), type, x: 2, y: 2, w: 35, h: 5, rotation: 0, content: type === 'text' ? '{{name}}' : type === 'image' ? '{{image}}' : '{{sku|id}}', format: 'code128', ecc: 'M', showText: false, gs1: false, fontFamily: 'Arial', fontSize: 9, minFontSize: 5, autoFit: true, align: 'center', vAlign: 'middle', bold: false, italic: false, underline: false, color: '#000000', background: 'transparent', strokeWidth: 0.25, prefix: '', suffix: '', transform: 'none', condition: '', visible: true, fit: 'contain'}, overrides);
    }
    function defaultDesign() {
        return {width: 50.8, height: 25.4, mode: 'visual', html: '', css: '', htmlBarcodeFormat: 'code128', htmlBarcodeSource: '{{sku|id}}', elements: [
            element('text', {id: 'title', x: 1.5, y: 1, w: 47.8, h: 5.5, content: '{{name}}', bold: true, fontSize: 10}),
            element('barcode', {id: 'barcode', x: 1.5, y: 7, w: 47.8, h: 9, content: '{{sku|id}}'}),
            element('text', {id: 'sku', x: 1.5, y: 16.5, w: 47.8, h: 3, content: '{{sku}}', fontSize: 7}),
            element('text', {id: 'price', x: 1.5, y: 20, w: 47.8, h: 4, content: '{{price}}', fontSize: 11, bold: true})
        ]};
    }
    function defaultPage() {
        return {mode: 'roll', width: 50.8, height: 25.4, columns: 1, rows: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, gapX: 0, gapY: 0, offsetX: 0, offsetY: 0, start: 0, flow: 'row', dpi: 300, outlines: false};
    }
    function defaultProfile() { return {id: 'thermal-2x1', name: 'Thermal 2 × 1 inches', design: defaultDesign(), page: defaultPage(), quantityMode: 'one', roles: []}; }
    function defaultLibrary() {
        const base = defaultProfile();
        const sheet = clone(base); sheet.id = 'a4-65'; sheet.name = 'A4 · 65 labels · 38.1 × 21.2 mm';
        sheet.design.width = 38.1; sheet.design.height = 21.2;
        sheet.design.elements.forEach(e => { e.x *= 38.1 / 50.8; e.w *= 38.1 / 50.8; e.y *= 21.2 / 25.4; e.h *= 21.2 / 25.4; });
        Object.assign(sheet.page, {mode: 'sheet', width: 210, height: 297, columns: 5, rows: 13, marginLeft: 4.65, marginRight: 4.65, marginTop: 10.7, marginBottom: 10.7, gapX: 2.55, gapY: 0});
        const qr = clone(base.design); qr.elements = [element('barcode', {id:'qr',format:'qrcode',x:1,y:1,w:23,h:23,content:'{{sku|id}}'}),element('text',{id:'qr-name',x:25,y:2,w:24,h:11,content:'{{name}}',bold:true}),element('text',{id:'qr-price',x:25,y:15,w:24,h:7,content:'{{price}}',fontSize:12})];
        const image = clone(base.design); image.elements = [element('image',{id:'product-image',x:1,y:1,w:17,h:17}),element('text',{id:'image-name',x:19,y:1,w:30,h:8,bold:true}),element('text',{id:'image-price',x:19,y:10,w:30,h:5,content:'{{price}}',bold:true}),element('barcode',{id:'image-code',x:1,y:19,w:48.8,h:5,content:'{{sku|id}}'})];
        // Built-in card layout; use SKU for POS-compatible QR payload, never product URL.
        const qrCard = clone(base.design);
        qrCard.elements = [
            element('barcode',{id:'qr',format:'qrcode',x:1.8,y:1.4,w:18.6,h:18.6,content:'{{sku|id}}',showText:false}),
            element('text',{id:'qr-price',x:22,y:1.4,w:27,h:5.4,content:'{{price}}',fontSize:12,minFontSize:7,align:'left'}),
            element('text',{id:'qr-name',x:22,y:7.2,w:27,h:15.8,content:'{{name}}',fontSize:9,minFontSize:5,align:'left',vAlign:'top'}),
            element('text',{id:'qr-sku',x:1.2,y:20.1,w:19.8,h:3.5,content:'{{sku|id}}',fontSize:7,minFontSize:5,align:'center'})
        ];
        return {schema: 1, revision: 0, defaultProfile: base.id, profiles: [base, sheet], templates: [{id:'basic',name:'Product barcode',design:clone(base.design)},{id:'qr',name:'QR with text',design:qr},{id:'image',name:'Product image with barcode',design:image},{id:'qr-card',name:'QR left · price/name right · SKU below',design:qrCard}], papers: [{id:'a4',name:'A4',width:210,height:297},{id:'letter',name:'US Letter',width:215.9,height:279.4},{id:'p4',name:'P4',width:215,height:280}]};
    }
    function resolveToken(raw, values) {
        for (let key of raw.split('|').map(s => s.trim())) {
            key = aliases[key] || key;
            if (Object.prototype.hasOwnProperty.call(values, key) && values[key] !== null && values[key] !== undefined && String(values[key]) !== '') return String(values[key]);
        }
        return '';
    }
    function resolve(text, record) {
        const values = record.values || record;
        return String(text || '').replace(/\{\{([^{}]+)\}\}/g, (_, key) => resolveToken(key, values)).replace(/\[([a-zA-Z][\w-]*)(?:\s+([^\]]*))?\]/g, (full, key, args) => {
            let token = aliases[key];
            if (!token && /^(billing|shipping)-/.test(key.replace(/^order-/, ''))) token = key.replace(/^order-/, '').replace(/-/, '.').replace(/-/g, '_');
            if (!token && ['name','sku','id','price','barcode','line1','line2','line3','line4'].includes(key)) token = key;
            if (!token && ['cf','attr','order-custom-field','order-item-meta-field'].includes(key)) {
                const match = String(args || '').match(/(?:value|name)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/);
                if (match) token = ({cf:'meta:',attr:'attr:','order-custom-field':'order_meta:','order-item-meta-field':'item_meta:'}[key]) + (match[1] || match[2] || match[3]);
            }
            if (!token) return full;
            let value = resolveToken(token, values);
            const before = String(args || '').match(/before=['"]([^'"]*)['"]/), after = String(args || '').match(/after=['"]([^'"]*)['"]/);
            if (value) value = (before ? before[1] : '') + value + (after ? after[1] : '');
            return value;
        });
    }
    function requestedFields(design) {
        const output = new Set(fields);
        const strings = [design.html, design.css, design.htmlBarcodeSource, ...design.elements.flatMap(e => [e.content, e.condition])];
        strings.forEach(text => String(text || '').replace(/\{\{([^{}]+)\}\}/g, (_, raw) => { raw.split('|').forEach(f => output.add(f.trim())); return ''; }));
        return Array.from(output);
    }
    function validateDesign(design) {
        const errors = [];
        if (!design || typeof design !== 'object') return ['Missing design.'];
        for (const key of ['width','height']) if (!Number.isFinite(Number(design[key])) || Number(design[key]) < 5 || Number(design[key]) > 500) errors.push('Label ' + key + ' must be 5–500 mm.');
        if (!['visual','html'].includes(design.mode || 'visual')) errors.push('Invalid design mode.');
        if (!Array.isArray(design.elements) || design.elements.length > MAX_ELEMENTS) return errors.concat('Use at most ' + MAX_ELEMENTS + ' elements.');
        const ids = new Set();
        for (const e of design.elements) {
            if (!e.id || ids.has(e.id)) errors.push('Element IDs must be unique.'); ids.add(e.id);
            if (!['text','barcode','image','rect','line','ellipse'].includes(e.type)) errors.push('Invalid element type.');
            for (const key of ['x','y','w','h','rotation','fontSize','minFontSize','strokeWidth']) if (!Number.isFinite(Number(e[key]))) errors.push('Element ' + e.id + ' has an invalid ' + key + '.');
            if (e.w <= 0 || e.h <= 0) errors.push('Element ' + e.id + ' must have positive dimensions.');
            if (e.x < -0.01 || e.y < -0.01 || e.x + e.w > design.width + 0.01 || e.y + e.h > design.height + 0.01) errors.push('Element ' + e.id + ' is outside the label.');
            if (!/^#[0-9a-f]{6}$/i.test(e.color || '#000000')) errors.push('Invalid element color.');
        }
        return Array.from(new Set(errors));
    }
    function geometry(profile) {
        const p = Object.assign(defaultPage(), profile.page), d = profile.design;
        if (p.mode === 'roll') return Object.assign(p, {width: d.width, height: d.height, columns: 1, rows: 1, marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0, gapX: 0, gapY: 0, start: 0});
        return p;
    }
    function validatePage(profile) {
        const p = geometry(profile), d = profile.design, errors = [];
        for (const key of ['width','height','columns','rows','marginTop','marginRight','marginBottom','marginLeft','gapX','gapY','offsetX','offsetY','start','dpi']) if (!Number.isFinite(Number(p[key]))) errors.push('Invalid page value: ' + key);
        if (p.width < 5 || p.width > 1000 || p.height < 5 || p.height > 1000) errors.push('Page dimensions must be 5–1,000 mm.');
        if (!Number.isInteger(p.columns) || !Number.isInteger(p.rows) || p.columns < 1 || p.rows < 1 || p.columns * p.rows > 1000) errors.push('Use positive whole rows and columns, at most 1,000 slots.');
        if (!Number.isInteger(p.start) || p.start < 0 || p.start >= p.columns * p.rows) errors.push('Skipped slots must be less than the number of labels per sheet.');
        if (p.columns * d.width + (p.columns - 1) * p.gapX + p.marginLeft + p.marginRight > p.width + 0.02) errors.push('Labels and horizontal gaps/margins do not fit the page width.');
        if (p.rows * d.height + (p.rows - 1) * p.gapY + p.marginTop + p.marginBottom > p.height + 0.02) errors.push('Labels and vertical gaps/margins do not fit the page height.');
        if (p.dpi < 72 || p.dpi > 600) errors.push('Resolution must be 72–600 dpi.');
        for (const k of ['marginTop','marginRight','marginBottom','marginLeft','gapX','gapY']) if (p[k] < 0) errors.push('Margins and gaps cannot be negative.');
        return errors;
    }
    function paginate(records, profile) {
        const errors = validatePage(profile);
        if (errors.length) throw new Error(errors.join('\n'));
        const p = geometry(profile), slots = p.columns * p.rows, pages = [], total = records.reduce((sum, r) => sum + (r.selected === false ? 0 : Number(r.quantity)), 0);
        if (!Number.isInteger(total) || total < 1 || total > MAX_LABELS) throw new Error('Select between 1 and ' + MAX_LABELS + ' labels per print job.');
        let absolute = p.start;
        records.forEach((record, recordIndex) => {
            if (record.selected === false) return;
            if (!Number.isInteger(Number(record.quantity)) || Number(record.quantity) < 1 || Number(record.quantity) > MAX_LABELS) throw new Error('Invalid quantity for ' + (record.values.name || record.key));
            for (let copy = 0; copy < record.quantity; copy++, absolute++) {
                const page = Math.floor(absolute / slots), slot = absolute % slots;
                if (!pages[page]) pages[page] = [];
                const column = p.flow === 'column' ? Math.floor(slot / p.rows) : slot % p.columns;
                const row = p.flow === 'column' ? slot % p.rows : Math.floor(slot / p.columns);
                pages[page].push({recordIndex, copy, x: p.marginLeft + p.offsetX + column * (profile.design.width + p.gapX), y: p.marginTop + p.offsetY + row * (profile.design.height + p.gapY)});
            }
        });
        return {pages, page: p, total};
    }
    /** RFC4180-style parser. Leading zeros are preserved; malformed quotes are rejected. */
    function parseCSV(text, delimiter = ',') {
        text = String(text).replace(/^\uFEFF/, '');
        if (text.length > 2000000) throw new Error('CSV exceeds the 2 MB limit.');
        if (![',',';','\t'].includes(delimiter)) throw new Error('Unsupported delimiter.');
        const rows = []; let row = [], field = '', quoted = false, closed = false;
        for (let i = 0; i <= text.length; i++) {
            const c = i === text.length ? null : text[i];
            if (quoted) {
                if (c === null) throw new Error('Unclosed quoted CSV field.');
                if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
                else field += c;
            } else if (c === delimiter || c === '\r' || c === '\n' || c === null) {
                row.push(field); field = ''; closed = false;
                if (c !== delimiter) { if (row.some(v => v !== '')) rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
            } else if (c === '"') {
                if (field || closed) throw new Error('Unexpected quote in CSV.'); quoted = true;
            } else { if (closed) throw new Error('Unexpected text after a closing CSV quote.'); field += c; }
        }
        if (!rows.length) return [];
        const headers = rows.shift().map(h => h.trim());
        if (headers.some(h => !h || !/^[\w.:-]+$/.test(h) || ['__proto__','prototype','constructor'].includes(h))) throw new Error('Headers must be non-empty field names (letters, digits, dots, colons, underscores or hyphens).');
        if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV column name.');
        if (rows.length > MAX_RECORDS) throw new Error('At most ' + MAX_RECORDS + ' CSV records are allowed.');
        return rows.map((r, index) => {
            if (r.length !== headers.length) throw new Error('Row ' + (index + 2) + ' has ' + r.length + ' cells; expected ' + headers.length + '.');
            const result = Object.create(null); headers.forEach((key, i) => { result[key] = r[i]; });
            if (result._rli_csv_escaped === '1') for (const key of headers) if (result[key].startsWith("'")) result[key] = result[key].slice(1);
            delete result._rli_csv_escaped;
            return result;
        });
    }
    function csvRecords(text, delimiter = ',') {
        return parseCSV(text, delimiter).map((values, i) => {
            const raw = values.quantity === undefined || values.quantity === '' ? '1' : values.quantity;
            if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > MAX_LABELS) throw new Error('Invalid quantity in CSV row ' + (i + 2) + '.');
            const quantity = Number(raw); delete values.quantity;
            if (!values.name) values.name = values.sku || values.barcode || 'Manual label ' + (i + 1);
            return {key: uid(), source: 'manual', values, quantity, selected: true};
        });
    }
    function exportCSV(records) {
        const fields = new Set(['quantity','name','sku','barcode','price']);
        records.forEach(r => Object.keys(r.values).forEach(k => fields.add(k)));
        const keys = Array.from(fields).filter(k => k !== '_rli_csv_escaped'); keys.push('_rli_csv_escaped');
        const quote = text => '"' + String(text).replace(/"/g, '""') + '"';
        const lines = [keys.map(quote).join(',')];
        records.forEach(r => {
            const values = Object.assign({}, r.values, {quantity: String(r.quantity), _rli_csv_escaped: '1'});
            lines.push(keys.map(key => { let v = String(values[key] === undefined ? '' : values[key]); if (/^[=+\-@\t\r']/.test(v)) v = "'" + v; return quote(v); }).join(','));
        });
        return '\uFEFF' + lines.join('\r\n') + '\r\n';
    }
    function validateLibrary(library) {
        if (!library || library.schema !== 1 || !Array.isArray(library.profiles) || !library.profiles.length || library.profiles.length > 100 || !Array.isArray(library.templates) || library.templates.length > 100 || !Array.isArray(library.papers) || library.papers.length > 100) throw new Error('Invalid Ramsey Labels library (schema 1 required; maximum 100 of each item).');
        const ids = new Set();
        library.profiles.forEach(p => { if (!p.id || ids.has(p.id)) throw new Error('Duplicate/missing profile ID.'); ids.add(p.id); const errors = validateDesign(p.design).concat(validatePage(p)); if (errors.length) throw new Error(p.name + ': ' + errors.join(' ')); });
        library.templates.forEach(t => { const errors = validateDesign(t.design); if (errors.length) throw new Error(t.name + ': ' + errors.join(' ')); });
        if (!ids.has(library.defaultProfile)) throw new Error('Default profile does not exist.');
        return library;
    }
    return Object.freeze({MAX_LABELS, MAX_RECORDS, MAX_ELEMENTS, uid, clone, clamp, fields, aliases, element, defaultDesign, defaultPage, defaultProfile, defaultLibrary, resolve, requestedFields, validateDesign, geometry, validatePage, paginate, parseCSV, csvRecords, exportCSV, validateLibrary});
}));
