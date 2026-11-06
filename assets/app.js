/** Ramsey Labels independent editor and print workflow. No third-party UI dependencies. */
(function () {
    'use strict';
    const C = window.RLICore,
        R = window.RLIRender,
        B = window.RLI_BOOT,
        root = document.getElementById('rli-app');
    if (!root || !C || !R || !B) return;
    // Add missing built-in templates to libraries saved by older releases.
    // Do not overwrite user-customized templates or profiles.
    const builtinTemplates = C.defaultLibrary().templates;
    const upgradedLibrary = C.clone(B.library);
    for (const builtin of builtinTemplates) {
        if (!upgradedLibrary.templates.some((t) => t.id === builtin.id)) {
            upgradedLibrary.templates.push(C.clone(builtin));
        }
    }
    const hasNewTemplates = upgradedLibrary.templates.length !== B.library.templates.length;
    const state = {
        library: upgradedLibrary,
        profile: null,
        records: [],
        selection: null,
        results: [],
        source: 'products',
        page: 1,
        job: null,
        busy: false,
        dirty: false,
    };
    const el = (tag, props = {}, children = []) => {
        const n = document.createElement(tag);
        for (const [k, v] of Object.entries(props)) {
            if (k === 'class') n.className = v;
            else if (k === 'text') n.textContent = String(v);
            else if (k === 'value') n.value = v;
            else if (k === 'checked') n.checked = !!v;
            else if (k === 'type') n.type = v;
            else if (k === 'style') Object.assign(n.style, v);
            else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
            else n.setAttribute(k, String(v));
        }
        for (const child of children)
            n.append(typeof child === 'string' ? document.createTextNode(child) : child);
        return n;
    };
    const $ = (id) => document.getElementById(id),
        msg = (text, error = false) => {
            const n = $('rli-status');
            if (n) {
                n.setAttribute('role', 'status');
                n.setAttribute('aria-live', 'polite');
                n.textContent = text;
                n.className = error ? 'rli-error' : 'rli-status';
            }
            if (error) console.error(text);
        };
    const button = (label, fn) =>
        el('button', {
            type: 'button',
            class: 'button',
            text: label,
            onclick: () =>
                Promise.resolve()
                    .then(fn)
                    .catch((e) => msg(e.message, true)),
        });
    const input = (value, fn, type = 'text', min = null, step = null) => {
        const n = el('input', { type, value: value ?? '', class: 'rli-input' });
        if (min !== null) n.min = min;
        if (step !== null) n.step = step;
        n.addEventListener('change', () => fn(type === 'number' ? Number(n.value) : n.value));
        return n;
    };
    const select = (value, options, fn) => {
        const n = el('select', { class: 'rli-input' });
        for (const [key, label] of options) n.append(el('option', { value: key, text: label }));
        n.value = value;
        n.addEventListener('change', () => fn(n.value));
        return n;
    };
    const field = (name, control) =>
        el('label', { class: 'rli-field' }, [el('span', { text: name }), control]);
    const options = (values) => values.map((v) => (Array.isArray(v) ? v : [v, v]));
    const request = async (path, method = 'GET', body) => {
        const url = new URL(B.rest);
        if (url.searchParams.has('rest_route')) {
            const [route, query] = path.split('?');
            url.searchParams.set('rest_route', url.searchParams.get('rest_route') + route);
            for (const [key, value] of new URLSearchParams(query || ''))
                url.searchParams.set(key, value);
        } else {
            url.pathname += path.split('?')[0];
            url.search = path.includes('?') ? path.slice(path.indexOf('?')) : '';
        }
        const r = await fetch(url, {
            method,
            credentials: 'same-origin',
            headers: {
                'X-WP-Nonce': B.nonce,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const result = await r.json();
        if (!r.ok) throw Error(result.message || 'Request failed (' + r.status + ')');
        return result;
    };
    function chooseProfile(id) {
        state.profile = C.clone(
            state.library.profiles.find((p) => p.id === id) || state.library.profiles[0],
        );
        state.selection = null;
        state.job = null;
        state.dirty = false;
        render();
    }
    function mark() {
        state.dirty = true;
        state.job = null;
        showTab('design');
    }
    function commitProfile() {
        const i = state.library.profiles.findIndex((p) => p.id === state.profile.id);
        if (i < 0) throw Error('Profile missing');
        state.library.profiles[i] = C.clone(state.profile);
        C.validateLibrary(state.library);
        state.dirty = true;
    }
    async function save() {
        commitProfile();
        state.library = await request('library', 'POST', state.library);
        state.dirty = false;
        render();
        msg('Saved to WordPress.');
    }
    function download(blob, name) {
        R.download(blob, name);
    }
    function jsonFile(data, name) {
        download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name);
    }
    function makeToolbar() {
        const bar = el('div', { class: 'rli-toolbar' });
        bar.append(
            field(
                'Print profile',
                select(
                    state.profile.id,
                    state.library.profiles.map((p) => [p.id, p.name]),
                    chooseProfile,
                ),
            ),
            button('Save settings', save),
            button('Duplicate profile', () => {
                commitProfile();
                const p = C.clone(state.profile);
                p.id = C.uid();
                p.name += ' copy';
                state.library.profiles.push(p);
                state.profile = p;
                mark();
                render();
            }),
            button('Delete profile', () => {
                if (state.library.profiles.length < 2) throw Error('Keep at least one profile');
                if (!confirm('Delete this profile? Save settings to persist.')) return;
                state.library.profiles = state.library.profiles.filter(
                    (p) => p.id !== state.profile.id,
                );
                state.profile = C.clone(state.library.profiles[0]);
                state.library.defaultProfile = state.profile.id;
                mark();
                render();
            }),
            button('Export library', () => jsonFile(state.library, 'ramsey-labels-settings.json')),
            button('Import library', () => {
                const picker = el('input', { type: 'file' });
                picker.accept = '.json,application/json';
                picker.onchange = async () => {
                    if (!picker.files[0] || picker.files[0].size > 2200000) {
                        msg('Select a JSON library smaller than 2.2 MB.', true);
                        return;
                    }
                    const data = JSON.parse(await picker.files[0].text());
                    data.revision = state.library.revision;
                    C.validateLibrary(data);
                    if (
                        !confirm(
                            'Replace all current profiles and templates in this editor? Save to persist.',
                        )
                    )
                        return;
                    state.library = data;
                    chooseProfile(data.defaultProfile);
                    state.dirty = true;
                };
                picker.click();
            }),
        );
        return bar;
    }
    function render() {
        root.replaceChildren(
            el('h1', { text: 'Ramsey Labels — Designer & Print' }),
            el('p', {
                text: 'Independent WooCommerce label printing. Save settings before leaving. Test print alignment and barcode scanning before production.',
            }),
            makeToolbar(),
            el('div', {
                id: 'rli-status',
                class: 'rli-status',
                text: state.dirty ? 'Unsaved changes' : '',
            }),
        );
        const tabs = el('div', { class: 'rli-tabs' });
        for (const [id, name] of [
            ['design', 'Design'],
            ['data', 'Products & orders'],
            ['print', 'Preview / print'],
            ['migration', 'Migration'],
        ])
            tabs.append(button(name, () => showTab(id)));
        root.append(tabs, el('section', { id: 'rli-content' }));
        showTab(state.tab || 'design');
    }
    function showTab(tab) {
        state.tab = tab;
        const area = $('rli-content');
        area.replaceChildren();
        if (tab === 'design') designTab(area);
        else if (tab === 'data') dataTab(area);
        else if (tab === 'print') {
            printTab(area);
            if (
                !state.job &&
                !state.busy &&
                state.records.some((r) => r.selected !== false && Number(r.quantity) > 0)
            ) {
                Promise.resolve()
                    .then(prepare)
                    .catch((e) => msg(e.message, true));
            }
        } else migrationTab(area);
    }
    function designTab(area) {
        const p = state.profile,
            d = p.design,
            page = p.page;
        const settings = el('div', { class: 'rli-settings' });
        settings.append(
            field(
                'Profile name',
                input(p.name, (v) => {
                    p.name = v;
                    mark();
                }),
            ),
            field(
                'Label width (mm)',
                input(
                    d.width,
                    (v) => {
                        d.width = v;
                        if (page.mode === 'roll') page.width = v;
                        mark();
                    },
                    'number',
                    5,
                    0.1,
                ),
            ),
            field(
                'Label height (mm)',
                input(
                    d.height,
                    (v) => {
                        d.height = v;
                        if (page.mode === 'roll') page.height = v;
                        mark();
                    },
                    'number',
                    5,
                    0.1,
                ),
            ),
            field(
                'Layout mode',
                select(
                    d.mode,
                    options([
                        ['visual', 'Visual'],
                        ['html', 'HTML template'],
                    ]),
                    (v) => {
                        d.mode = v;
                        mark();
                    },
                ),
            ),
            field(
                'Page type',
                select(
                    page.mode,
                    options([
                        ['roll', 'Thermal / roll'],
                        ['sheet', 'Sheet'],
                    ]),
                    (v) => {
                        page.mode = v;
                        if (v === 'roll') {
                            page.width = d.width;
                            page.height = d.height;
                            page.columns = 1;
                            page.rows = 1;
                            page.marginLeft =
                                page.marginRight =
                                page.marginTop =
                                page.marginBottom =
                                page.gapX =
                                page.gapY =
                                page.start =
                                    0;
                        }
                        mark();
                    },
                ),
            ),
            field(
                'Resolution (DPI)',
                input(
                    page.dpi,
                    (v) => {
                        page.dpi = v;
                        mark();
                    },
                    'number',
                    72,
                    1,
                ),
            ),
        );
        for (const [key, label] of [
            ['width', 'Paper width'],
            ['height', 'Paper height'],
            ['columns', 'Columns'],
            ['rows', 'Rows'],
            ['marginTop', 'Top margin'],
            ['marginLeft', 'Left margin'],
            ['marginRight', 'Right margin'],
            ['marginBottom', 'Bottom margin'],
            ['gapX', 'Horizontal gap'],
            ['gapY', 'Vertical gap'],
            ['start', 'Skip first slots'],
            ['offsetX', 'X calibration offset'],
            ['offsetY', 'Y calibration offset'],
        ])
            if (page.mode === 'sheet')
                settings.append(
                    field(
                        label +
                            (key === 'columns' || key === 'rows' || key === 'start' ? '' : ' (mm)'),
                        input(
                            page[key],
                            (v) => {
                                page[key] = v;
                                mark();
                            },
                            'number',
                            null,
                            key === 'columns' || key === 'rows' || key === 'start' ? 1 : 0.1,
                        ),
                    ),
                );
        settings.append(
            field(
                'Quantity mode',
                select(
                    p.quantityMode,
                    options([
                        ['one', 'One per product'],
                        ['stock', 'Stock quantity'],
                        ['order', 'Order quantity'],
                    ]),
                    (v) => {
                        p.quantityMode = v;
                        mark();
                    },
                ),
            ),
        );
        area.append(settings);
        const controls = el('div', { class: 'rli-toolbar' });
        for (const type of ['text', 'barcode', 'image', 'rect', 'line', 'ellipse'])
            controls.append(
                button('Add ' + type, () => {
                    const e = C.element(type, {
                        x: 1,
                        y: 1,
                        w: Math.min(20, d.width - 1),
                        h: Math.min(8, d.height - 1),
                    });
                    d.elements.push(e);
                    state.selection = e.id;
                    mark();
                }),
            );
        controls.append(
            button('Save as template', () => {
                const name = prompt('Template name');
                if (!name) return;
                state.library.templates.push({ id: C.uid(), name, design: C.clone(d) });
                mark();
            }),
            field(
                'Load template',
                select(
                    '',
                    [
                        ['', 'Choose template'],
                        ...state.library.templates.map((t) => [t.id, t.name]),
                    ],
                    (id) => {
                        const t = state.library.templates.find((x) => x.id === id);
                        if (t && confirm('Replace current design?')) {
                            p.design = C.clone(t.design);
                            state.selection = null;
                            mark();
                        }
                    },
                ),
            ),
        );
        area.append(controls);
        if (d.mode === 'html') {
            area.append(
                field('HTML template', el('textarea', { id: 'rli-html', rows: '8' })),
                field('CSS', el('textarea', { id: 'rli-css', rows: '6' })),
            );
            $('rli-html').value = d.html;
            $('rli-css').value = d.css;
            $('rli-html').onchange = (e) => {
                d.html = e.target.value;
                mark();
            };
            $('rli-css').onchange = (e) => {
                d.css = e.target.value;
                mark();
            };
            return;
        }
        area.append(
            el('p', {
                text: 'Drag elements to reposition. Click to edit. Dimensions and coordinates are in millimeters.',
            }),
        );
        const work = el('div', { class: 'rli-work' }),
            board = el('div', { class: 'rli-board' }),
            props = el('div', { class: 'rli-properties' });
        work.append(board, props);
        area.append(work);
        const scale = Math.min(7, Math.max(2, 530 / d.width));
        board.style.width = d.width * scale + 'px';
        board.style.height = d.height * scale + 'px';
        for (const e of d.elements) {
            const n = el('div', {
                class: 'rli-element' + (state.selection === e.id ? ' selected' : ''),
                text:
                    e.type === 'text'
                        ? e.content
                        : e.type === 'barcode'
                          ? '▥ ' + e.format
                          : e.type === 'image'
                            ? '▧ Image'
                            : e.type,
            });
            Object.assign(n.style, {
                left: e.x * scale + 'px',
                top: e.y * scale + 'px',
                width: e.w * scale + 'px',
                height: e.h * scale + 'px',
                fontSize: '12px',
            });
            n.onclick = () => {
                state.selection = e.id;
                showTab('design');
            };
            n.tabIndex = 0;
            n.setAttribute('role', 'button');
            n.setAttribute('aria-label', 'Edit ' + e.type + ' element ' + e.id);
            n.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    n.click();
                    document
                        .querySelector('.rli-properties input, .rli-properties select')
                        ?.focus();
                }
            };
            n.onpointerdown = (ev) => {
                if (ev.button !== 0) return;
                ev.preventDefault();
                state.selection = e.id;
                n.setPointerCapture(ev.pointerId);
                const x = ev.clientX,
                    y = ev.clientY,
                    ox = e.x,
                    oy = e.y;
                n.onpointermove = (move) => {
                    if (!n.hasPointerCapture(move.pointerId)) return;
                    e.x = C.clamp(
                        Math.round((ox + (move.clientX - x) / scale) * 10) / 10,
                        0,
                        Math.max(0, d.width - e.w),
                    );
                    e.y = C.clamp(
                        Math.round((oy + (move.clientY - y) / scale) * 10) / 10,
                        0,
                        Math.max(0, d.height - e.h),
                    );
                    n.style.left = e.x * scale + 'px';
                    n.style.top = e.y * scale + 'px';
                };
                n.onpointerup = () => {
                    n.onpointermove = null;
                    state.dirty = true;
                    state.job = null;
                    showTab('design');
                };
            };
            board.append(n);
        }
        const selected = d.elements.find((e) => e.id === state.selection);
        if (!selected) {
            props.append(el('p', { text: 'Select an element to edit its properties.' }));
            return;
        }
        props.append(el('h3', { text: 'Element properties' }));
        for (const [key, label] of [
            ['type', 'Type'],
            ['content', 'Text / field expression'],
            ['x', 'X'],
            ['y', 'Y'],
            ['w', 'Width'],
            ['h', 'Height'],
            ['fontSize', 'Font size (pt)'],
            ['minFontSize', 'Minimum font size'],
            ['rotation', 'Rotation (degrees)'],
            ['color', 'Color'],
            ['background', 'Background'],
            ['format', 'Barcode format'],
            ['ecc', 'QR error correction'],
            ['align', 'Horizontal alignment'],
            ['vAlign', 'Vertical alignment'],
            ['fit', 'Image fit'],
            ['condition', 'Visibility condition'],
        ]) {
            if (
                (key === 'format' && selected.type !== 'barcode') ||
                (key === 'ecc' && selected.type !== 'barcode')
            )
                continue;
            const enums = {
                type: options(['text', 'barcode', 'image', 'rect', 'line', 'ellipse']),
                format: options([
                    'code128',
                    'code39',
                    'ean13',
                    'ean8',
                    'upca',
                    'upce',
                    'qrcode',
                    'datamatrix',
                ]),
                ecc: options(['L', 'M', 'Q', 'H']),
                align: options(['left', 'center', 'right']),
                vAlign: options(['top', 'middle', 'bottom']),
                fit: options(['contain', 'cover']),
            };
            const numeric = ['x', 'y', 'w', 'h', 'fontSize', 'minFontSize', 'rotation'].includes(
                key,
            );
            const change = (v) => {
                selected[key] = v;
                mark();
            };
            props.append(
                field(
                    label,
                    enums[key]
                        ? select(selected[key], enums[key], change)
                        : input(
                              selected[key],
                              change,
                              numeric ? 'number' : 'text',
                              null,
                              numeric ? 0.1 : null,
                          ),
                ),
            );
        }
        for (const key of ['bold', 'italic', 'underline', 'autoFit', 'showText', 'visible']) {
            const c = el('input', { type: 'checkbox', checked: selected[key] });
            c.onchange = () => {
                selected[key] = c.checked;
                mark();
            };
            props.append(field(key, c));
        }
        props.append(
            button('Delete element', () => {
                d.elements = d.elements.filter((e) => e.id !== selected.id);
                state.selection = null;
                mark();
            }),
        );
    }
    async function search() {
        const query = new URLSearchParams({
            search: $('rli-search').value,
            page: String(state.page),
            per_page: '30',
        });
        if (state.source === 'products') {
            const cat = $('rli-category').value;
            if (cat) query.set('categories', cat);
        }
        if (!['products', 'orders', 'order_items'].includes(state.source))
            throw Error('For this source, enter IDs using the direct-ID field below.');
        const result = await request(
            (state.source === 'orders' || state.source === 'order_items' ? 'orders' : 'products') +
                '?' +
                query,
        );
        state.results = result.items;
        const list = $('rli-results');
        list.replaceChildren();
        for (const item of result.items) {
            const thumb = item.image_url
                ? el('img', {
                      class: 'rli-result-image',
                      src: item.image_url,
                      alt: 'Product photo: ' + item.name,
                      loading: 'lazy',
                  })
                : el('span', { class: 'rli-result-image rli-no-image', text: 'No photo' });
            const details = el('span', { class: 'rli-result-details' }, [
                el('strong', { text: item.name }),
                el('span', {
                    class: 'rli-result-meta',
                    text: 'SKU: ' + (item.sku || 'No SKU') + ' · ' + (item.price || 'No price'),
                }),
            ]);
            const row = el('label', { class: 'rli-result rli-product-result' }, [
                el('input', { type: 'checkbox', value: item.id }),
                thumb,
                details,
            ]);
            list.append(row);
        }
        msg(
            result.total +
                ' matching records; page ' +
                result.page +
                ' of ' +
                Math.max(1, result.pages),
        );
    }
    async function addSelected() {
        const ids = Array.from(document.querySelectorAll('#rli-results input:checked')).map((x) =>
            Number(x.value),
        );
        if (!ids.length) throw Error('Select at least one item.');
        await loadRecords(ids);
    }
    async function loadRecords(ids, itemIds = []) {
        const result = await request('records', 'POST', {
            source: state.source,
            ids,
            item_ids: itemIds,
            fields: C.requestedFields(state.profile.design),
            quantity_mode: state.profile.quantityMode,
            copies: Number($('rli-copies')?.value || 1),
            variations: $('rli-variations')?.value || 'parent',
        });
        if (state.records.length + result.records.length > C.MAX_RECORDS)
            throw Error('The queue exceeds the 1,000-record limit. Split this batch.');
        state.records.push(...result.records);
        state.job = null;
        showTab('data');
        msg('Added ' + result.records.length + ' records. ' + (result.warnings || []).join(' '));
    }
    function dataTab(area) {
        const bar = el('div', { class: 'rli-toolbar' });
        bar.append(
            field(
                'Source',
                select(
                    state.source,
                    options([
                        ['products', 'Products'],
                        ['order_items', 'Purchased order items'],
                        ['orders', 'Orders / shipping'],
                        ['coupons', 'Coupons'],
                        ['users', 'Customers / users'],
                        ['posts', 'Posts'],
                    ]),
                    (v) => {
                        state.source = v;
                        state.page = 1;
                        showTab('data');
                    },
                ),
            ),
            field(
                'Copies',
                input(1, () => {}, 'number', 1, 1),
            ),
            field(
                'Variation expansion',
                select(
                    'parent',
                    options([
                        ['parent', 'Parent'],
                        ['variations', 'Variations'],
                        ['both', 'Both'],
                    ]),
                    () => {},
                ),
            ),
        );
        bar.querySelectorAll('input')[0].id = 'rli-copies';
        bar.querySelectorAll('select')[1].id = 'rli-variations';
        area.append(bar);
        const searchBar = el('div', { class: 'rli-toolbar' }, [
            field(
                'Search name / SKU / order ID',
                el('input', {
                    id: 'rli-search',
                    type: 'search',
                    placeholder: 'Search WooCommerce',
                }),
            ),
            button('Search', () => {
                state.page = 1;
                return search();
            }),
            button('Previous', () => {
                state.page = Math.max(1, state.page - 1);
                return search();
            }),
            button('Next', () => {
                state.page++;
                return search();
            }),
        ]);
        if (state.source === 'products')
            searchBar.append(
                field(
                    'Category',
                    select(
                        '',
                        [
                            ['', 'All categories'],
                            ...B.categories.map((c) => [String(c.id), c.name]),
                        ],
                        () => {},
                    ),
                ),
            );
        area.append(searchBar);
        if (state.source === 'products')
            searchBar.querySelectorAll('select')[0].id = 'rli-category';
        // Enter in the search box performs the same action as the Search button.
        // Handle it directly: the admin UI is not a form and its buttons are type=button.
        const submitSearch = (event) => {
            if (event.key !== 'Enter' || event.isComposing || event.repeat) return;
            event.preventDefault();
            state.page = 1;
            Promise.resolve()
                .then(search)
                .catch((error) => msg(error.message, true));
        };
        $('rli-search').addEventListener('keydown', submitSearch);
        if (state.source === 'products')
            $('rli-category').addEventListener('keydown', submitSearch);
        area.append(
            el('div', { id: 'rli-results', class: 'rli-results' }),
            button('Add selected to job', addSelected),
            field(
                'Direct IDs (comma-separated)',
                el('input', { id: 'rli-direct-ids', type: 'text', placeholder: '12, 34, 56' }),
            ),
            button('Add IDs', () => {
                const raw = $('rli-direct-ids').value;
                const ids = raw.split(/[\s,;]+/).filter(Boolean);
                if (!ids.length || ids.some((v) => !/^\d+$/.test(v)))
                    throw Error('Enter positive numeric IDs separated by commas.');
                return loadRecords(ids.map(Number));
            }),
            el('h3', { text: 'Print job (' + state.records.length + ' records)' }),
        );
        const controls = el('div', { class: 'rli-toolbar' }, [
            button('Clear job', () => {
                if (confirm('Clear job?')) {
                    state.records = [];
                    state.job = null;
                    showTab('data');
                }
            }),
            button('Export CSV', () =>
                download(
                    new Blob([C.exportCSV(state.records)], { type: 'text/csv' }),
                    'ramsey-labels-job.csv',
                ),
            ),
            button('Import CSV', () => {
                const file = el('input', { type: 'file' });
                file.accept = '.csv,text/csv';
                file.onchange = async () => {
                    try {
                        if (file.files[0].size > 2000000)
                            throw Error('CSV exceeds the 2 MB limit.');
                        const imported = C.csvRecords(await file.files[0].text());
                        if (state.records.length + imported.length > C.MAX_RECORDS)
                            throw Error(
                                'The queue exceeds the 1,000-record limit. Split this batch.',
                            );
                        state.records.push(...imported);
                        state.job = null;
                        showTab('data');
                    } catch (error) {
                        msg(error.message, true);
                    }
                };
                file.click();
            }),
            button('Print preview', () => showTab('print')),
        ]);
        area.append(controls);
        for (const [index, record] of state.records.entries()) {
            const row = el('div', { class: 'rli-result' });
            const enabled = el('input', { type: 'checkbox', checked: record.selected !== false });
            enabled.setAttribute(
                'aria-label',
                'Include ' + (record.values.name || record.key) + ' in print job',
            );
            enabled.onchange = () => {
                record.selected = enabled.checked;
                state.job = null;
            };
            const count = input(
                record.quantity,
                (v) => {
                    record.quantity = v;
                    state.job = null;
                },
                'number',
                1,
                1,
            );
            count.style.width = '75px';
            const values = record.values || {};
            const photo = values.image_url
                ? el('img', {
                      class: 'rli-result-image',
                      src: values.image_url,
                      alt: 'Product photo: ' + (values.name || 'Product'),
                      loading: 'lazy',
                  })
                : el('span', { class: 'rli-result-image rli-no-image', text: 'No photo' });
            const details = el('span', { class: 'rli-result-details' }, [
                el('strong', {
                    text: values.name || values['order.number'] || record.key || 'Record',
                }),
                el('span', {
                    class: 'rli-result-meta',
                    text: 'SKU: ' + (values.sku || 'No SKU') + ' · ' + (values.price || ''),
                }),
            ]);
            row.classList.add('rli-queued-product');
            row.append(
                enabled,
                photo,
                details,
                field('Quantity', count),
                button('Remove', () => {
                    state.records.splice(index, 1);
                    state.job = null;
                    showTab('data');
                }),
            );
            area.append(row);
        }
    }
    async function prepare() {
        if (state.busy) return;
        state.busy = true;
        state.job = null;
        const snapshot = JSON.stringify([state.profile, state.records]);
        const [profile, records] = JSON.parse(snapshot);
        try {
            C.validateDesign(state.profile.design).forEach((e) => {
                throw Error(e);
            });
            msg('Rendering job…');
            const job = await R.prepareJob(profile, records, {
                progress: (done, total) => msg('Rendering ' + done + ' / ' + total),
            });
            if (snapshot !== JSON.stringify([state.profile, state.records]))
                throw Error('Queue or profile changed while rendering. Generate a new preview.');
            state.job = job;
            msg(
                'Ready: ' +
                    state.job.layout.total +
                    ' labels, ' +
                    state.job.layout.pages.length +
                    ' pages. ' +
                    state.job.issues.length +
                    ' warnings.',
            );
            showTab('print');
        } finally {
            state.busy = false;
        }
    }
    function printTab(area) {
        area.append(
            el('p', {
                text: 'Browser print: set scale to 100%, margins to none, and disable headers/footers. For PDF use the export button.',
            }),
        );
        area.append(
            el('div', { class: 'rli-toolbar' }, [
                button('Generate preview', prepare),
                button('Print', async () => {
                    if (state.busy) throw Error('Preview is still rendering. Please wait.');
                    if (!state.job) await prepare();
                    if (state.job) await R.printJob(state.job);
                }),
                button('Export PDF', async () => {
                    if (state.busy) throw Error('Preview is still rendering. Please wait.');
                    if (!state.job) await prepare();
                    if (state.job) R.download(await R.exportPDF(state.job), 'ramsey-labels.pdf');
                }),
            ]),
        );
        if (state.job) {
            const pages = el('div', { class: 'rli-pages' });
            for (let i = 0; i < state.job.layout.pages.length; i++) {
                const n = R.pageElement(state.job, i);
                n.classList.add('rli-preview-page');
                pages.append(n);
            }
            area.append(pages);
            if (state.job.issues.length)
                area.append(el('pre', { text: state.job.issues.map((x) => x.message).join('\n') }));
        }
    }
    async function migrationTab(area) {
        area.append(
            el('p', {
                text: 'Read-only inspection first. Importing creates a backup of Ramsey Labels settings and never modifies the original plugin.',
            }),
        );
        area.append(
            button('Inspect installed plugin', async () => {
                const result = await request('migration');
                area.append(el('pre', { text: JSON.stringify(result, null, 2) }));
            }),
            button('Preview migration', async () => {
                const plan = await request('migration', 'POST', { action: 'preview' });
                area.append(el('pre', { text: JSON.stringify(plan, null, 2) }));
                if (plan.hash)
                    area.append(
                        button('Apply previewed migration', async () => {
                            if (!confirm('Apply this migration to Ramsey Labels settings?')) return;
                            const result = await request('migration', 'POST', {
                                action: 'apply',
                                hash: plan.hash,
                            });
                            msg('Migration completed. Reload to see changes.');
                        }),
                    );
            }),
            button('Restore migration backup', async () => {
                if (!confirm('Restore saved Ramsey Labels settings from before migration?')) return;
                await request('migration', 'POST', { action: 'restore', confirmed: true });
                location.reload();
            }),
        );
    }
    R.configure({
        imageResolver: async (id) => {
            if (typeof id === 'string' && /^(https?:|data:image\/|blob:)/i.test(id)) return id;
            const attachment = String(id).replace(/^wp-image:/, '');
            if (!/^\d+$/.test(attachment)) throw Error('Select a local media attachment.');
            const data = await request('image/' + encodeURIComponent(attachment));
            return data.src;
        },
    });
    state.profile = C.clone(
        state.library.profiles.find((p) => p.id === state.library.defaultProfile) ||
            state.library.profiles[0],
    );
    if (hasNewTemplates) {
        state.dirty = true;
    }
    if (B.preselection?.source)
        state.source =
            B.preselection.source === 'order_items' ? 'order_items' : B.preselection.source;
    render();
    if (B.preselection?.ids?.length) {
        loadRecords(B.preselection.ids, B.preselection.item_ids || []).catch((e) =>
            msg(e.message, true),
        );
    } else if (B.preselection?.categories?.length) {
        showTab('data');
        $('rli-category').value = String(B.preselection.categories[0]);
        search().catch((e) => msg(e.message, true));
    }
})();
