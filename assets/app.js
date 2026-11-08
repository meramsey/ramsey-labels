/** Ramsey Labels independent editor and print workflow. No third-party UI dependencies. */
(function () {
    'use strict';
    const __ = (message, domain) => globalThis.wp?.i18n?.__(message, domain) ?? message;
    const sprintf = (format, ...values) => {
        if (globalThis.wp?.i18n?.sprintf) return globalThis.wp.i18n.sprintf(format, ...values);
        let index = 0;
        return format.replace(/%%|%(?:(\d+)\$)?s/g, (token, position) =>
            token === '%%' ? '%' : String(values[position ? Number(position) - 1 : index++]),
        );
    };

    const C = window.RLICore,
        R = window.RLIRender,
        B = window.RLI_BOOT,
        root = document.getElementById('rli-app');
    if (!root || !C || !R || !B) return;
    // Add missing built-in templates to libraries saved by older releases.
    // Do not overwrite user-customized templates or profiles.
    const builtinTemplates = C.defaultLibrary().templates;
    const upgradedLibrary = C.clone(B.library);
    for (const design of [
        ...upgradedLibrary.profiles.map((profile) => profile.design),
        ...upgradedLibrary.templates.map((template) => template.design),
    ]) {
        if (design.showCurrency === undefined) design.showCurrency = true;
        for (const element of design.elements || [])
            if (element.direction === undefined) element.direction = 'inherit';
    }
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
        queueSort: 'selection',
        selection: null,
        results: [],
        source: 'products',
        page: 1,
        categoryPage: 1,
        categorySelected: (B.preselection?.categories || []).map(Number)[0] || 0,
        categoryBusy: false,
        genericPaper: 'a4',
        genericOrientation: 'portrait',
        job: null,
        busy: false,
        dirty: false,
        segment: 0,
        segmentInfo: null,
        queuePage: 0,
        editingControl: null,
        generation: 0,
        exporting: false,
    };
    const el = (tag, props = {}, children = []) => {
        const n = document.createElement(tag);
        for (const [k, v] of Object.entries(props)) {
            if (k === 'class') n.className = v;
            else if (k === 'text') n.textContent = String(v);
            else if (k === 'value') n.value = v;
            else if (k === 'checked') n.checked = !!v;
            else if (k === 'disabled') n.disabled = !!v;
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
                n.setAttribute('role', error ? 'alert' : 'status');
                n.setAttribute('aria-live', error ? 'assertive' : 'polite');
                n.textContent = text;
                n.className = error ? 'rli-error' : 'rli-status';
            }
        };
    const button = (label, fn, disabled = false) =>
        el('button', {
            type: 'button',
            class: 'button',
            text: label,
            disabled:
                disabled ||
                (state.exporting &&
                    label !== __('Cancel current operation', 'ramsey-labels-independent')),
            'data-rli-action': label,
            onclick: () =>
                Promise.resolve()
                    .then(fn)
                    .catch((e) => msg(e.message, true)),
        });
    const input = (value, fn, type = 'text', min = null, step = null) => {
        const n = el('input', { type, value: value ?? '', class: 'rli-input' });
        n.disabled = state.exporting;
        if (min !== null) n.min = min;
        if (step !== null) n.step = step;
        n.addEventListener('change', () => {
            state.editingControl = n;
            try {
                fn(type === 'number' ? Number(n.value) : n.value);
            } catch (error) {
                msg(error.message, true);
            } finally {
                state.editingControl = null;
            }
        });
        return n;
    };
    const select = (value, options, fn) => {
        const n = el('select', { class: 'rli-input' });
        n.disabled = state.exporting;
        for (const [key, label] of options) n.append(el('option', { value: key, text: label }));
        n.value = value;
        n.addEventListener('change', () => fn(n.value));
        return n;
    };
    const field = (name, control) => {
        control.setAttribute('aria-label', name);
        control.setAttribute('data-rli-field', name);
        return el('label', { class: 'rli-field' }, [el('span', { text: name }), control]);
    };
    const options = (values) => values.map((v) => (Array.isArray(v) ? v : [v, v]));
    function displayProfile(profile) {
        if (profile.id === 'thermal-2x1' && profile.name === 'Thermal 2 × 1 inches')
            return __('Thermal 2 × 1 inches', 'ramsey-labels-independent');
        if (profile.id === 'a4-65' && profile.name === 'A4 · 65 labels · 38.1 × 21.2 mm')
            return __('A4 · 65 labels · 38.1 × 21.2 mm', 'ramsey-labels-independent');
        return profile.name;
    }
    function displayTemplate(template) {
        const names = {
            basic: __('Product barcode', 'ramsey-labels-independent'),
            qr: __('QR with text', 'ramsey-labels-independent'),
            image: __('Product image with barcode', 'ramsey-labels-independent'),
            'qr-card': __('QR left · price/name right · SKU below', 'ramsey-labels-independent'),
        };
        const original = {
            basic: 'Product barcode',
            qr: 'QR with text',
            image: 'Product image with barcode',
            'qr-card': 'QR left · price/name right · SKU below',
        };
        return names[template.id] && template.name === original[template.id]
            ? names[template.id]
            : template.name;
    }
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
        if (!r.ok)
            throw Error(
                result.message /* translators: %1$s: r.status. */ ||
                    sprintf(
                        /* translators: HTTP status code. */ __(
                            'Request failed (%s)',
                            'ramsey-labels-independent',
                        ),
                        r.status,
                    ),
            );
        return result;
    };
    function invalidateJob() {
        R.releaseJob(state.job);
        state.job = null;
        state.segmentInfo = null;
        state.segment = 0;
        state.generation++;
    }
    function appendRecords(records) {
        if (state.exporting)
            throw Error(
                __(
                    'Finish or cancel the PDF export before changing the queue.',
                    'ramsey-labels-independent',
                ),
            );
        state.records = window.RLIBatches.sort(
            window.RLIBatches.append(state.records, records),
            state.queueSort,
        );
        invalidateJob();
    }
    function chooseProfile(id) {
        state.profile = C.clone(
            state.library.profiles.find((p) => p.id === id) || state.library.profiles[0],
        );
        state.selection = null;
        invalidateJob();
        state.dirty = false;
        render();
    }
    function mark() {
        state.dirty = true;
        invalidateJob();
        if (state.editingControl && ['INPUT', 'TEXTAREA'].includes(state.editingControl.tagName)) {
            // Do not destroy the focused editor on a change/blur event.
            // Rebuild its physical board when the next structural control is used.
            msg(__('Unsaved changes', 'ramsey-labels-independent'));
            const board = document.querySelector('.rli-board');
            if (board) {
                const d = state.profile.design,
                    scale = Math.min(7, Math.max(2, 530 / d.width));
                board.style.width = d.width * scale + 'px';
                board.style.height = d.height * scale + 'px';
                board.dataset.scale = String(scale);
                for (const node of board.querySelectorAll('[data-rli-element]')) {
                    const e = d.elements.find((item) => item.id === node.dataset.rliElement);
                    if (e) {
                        Object.assign(node.style, {
                            left: e.x * scale + 'px',
                            top: e.y * scale + 'px',
                            width: e.w * scale + 'px',
                            height: e.h * scale + 'px',
                            transform: 'rotate(' + e.rotation + 'deg)',
                        });
                        if (e.type === 'text') node.textContent = e.content;
                    }
                }
            }
            return;
        }
        showTab('design');
    }
    function commitProfile() {
        const i = state.library.profiles.findIndex((p) => p.id === state.profile.id);
        if (i < 0) throw Error(__('Profile missing', 'ramsey-labels-independent'));
        state.library.profiles[i] = C.clone(state.profile);
        C.validateLibrary(state.library);
        state.dirty = true;
    }
    async function save() {
        commitProfile();
        state.library = await request('library', 'POST', state.library);
        state.dirty = false;
        render();
        msg(__('Saved to WordPress.', 'ramsey-labels-independent'));
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
                __('Print profile', 'ramsey-labels-independent'),
                select(
                    state.profile.id,
                    state.library.profiles.map((p) => [p.id, displayProfile(p)]),
                    chooseProfile,
                ),
            ),
            button(__('Save settings', 'ramsey-labels-independent'), save),
            button(__('Duplicate profile', 'ramsey-labels-independent'), () => {
                commitProfile();
                const p = C.clone(state.profile);
                p.id = C.uid();
                /* translators: %s: existing profile name. */
                p.name = sprintf(__('%s copy', 'ramsey-labels-independent'), p.name);
                state.library.profiles.push(p);
                state.profile = p;
                mark();
                render();
            }),
            button(__('Delete profile', 'ramsey-labels-independent'), () => {
                if (state.library.profiles.length < 2)
                    throw Error(__('Keep at least one profile', 'ramsey-labels-independent'));
                if (
                    !confirm(
                        __(
                            'Delete this profile? Save settings to persist.',
                            'ramsey-labels-independent',
                        ),
                    )
                )
                    return;
                state.library.profiles = state.library.profiles.filter(
                    (p) => p.id !== state.profile.id,
                );
                state.profile = C.clone(state.library.profiles[0]);
                state.library.defaultProfile = state.profile.id;
                mark();
                render();
            }),
            button(__('Export library', 'ramsey-labels-independent'), () =>
                jsonFile(state.library, 'ramsey-labels-settings.json'),
            ),
            button(__('Import library', 'ramsey-labels-independent'), () => {
                const picker = el('input', { type: 'file' });
                picker.accept = '.json,application/json';
                picker.onchange = async () => {
                    try {
                        if (!picker.files[0] || picker.files[0].size > 2200000) {
                            msg(
                                __(
                                    'Select a JSON library smaller than 2.2 MB.',
                                    'ramsey-labels-independent',
                                ),
                                true,
                            );
                            return;
                        }
                        const data = JSON.parse(await picker.files[0].text());
                        data.revision = state.library.revision;
                        C.validateLibrary(data);
                        if (
                            !confirm(
                                __(
                                    'Replace all current profiles and templates in this editor? Save to persist.',
                                    'ramsey-labels-independent',
                                ),
                            )
                        )
                            return;
                        state.library = data;
                        chooseProfile(data.defaultProfile);
                        state.dirty = true;
                    } catch (error) {
                        msg(error.message, true);
                    }
                };
                picker.click();
            }),
        );
        return bar;
    }
    function render() {
        const focus = captureFocus();
        root.replaceChildren(
            el('h1', { text: __('Ramsey Labels — Designer & Print', 'ramsey-labels-independent') }),
            el('p', {
                text: __(
                    'Independent WooCommerce label printing. Save settings before leaving. Test print alignment and barcode scanning before production.',
                    'ramsey-labels-independent',
                ),
            }),
            makeToolbar(),
            el('div', {
                id: 'rli-status',
                class: 'rli-status',
                role: 'status',
                'aria-live': 'polite',
                'aria-atomic': 'true',
                text: state.dirty ? __('Unsaved changes', 'ramsey-labels-independent') : '',
            }),
        );
        const tabs = el('nav', {
            class: 'rli-tabs',
            'aria-label': __('Label workflows', 'ramsey-labels-independent'),
        });
        for (const [id, name] of [
            ['design', __('Design', 'ramsey-labels-independent')],
            ['data', __('Products & orders', 'ramsey-labels-independent')],
            ['print', __('Preview / print', 'ramsey-labels-independent')],
            ['migration', __('Migration', 'ramsey-labels-independent')],
        ]) {
            const action = button(name, () => showTab(id));
            action.dataset.rliView = id;
            action.setAttribute('aria-controls', 'rli-content');
            tabs.append(action);
        }
        root.append(tabs, el('section', { id: 'rli-content' }));
        showTab(state.tab || 'design');
        restoreFocus(focus);
    }
    function captureFocus() {
        const node = document.activeElement;
        if (!node || !root.contains(node)) return null;
        return {
            node,
            key: ['data-rli-field', 'data-rli-action', 'data-rli-element']
                .map((name) => [name, node.getAttribute(name)])
                .find(([, value]) => value !== null),
        };
    }
    function restoreFocus(focus) {
        if (!focus || focus.node.isConnected) return;
        const replacement =
            focus.key &&
            Array.from(
                root.querySelectorAll('input,select,textarea,button,[data-rli-element]'),
            ).find((node) => node.getAttribute(focus.key[0]) === focus.key[1]);
        (
            replacement ||
            $('rli-content').querySelector('input,select,textarea,button') ||
            $('rli-content')
        ).focus({ preventScroll: true });
    }
    function showTab(tab) {
        const focus = captureFocus();
        state.tab = tab;
        const area = $('rli-content');
        area.replaceChildren();
        const titles = {
            design: __('Design', 'ramsey-labels-independent'),
            data: __('Products & orders', 'ramsey-labels-independent'),
            print: __('Preview / print', 'ramsey-labels-independent'),
            migration: __('Migration', 'ramsey-labels-independent'),
        };
        area.tabIndex = -1;
        area.setAttribute('aria-label', titles[tab]);
        area.append(el('h2', { text: titles[tab] }));
        for (const action of root.querySelectorAll('[data-rli-view]')) {
            if (action.dataset.rliView === tab) action.setAttribute('aria-current', 'page');
            else action.removeAttribute('aria-current');
        }
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
        restoreFocus(focus);
    }
    function designTab(area) {
        const p = state.profile,
            d = p.design,
            page = p.page;
        const settings = el('div', { class: 'rli-settings' });
        settings.append(
            field(
                __('Profile name', 'ramsey-labels-independent'),
                input(displayProfile(p), (v) => {
                    p.name = v;
                    mark();
                }),
            ),
            field(
                __('Label width (mm)', 'ramsey-labels-independent'),
                input(
                    d.width,
                    (v) => {
                        d.width = v;
                        if (page.mode === 'roll') page.width = v;
                        else page.preset = 'custom';
                        mark();
                    },
                    'number',
                    5,
                    0.1,
                ),
            ),
            field(
                __('Label height (mm)', 'ramsey-labels-independent'),
                input(
                    d.height,
                    (v) => {
                        d.height = v;
                        if (page.mode === 'roll') page.height = v;
                        else page.preset = 'custom';
                        mark();
                    },
                    'number',
                    5,
                    0.1,
                ),
            ),
            field(
                __('Layout mode', 'ramsey-labels-independent'),
                select(
                    d.mode,
                    options([
                        ['visual', __('Visual', 'ramsey-labels-independent')],
                        ['html', __('HTML template', 'ramsey-labels-independent')],
                    ]),
                    (v) => {
                        d.mode = v;
                        mark();
                    },
                ),
            ),
            field(
                __('Page type', 'ramsey-labels-independent'),
                select(
                    page.mode,
                    options([
                        ['roll', __('Thermal / roll', 'ramsey-labels-independent')],
                        ['sheet', __('Sheet', 'ramsey-labels-independent')],
                    ]),
                    (v) => {
                        page.mode = v;
                        if (v === 'roll') {
                            page.preset = 'custom';
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
                __('Resolution (DPI)', 'ramsey-labels-independent'),
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
            field(
                __('Show currency symbol', 'ramsey-labels-independent'),
                (() => {
                    const toggle = el('input', {
                        type: 'checkbox',
                        checked: d.showCurrency !== false,
                    });
                    toggle.onchange = () => {
                        d.showCurrency = toggle.checked;
                        mark();
                    };
                    return toggle;
                })(),
            ),
        );
        if (page.mode === 'sheet') {
            const generic = window.RLICore.genericSheetLayouts,
                verified = window.RLICore.verifiedSheetPresets,
                presetOptions = [
                    ['custom', __('Custom / manual sheet geometry', 'ramsey-labels-independent')],
                    ...verified.map((item) => [
                        item.id,
                        `${item.maker} ${item.code} — ${item.count} up (${item.width} × ${item.height} mm)`,
                    ]),
                    ...generic.map((item) => [
                        `generic-${item.count}`,
                        sprintf(
                            /* translators: %s: number of generic grid slots. */
                            __(
                                'Generic grid — %s slots; enter stock dimensions',
                                'ramsey-labels-independent',
                            ),
                            item.count,
                        ),
                    ]),
                ];
            const currentPreset = presetOptions.some(([value]) => value === page.preset)
                ? page.preset
                : 'custom';
            settings.append(
                field(
                    __('Sheet stock / grid preset', 'ramsey-labels-independent'),
                    select(currentPreset, presetOptions, (id) => {
                        if ('custom' === id) {
                            page.preset = 'custom';
                            mark();
                            showTab('design');
                            return;
                        }
                        let updated;
                        if (id.startsWith('generic-')) {
                            const count = Number(id.slice('generic-'.length));
                            updated = C.applyGenericGrid(
                                state.profile,
                                count,
                                state.genericPaper,
                                state.genericOrientation,
                            );
                            msg(
                                __(
                                    'Generic grid only—this is not a manufacturer stock match. Confirm the stock label dimensions, rows/columns, pitch, margins and orientation before saving or printing.',
                                    'ramsey-labels-independent',
                                ),
                            );
                        } else {
                            const preset = verified.find((item) => item.id === id);
                            updated = C.applySheetPreset(state.profile, id);
                            state.genericPaper = preset.page;
                            state.genericOrientation = 'portrait';
                            /* translators: %s: manufacturer product template URL. */
                            msg(
                                sprintf(
                                    /* translators: %s: manufacturer product template URL. */
                                    __(
                                        'Applied verified manufacturer geometry from %s. Verify feed alignment on a calibration sheet.',
                                        'ramsey-labels-independent',
                                    ),
                                    preset.source,
                                ),
                            );
                        }
                        state.profile = updated;
                        state.selection = null;
                        mark();
                        showTab('design');
                    }),
                ),
                field(
                    __(
                        'Generic paper size (used only for generic grids)',
                        'ramsey-labels-independent',
                    ),
                    select(
                        state.genericPaper,
                        [
                            ['a4', __('A4 — 210 × 297 mm', 'ramsey-labels-independent')],
                            [
                                'letter',
                                __('US Letter — 215.9 × 279.4 mm', 'ramsey-labels-independent'),
                            ],
                            ['p4', __('P4 — 250 × 353 mm', 'ramsey-labels-independent')],
                            ['custom', __('Custom dimensions below', 'ramsey-labels-independent')],
                        ],
                        (value) => {
                            state.genericPaper = value;
                            const match = page.preset.match(/^generic-(\d+)-/);
                            if (match) {
                                state.profile = C.applyGenericGrid(
                                    state.profile,
                                    Number(match[1]),
                                    value,
                                    state.genericOrientation,
                                );
                                mark();
                                showTab('design');
                            }
                        },
                    ),
                ),
                field(
                    __(
                        'Generic orientation (used only for generic grids)',
                        'ramsey-labels-independent',
                    ),
                    select(
                        state.genericOrientation,
                        [
                            ['portrait', __('Portrait', 'ramsey-labels-independent')],
                            ['landscape', __('Landscape', 'ramsey-labels-independent')],
                        ],
                        (value) => {
                            state.genericOrientation = value;
                            const match = page.preset.match(/^generic-(\d+)-/);
                            if (match) {
                                state.profile = C.applyGenericGrid(
                                    state.profile,
                                    Number(match[1]),
                                    state.genericPaper,
                                    value,
                                );
                                mark();
                                showTab('design');
                            }
                        },
                    ),
                ),
            );
            const verifiedPreset = verified.find((item) => item.id === page.preset);
            if (verifiedPreset) {
                settings.append(
                    el('a', {
                        href: verifiedPreset.source,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        text: sprintf(
                            /* translators: %s: manufacturer template product code. */
                            __('Manufacturer template reference: %s', 'ramsey-labels-independent'),
                            verifiedPreset.code,
                        ),
                    }),
                );
            } else if (page.preset.startsWith('generic-')) {
                settings.append(
                    el('p', {
                        role: 'note',
                        text: __(
                            'Generic grid only. Set exact label width/height, pitch, gaps, margins and orientation from your stock manufacturer. Count alone does not establish printer compatibility.',
                            'ramsey-labels-independent',
                        ),
                    }),
                );
            }
            settings.append(
                button(__('Download calibration sheet SVG', 'ramsey-labels-independent'), () => {
                    R.download(R.exportCalibrationSVG(p), 'ramsey-labels-calibration.svg');
                }),
            );
        }
        for (const [key, label] of [
            ['width', __('Paper width', 'ramsey-labels-independent')],
            ['height', __('Paper height', 'ramsey-labels-independent')],
            ['columns', __('Columns', 'ramsey-labels-independent')],
            ['rows', __('Rows', 'ramsey-labels-independent')],
            ['marginTop', __('Top margin', 'ramsey-labels-independent')],
            ['marginLeft', __('Left margin', 'ramsey-labels-independent')],
            ['marginRight', __('Right margin', 'ramsey-labels-independent')],
            ['marginBottom', __('Bottom margin', 'ramsey-labels-independent')],
            ['gapX', __('Horizontal gap', 'ramsey-labels-independent')],
            ['gapY', __('Vertical gap', 'ramsey-labels-independent')],
            ['start', __('Skip first slots', 'ramsey-labels-independent')],
            ['offsetX', __('X calibration offset', 'ramsey-labels-independent')],
            ['offsetY', __('Y calibration offset', 'ramsey-labels-independent')],
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
                                if (!['offsetX', 'offsetY'].includes(key)) page.preset = 'custom';
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
                __('Quantity mode', 'ramsey-labels-independent'),
                select(
                    p.quantityMode,
                    options([
                        ['one', __('One per product', 'ramsey-labels-independent')],
                        ['stock', __('Stock quantity', 'ramsey-labels-independent')],
                        ['order', __('Order quantity', 'ramsey-labels-independent')],
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
        for (const [type, label] of [
            ['text', __('Text element', 'ramsey-labels-independent')],
            ['barcode', __('Barcode element', 'ramsey-labels-independent')],
            ['image', __('Image element', 'ramsey-labels-independent')],
            ['rect', __('Rectangle element', 'ramsey-labels-independent')],
            ['line', __('Line element', 'ramsey-labels-independent')],
            ['ellipse', __('Ellipse element', 'ramsey-labels-independent')],
        ])
            controls.append(
                button(
                    sprintf(
                        /* translators: element type. */ __('Add %s', 'ramsey-labels-independent'),
                        label,
                    ),
                    () => {
                        const e = C.element(type, {
                            x: 1,
                            y: 1,
                            w: Math.min(20, d.width - 1),
                            h: Math.min(8, d.height - 1),
                        });
                        d.elements.push(e);
                        state.selection = e.id;
                        mark();
                    },
                ),
            );
        controls.append(
            button(__('Save as template', 'ramsey-labels-independent'), () => {
                const name = prompt(__('Template name', 'ramsey-labels-independent'));
                if (!name) return;
                state.library.templates.push({ id: C.uid(), name, design: C.clone(d) });
                mark();
            }),
            field(
                __('Load template', 'ramsey-labels-independent'),
                select(
                    '',
                    [
                        ['', __('Choose template', 'ramsey-labels-independent')],
                        ...state.library.templates.map((t) => [t.id, displayTemplate(t)]),
                    ],
                    (id) => {
                        const t = state.library.templates.find((x) => x.id === id);
                        if (
                            t &&
                            confirm(__('Replace current design?', 'ramsey-labels-independent'))
                        ) {
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
                field(
                    __('HTML template', 'ramsey-labels-independent'),
                    el('textarea', { id: 'rli-html', rows: '8' }),
                ),
                field(
                    __('CSS', 'ramsey-labels-independent'),
                    el('textarea', { id: 'rli-css', rows: '6' }),
                ),
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
                text: __(
                    'Drag elements to reposition. Click to edit. Dimensions and coordinates are in millimeters.',
                    'ramsey-labels-independent',
                ),
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
                'data-rli-element': e.id,
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
            /* translators: 1: element type, 2: element identifier. */
            n.setAttribute(
                'aria-label',
                sprintf(
                    /* translators: element type; element identifier. */ __(
                        'Edit %1$s element %2$s',
                        'ramsey-labels-independent',
                    ),
                    e.type,
                    e.id,
                ),
            );
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
                const scale = Number(board.dataset.scale);
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
                    invalidateJob();
                    showTab('design');
                };
            };
            board.append(n);
        }
        board.dataset.scale = String(scale);
        const selected = d.elements.find((e) => e.id === state.selection);
        if (!selected) {
            props.append(
                el('p', {
                    text: __(
                        'Select an element to edit its properties.',
                        'ramsey-labels-independent',
                    ),
                }),
            );
            return;
        }
        props.append(el('h3', { text: __('Element properties', 'ramsey-labels-independent') }));
        for (const [key, label] of [
            ['type', __('Type', 'ramsey-labels-independent')],
            ['content', __('Text / field expression', 'ramsey-labels-independent')],
            ['x', __('X position (mm)', 'ramsey-labels-independent')],
            ['y', __('Y position (mm)', 'ramsey-labels-independent')],
            ['w', __('Width', 'ramsey-labels-independent')],
            ['h', __('Height', 'ramsey-labels-independent')],
            ['fontSize', __('Font size (pt)', 'ramsey-labels-independent')],
            ['minFontSize', __('Minimum font size', 'ramsey-labels-independent')],
            ['rotation', __('Rotation (degrees)', 'ramsey-labels-independent')],
            ['color', __('Color', 'ramsey-labels-independent')],
            ['background', __('Background', 'ramsey-labels-independent')],
            ['format', __('Barcode format', 'ramsey-labels-independent')],
            ['ecc', __('QR error correction', 'ramsey-labels-independent')],
            ['align', __('Horizontal alignment', 'ramsey-labels-independent')],
            ['direction', __('Text direction', 'ramsey-labels-independent')],
            ['vAlign', __('Vertical alignment', 'ramsey-labels-independent')],
            ['fit', __('Image fit', 'ramsey-labels-independent')],
            ['condition', __('Visibility condition', 'ramsey-labels-independent')],
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
                direction: options(['inherit', 'ltr', 'rtl']),
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
        for (const [key, label] of [
            ['bold', __('Bold', 'ramsey-labels-independent')],
            ['italic', __('Italic', 'ramsey-labels-independent')],
            ['underline', __('Underline', 'ramsey-labels-independent')],
            ['autoFit', __('Fit text automatically', 'ramsey-labels-independent')],
            ['showText', __('Show barcode text', 'ramsey-labels-independent')],
            ['visible', __('Visible', 'ramsey-labels-independent')],
            ['gs1', __('GS1-128 (CODE128 only)', 'ramsey-labels-independent')],
        ]) {
            const c = el('input', { type: 'checkbox', checked: selected[key] });
            c.onchange = () => {
                selected[key] = c.checked;
                mark();
            };
            props.append(field(label, c));
        }
        props.append(
            button(__('Delete element', 'ramsey-labels-independent'), () => {
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
            throw Error(
                __(
                    'For this source, enter IDs using the direct-ID field below.',
                    'ramsey-labels-independent',
                ),
            );
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
                      /* translators: %1$s: item.name. */
                      alt: sprintf(__('Product photo: %s', 'ramsey-labels-independent'), item.name),
                      loading: 'lazy',
                  })
                : el('span', {
                      class: 'rli-result-image rli-no-image',
                      text: __('No photo', 'ramsey-labels-independent'),
                  });
            const details = el('span', { class: 'rli-result-details' }, [
                el('strong', { text: item.name }),
                el('span', {
                    class: 'rli-result-meta',
                    text: sprintf(
                        /* translators: 1: product SKU, 2: formatted product price. */
                        __('SKU: %1$s · %2$s', 'ramsey-labels-independent'),
                        item.sku || __('No SKU', 'ramsey-labels-independent'),
                        item.price || __('No price', 'ramsey-labels-independent'),
                    ),
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
            /* translators: %1$s: result.total; %2$s: result.page; %3$s: Math.max(1, result.pages). */
            sprintf(
                /* translators: matching result count; current page; total pages. */ __(
                    '%1$s matching records; page %2$s of %3$s',
                    'ramsey-labels-independent',
                ),
                result.total,
                result.page,
                Math.max(1, result.pages),
            ),
        );
    }
    async function loadCategoryPage(page = state.categoryPage, selected = state.categorySelected) {
        if (state.categoryBusy) return;
        state.categoryPage = page;
        state.categorySelected = selected;
        state.categoryBusy = true;
        const previous = $('rli-category-previous'),
            next = $('rli-category-next'),
            current = $('rli-category');
        if (previous) previous.disabled = true;
        if (next) next.disabled = true;
        if (current) current.disabled = true;
        try {
            const query = new URLSearchParams({ per_page: '100', page: String(page) });
            if (selected) query.set('include', String(selected));
            const result = await request('categories?' + query);
            const control = $('rli-category');
            if (!control) return;
            control.replaceChildren(
                el('option', {
                    value: '',
                    text: __('All categories', 'ramsey-labels-independent'),
                }),
            );
            for (const term of result.items)
                control.append(el('option', { value: String(term.id), text: term.name }));
            control.value = selected ? String(selected) : '';
            $('rli-category-previous').disabled = page <= 1;
            $('rli-category-next').disabled = !result.has_more;
            $('rli-category-page').textContent = sprintf(
                /* translators: %s: current category page number. */
                __('Category page %s', 'ramsey-labels-independent'),
                page,
            );
        } finally {
            state.categoryBusy = false;
            const control = $('rli-category');
            if (control) control.disabled = false;
        }
    }
    async function addSelected() {
        const ids = Array.from(
            document.querySelectorAll(
                __('#rli-results input:checked', 'ramsey-labels-independent'),
            ),
        ).map((x) => Number(x.value));
        if (!ids.length) throw Error(__('Select at least one item.', 'ramsey-labels-independent'));
        await loadRecords(ids);
    }
    async function loadRecords(ids, itemIds = []) {
        const unique = [...new Set(ids.map(Number))];
        if (unique.some((id) => !Number.isSafeInteger(id) || id < 1))
            throw Error(__('Select valid positive numeric IDs.', 'ramsey-labels-independent'));
        const warnings = [];
        let added = 0;
        for (let offset = 0; offset < unique.length; offset += 1000) {
            const result = await request('records', 'POST', {
                source: state.source,
                ids: unique.slice(offset, offset + 1000),
                item_ids: itemIds,
                fields: C.requestedFields(state.profile.design),
                quantity_mode: state.profile.quantityMode,
                copies: Number($('rli-copies')?.value || 1),
                variations: $('rli-variations')?.value || 'parent',
                segmented: true,
            });
            appendRecords(result.records);
            added += result.records.length;
            warnings.push(...(result.warnings || []));
            msg(
                sprintf(
                    /* translators: 1: loaded product count, 2: total selected product IDs. */
                    __('Loading %1$s of %2$s product IDs…', 'ramsey-labels-independent'),
                    Math.min(offset + 1000, unique.length),
                    unique.length,
                ),
            );
        }
        showTab('data');
        /* translators: 1: number of records, 2: source warnings. */
        msg(
            sprintf(
                /* translators: record count; source warnings. */ __(
                    'Added %1$s records. %2$s',
                    'ramsey-labels-independent',
                ),
                added,
                warnings.join(' '),
            ),
        );
    }
    function privateJobDialog() {
        return new Promise((resolve) => {
            const title = C.uid(),
                name = el('input', { type: 'text', maxlength: '150' }),
                ack = el('input', { type: 'checkbox' });
            const dialog = el('dialog', { class: 'rli-job-dialog', 'aria-labelledby': title });
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                if (dialog.open) dialog.close();
                resolve(value);
            };
            dialog.append(
                el('h2', {
                    id: title,
                    text: __('Save private print job', 'ramsey-labels-independent'),
                }),
                field(__('Job name', 'ramsey-labels-independent'), name),
                field(
                    __(
                        'I understand this job may contain customer/order information and is private to my WordPress account.',
                        'ramsey-labels-independent',
                    ),
                    ack,
                ),
                el('div', { class: 'rli-toolbar' }, [
                    button(
                        __('Save print job', 'ramsey-labels-independent'),
                        () => {
                            if (!name.value.trim() || !ack.checked) return;
                            finish({ name: name.value.trim(), acknowledged: true });
                        },
                        true,
                    ),
                    button(__('Cancel', 'ramsey-labels-independent'), () => finish(null)),
                ]),
            );
            const save = dialog.querySelector(
                '[data-rli-action="' + __('Save print job', 'ramsey-labels-independent') + '"]',
            );
            const update = () => {
                save.disabled = !name.value.trim() || !ack.checked;
            };
            name.addEventListener('input', update);
            ack.addEventListener('change', update);
            update();
            dialog.addEventListener('cancel', (event) => {
                event.preventDefault();
                finish(null);
            });
            dialog.addEventListener('close', () => {
                dialog.remove();
                if (!settled) {
                    settled = true;
                    resolve(null);
                }
            });
            root.append(dialog);
            dialog.showModal();
            name.focus();
        });
    }
    function chooseSavedJob(jobs) {
        return new Promise((resolve) => {
            const ids = Object.keys(jobs),
                title = C.uid(),
                picker = select(
                    '',
                    [
                        ['', __('Choose a saved job', 'ramsey-labels-independent')],
                        ...ids.map((id) => [id, jobs[id].name]),
                    ],
                    () => update(),
                );
            const dialog = el('dialog', { class: 'rli-job-dialog', 'aria-labelledby': title });
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                if (dialog.open) dialog.close();
                resolve(value);
            };
            dialog.append(
                el('h2', {
                    id: title,
                    text: __('Load private print job', 'ramsey-labels-independent'),
                }),
                field(__('Saved print job', 'ramsey-labels-independent'), picker),
                el('div', { class: 'rli-toolbar' }, [
                    button(
                        __('Load saved print job', 'ramsey-labels-independent'),
                        () => finish(picker.value || null),
                        true,
                    ),
                    button(__('Cancel', 'ramsey-labels-independent'), () => finish(null)),
                ]),
            );
            const load = dialog.querySelector(
                '[data-rli-action="' +
                    __('Load saved print job', 'ramsey-labels-independent') +
                    '"]',
            );
            function update() {
                load.disabled = !picker.value;
            }
            picker.addEventListener('change', update);
            update();
            dialog.addEventListener('cancel', (event) => {
                event.preventDefault();
                finish(null);
            });
            dialog.addEventListener('close', () => {
                dialog.remove();
                if (!settled) {
                    settled = true;
                    resolve(null);
                }
            });
            root.append(dialog);
            dialog.showModal();
            picker.focus();
        });
    }
    function dataTab(area) {
        const bar = el('div', { class: 'rli-toolbar' });
        bar.append(
            field(
                __('Source', 'ramsey-labels-independent'),
                select(
                    state.source,
                    options([
                        ['products', __('Products', 'ramsey-labels-independent')],
                        ['order_items', __('Purchased order items', 'ramsey-labels-independent')],
                        ['orders', __('Orders / shipping', 'ramsey-labels-independent')],
                        ['coupons', __('Coupons', 'ramsey-labels-independent')],
                        ['users', __('Customers / users', 'ramsey-labels-independent')],
                        ['posts', __('Posts', 'ramsey-labels-independent')],
                    ]),
                    (v) => {
                        state.source = v;
                        state.page = 1;
                        showTab('data');
                    },
                ),
            ),
            field(
                __('Copies', 'ramsey-labels-independent'),
                input(1, () => {}, 'number', 1, 1),
            ),
            field(
                __('Variation expansion', 'ramsey-labels-independent'),
                select(
                    'parent',
                    options([
                        ['parent', __('Parent', 'ramsey-labels-independent')],
                        ['variations', __('Variations', 'ramsey-labels-independent')],
                        ['both', __('Both', 'ramsey-labels-independent')],
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
                __('Search name / SKU / order ID', 'ramsey-labels-independent'),
                el('input', {
                    id: 'rli-search',
                    type: 'search',
                    placeholder: __('Search WooCommerce', 'ramsey-labels-independent'),
                }),
            ),
            button(__('Search', 'ramsey-labels-independent'), () => {
                state.page = 1;
                return search();
            }),
            button(__('Previous', 'ramsey-labels-independent'), () => {
                state.page = Math.max(1, state.page - 1);
                return search();
            }),
            button(__('Next', 'ramsey-labels-independent'), () => {
                state.page++;
                return search();
            }),
        ]);
        if (state.source === 'products')
            searchBar.append(
                field(
                    __('Category', 'ramsey-labels-independent'),
                    select(
                        '',
                        [['', __('All categories', 'ramsey-labels-independent')]],
                        (value) => {
                            state.categorySelected = Number(value) || 0;
                        },
                    ),
                ),
                button(
                    __('Previous category page', 'ramsey-labels-independent'),
                    () => loadCategoryPage(Math.max(1, state.categoryPage - 1), 0),
                    state.categoryPage <= 1 || state.categoryBusy,
                ),
                el('span', {
                    id: 'rli-category-page',
                    text: sprintf(
                        /* translators: %s: current category page number. */
                        __('Category page %s', 'ramsey-labels-independent'),
                        state.categoryPage,
                    ),
                }),
                button(
                    __('Next category page', 'ramsey-labels-independent'),
                    () => loadCategoryPage(state.categoryPage + 1, 0),
                    state.categoryBusy,
                ),
            );
        area.append(searchBar);
        if (state.source === 'products') {
            const category = searchBar.querySelector('select');
            category.id = 'rli-category';
            const buttons = searchBar.querySelectorAll('button');
            buttons[1].id = 'rli-category-previous';
            buttons[2].id = 'rli-category-next';
            loadCategoryPage(state.categoryPage, state.categorySelected).catch((error) =>
                msg(error.message, true),
            );
        }
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
            button(__('Add selected to job', 'ramsey-labels-independent'), addSelected),
            field(
                __('Direct IDs (comma-separated)', 'ramsey-labels-independent'),
                el('textarea', {
                    id: 'rli-direct-ids',
                    rows: 2,
                    placeholder: '12, 34, 56',
                    'aria-describedby': 'rli-direct-id-help',
                }),
            ),
            el('p', {
                id: 'rli-direct-id-help',
                text: __(
                    'Enter IDs from the selected source. Large selections are loaded in bounded pages.',
                    'ramsey-labels-independent',
                ),
            }),
            button(__('Add IDs', 'ramsey-labels-independent'), () => {
                const raw = $('rli-direct-ids').value;
                const ids = raw.split(/[\s,;]+/).filter(Boolean);
                if (!ids.length || ids.some((v) => !/^\d+$/.test(v)))
                    throw Error(
                        __(
                            'Enter positive numeric IDs separated by commas.',
                            'ramsey-labels-independent',
                        ),
                    );
                return loadRecords(ids.map(Number));
            }),
            el('h3', {
                /* translators: %1$s: state.records.length. */
                text: sprintf(
                    /* translators: number of records. */ __(
                        'Print job (%s records)',
                        'ramsey-labels-independent',
                    ),
                    state.records.length,
                ),
            }),
        );
        const controls = el('div', { class: 'rli-toolbar' }, [
            button(__('Clear job', 'ramsey-labels-independent'), () => {
                if (confirm(__('Clear job?', 'ramsey-labels-independent'))) {
                    state.records = [];
                    invalidateJob();
                    try {
                        localStorage.removeItem('ramsey-labels-draft-v1');
                    } catch {}
                    showTab('data');
                }
            }),
            button(__('Export CSV', 'ramsey-labels-independent'), () =>
                download(
                    new Blob([C.exportCSV(state.records)], { type: 'text/csv' }),
                    'ramsey-labels-job.csv',
                ),
            ),
            button(__('Import CSV', 'ramsey-labels-independent'), () => {
                const file = el('input', { type: 'file' });
                file.accept = '.csv,text/csv';
                file.onchange = async () => {
                    try {
                        if (file.files[0].size > 8000000)
                            throw Error(
                                __(
                                    'CSV exceeds the 8 MB transfer budget.',
                                    'ramsey-labels-independent',
                                ),
                            );
                        const imported = C.csvRecords(await file.files[0].text(), ',', {
                            segmented: true,
                        });
                        appendRecords(imported);
                        showTab('data');
                    } catch (error) {
                        msg(error.message, true);
                    }
                };
                file.click();
            }),
            button(__('Print preview', 'ramsey-labels-independent'), () => showTab('print')),
            button(__('Save print job', 'ramsey-labels-independent'), async () => {
                if (!state.records.length)
                    throw Error(
                        __('Add records before saving a print job.', 'ramsey-labels-independent'),
                    );
                const consent = await privateJobDialog();
                if (!consent) return;
                await request('jobs', 'POST', {
                    action: 'save',
                    privacy_acknowledged: true,
                    id: C.uid(),
                    name: consent.name,
                    profileId: state.profile.id,
                    records: state.records,
                });
                msg(
                    __(
                        'Print job saved to your private WordPress account.',
                        'ramsey-labels-independent',
                    ),
                );
            }),
            button(__('Load saved print job', 'ramsey-labels-independent'), async () => {
                const jobs = await request('jobs');
                const ids = Object.keys(jobs);
                if (!ids.length)
                    throw Error(
                        __(
                            'No saved print jobs are available to this account.',
                            'ramsey-labels-independent',
                        ),
                    );
                const chosen = await chooseSavedJob(jobs);
                if (!chosen) return;
                const job = jobs[chosen],
                    profile = state.library.profiles.find((item) => item.id === job.profileId);
                if (!profile)
                    throw Error(
                        __(
                            'The saved job references a profile unavailable to this account.',
                            'ramsey-labels-independent',
                        ),
                    );
                state.profile = C.clone(profile);
                state.records = window.RLIBatches.sort(
                    window.RLIBatches.append([], job.records),
                    state.queueSort,
                );
                invalidateJob();
                showTab('data');
            }),
            button(__('Clear all saved print jobs', 'ramsey-labels-independent'), async () => {
                if (
                    !confirm(
                        __(
                            'Delete every saved label job belonging to your WordPress account on this site?',
                            'ramsey-labels-independent',
                        ),
                    )
                )
                    return;
                await request('jobs', 'POST', { action: 'clear' });
                msg(
                    __(
                        'All private saved print jobs have been deleted.',
                        'ramsey-labels-independent',
                    ),
                );
            }),
            button(__('Save queue in this browser', 'ramsey-labels-independent'), () =>
                window.RamseyLabels.saveDraft(),
            ),
            button(__('Restore browser draft', 'ramsey-labels-independent'), () =>
                window.RamseyLabels.restoreDraft(),
            ),
        ]);
        area.append(controls);
        area.append(
            field(
                __('Sort print queue', 'ramsey-labels-independent'),
                select(
                    state.queueSort,
                    [
                        ['selection', __('Original selection order', 'ramsey-labels-independent')],
                        ['name-asc', __('Product name A–Z', 'ramsey-labels-independent')],
                        ['name-desc', __('Product name Z–A', 'ramsey-labels-independent')],
                        ['sku-asc', __('SKU ascending', 'ramsey-labels-independent')],
                        ['sku-desc', __('SKU descending', 'ramsey-labels-independent')],
                    ],
                    (mode) => {
                        state.queueSort = mode;
                        state.records = window.RLIBatches.sort(state.records, mode);
                        invalidateJob();
                        showTab('data');
                    },
                ),
            ),
        );
        const queuePages = Math.max(1, Math.ceil(state.records.length / 100));
        state.queuePage = Math.max(0, Math.min(state.queuePage, queuePages - 1));
        if (queuePages > 1) {
            /* translators: 1: current queue page, 2: queue pages. */
            area.append(
                el('p', {
                    text: sprintf(
                        /* translators: current queue page; total queue pages. */ __(
                            'Queue page %1$s of %2$s; all records remain selected independently of the visible page.',
                            'ramsey-labels-independent',
                        ),
                        state.queuePage + 1,
                        queuePages,
                    ),
                }),
                button(
                    __('Previous queue page', 'ramsey-labels-independent'),
                    () => {
                        state.queuePage--;
                        showTab('data');
                    },
                    state.queuePage === 0,
                ),
                button(
                    __('Next queue page', 'ramsey-labels-independent'),
                    () => {
                        state.queuePage++;
                        showTab('data');
                    },
                    state.queuePage + 1 === queuePages,
                ),
            );
        }
        for (const [index, record] of Array.from(state.records.entries()).slice(
            state.queuePage * 100,
            (state.queuePage + 1) * 100,
        )) {
            const row = el('div', { class: 'rli-result' });
            const enabled = el('input', { type: 'checkbox', checked: record.selected !== false });
            enabled.setAttribute(
                'aria-label',
                /* translators: %1$s: record.values.name || record.key. */
                sprintf(
                    /* translators: record display name. */ __(
                        'Include %s in print job',
                        'ramsey-labels-independent',
                    ),
                    record.values.name || record.key,
                ),
            );
            enabled.onchange = () => {
                record.selected = enabled.checked;
                invalidateJob();
            };
            const count = input(
                record.quantity,
                (v) => {
                    record.quantity = v;
                    invalidateJob();
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
                      /* translators: %1$s: values.name || 'Product'. */
                      alt: sprintf(
                          __('Product photo: %s', 'ramsey-labels-independent'),
                          values.name || __('Product', 'ramsey-labels-independent'),
                      ),
                      loading: 'lazy',
                  })
                : el('span', {
                      class: 'rli-result-image rli-no-image',
                      text: __('No photo', 'ramsey-labels-independent'),
                  });
            const details = el('span', { class: 'rli-result-details' }, [
                el('strong', {
                    text:
                        values.name ||
                        values['order.number'] ||
                        record.key ||
                        __('Record', 'ramsey-labels-independent'),
                }),
                el('span', {
                    class: 'rli-result-meta',
                    text: sprintf(
                        /* translators: 1: product SKU, 2: formatted product price. */
                        __('SKU: %1$s · %2$s', 'ramsey-labels-independent'),
                        values.sku || __('No SKU', 'ramsey-labels-independent'),
                        values.price || __('No price', 'ramsey-labels-independent'),
                    ),
                }),
            ]);
            row.classList.add('rli-queued-product');
            row.append(
                enabled,
                photo,
                details,
                field(__('Quantity', 'ramsey-labels-independent'), count),
                button(__('Remove', 'ramsey-labels-independent'), () => {
                    state.records.splice(index, 1);
                    invalidateJob();
                    showTab('data');
                }),
                button(
                    __('Move up', 'ramsey-labels-independent'),
                    () => {
                        if (index === 0) return;
                        [state.records[index - 1], state.records[index]] = [
                            state.records[index],
                            state.records[index - 1],
                        ];
                        state.queueSort = 'selection';
                        window.RLIBatches.rememberManualOrder(state.records);
                        invalidateJob();
                        showTab('data');
                    },
                    index === 0,
                ),
                button(
                    __('Move down', 'ramsey-labels-independent'),
                    () => {
                        if (index >= state.records.length - 1) return;
                        [state.records[index + 1], state.records[index]] = [
                            state.records[index],
                            state.records[index + 1],
                        ];
                        state.queueSort = 'selection';
                        window.RLIBatches.rememberManualOrder(state.records);
                        invalidateJob();
                        showTab('data');
                    },
                    index === state.records.length - 1,
                ),
            );
            area.append(row);
        }
    }
    async function prepare() {
        if (state.busy) return;
        state.busy = true;
        R.releaseJob(state.job);
        state.job = null;
        const generation = state.generation;
        const snapshot = JSON.stringify([state.profile, state.records]);
        const [profile, records] = JSON.parse(snapshot);
        try {
            C.validateDesign(state.profile.design).forEach((e) => {
                throw Error(e);
            });
            msg(__('Rendering job…', 'ramsey-labels-independent'));
            const segment = window.RLIBatches.segment(records, profile, state.segment);
            const job = await R.prepareJob(segment.profile, segment.records, {
                cancelled: () => state.generation !== generation,
                /* translators: 1: rendered unique records, 2: total unique records. */
                progress: (done, total) =>
                    msg(
                        sprintf(
                            /* translators: completed records; total unique records. */ __(
                                'Rendering %1$s / %2$s',
                                'ramsey-labels-independent',
                            ),
                            done,
                            total,
                        ),
                    ),
            });
            if (snapshot !== JSON.stringify([state.profile, state.records])) {
                R.releaseJob(job);
                throw Error(
                    __(
                        'Queue or profile changed while rendering. Generate a new preview.',
                        'ramsey-labels-independent',
                    ),
                );
            }
            if (state.generation !== generation) {
                R.releaseJob(job);
                throw Error(__('Print job cancelled.', 'ramsey-labels-independent'));
            }
            state.job = job;
            state.segment = segment.index;
            state.segmentInfo = segment;
            /* translators: 1: current segment labels, 2: current segment pages, 3: warnings. */
            msg(
                sprintf(
                    /* translators: label count; page count; warning count. */ __(
                        'Ready: %1$s labels, %2$s pages. %3$s warnings.',
                        'ramsey-labels-independent',
                    ),
                    job.layout.total,
                    job.layout.pages.length,
                    job.issues.length,
                ),
            );
            showTab('print');
        } finally {
            state.busy = false;
        }
    }
    function printTab(area) {
        if (state.segmentInfo && state.segmentInfo.count > 1) {
            const info = state.segmentInfo;
            /* translators: 1: segment number, 2: number of segments, 3: total labels. */
            area.append(
                el('p', {
                    text: sprintf(
                        /* translators: current segment; total segments; total labels. */ __(
                            'Segment %1$s of %2$s; %3$s total labels. Every segment is available; no labels are truncated.',
                            'ramsey-labels-independent',
                        ),
                        info.index + 1,
                        info.count,
                        info.total,
                    ),
                }),
            );
            const navigate = async (delta) => {
                if (state.busy)
                    throw Error(
                        __('Preview is still rendering. Please wait.', 'ramsey-labels-independent'),
                    );
                state.segment += delta;
                R.releaseJob(state.job);
                state.job = null;
                await prepare();
            };
            area.append(
                button(
                    __('Previous segment', 'ramsey-labels-independent'),
                    () => navigate(-1),
                    info.index === 0,
                ),
                button(
                    __('Next segment', 'ramsey-labels-independent'),
                    () => navigate(1),
                    info.index + 1 === info.count,
                ),
            );
        }
        area.append(
            el('p', {
                text: __(
                    'Browser print: set scale to 100%, margins to none, and disable headers/footers. For PDF use the export button.',
                    'ramsey-labels-independent',
                ),
            }),
        );
        area.append(
            el('div', { class: 'rli-toolbar' }, [
                button(__('Generate preview', 'ramsey-labels-independent'), prepare),
                button(__('Print', 'ramsey-labels-independent'), async () => {
                    if (state.busy)
                        throw Error(
                            __(
                                'Preview is still rendering. Please wait.',
                                'ramsey-labels-independent',
                            ),
                        );
                    if (!state.job) await prepare();
                    if (state.job) {
                        const job = state.job;
                        await R.printJob(job, { cancelled: () => state.job !== job });
                    }
                }),
                button(
                    state.segmentInfo?.count > 1
                        ? __('Export segment PDF', 'ramsey-labels-independent')
                        : __('Export PDF', 'ramsey-labels-independent'),
                    async () => {
                        if (state.busy)
                            throw Error(
                                __(
                                    'Preview is still rendering. Please wait.',
                                    'ramsey-labels-independent',
                                ),
                            );
                        if (!state.job) await prepare();
                        if (state.job) {
                            const job = state.job;
                            const blob = await R.exportPDF(job);
                            if (state.job !== job)
                                throw Error(
                                    __(
                                        'Export cancelled because the queue or profile changed.',
                                        'ramsey-labels-independent',
                                    ),
                                );
                            const info = state.segmentInfo;
                            R.download(
                                blob,
                                info && info.count > 1
                                    ? 'ramsey-labels-segment-' +
                                          (info.index + 1) +
                                          '-of-' +
                                          info.count +
                                          '.pdf'
                                    : 'ramsey-labels.pdf',
                            );
                        }
                    },
                ),
                button(__('Export full PDF', 'ramsey-labels-independent'), async () => {
                    if (state.busy)
                        throw Error(
                            __(
                                'A print operation is already in progress.',
                                'ramsey-labels-independent',
                            ),
                        );
                    const generation = state.generation;
                    const [profile, records] = C.clone([state.profile, state.records]);
                    state.busy = true;
                    state.exporting = true;
                    for (const control of root.querySelectorAll('button,input,select,textarea'))
                        if (
                            control.dataset.rliAction !==
                            __('Cancel current operation', 'ramsey-labels-independent')
                        )
                            control.disabled = true;
                    let file;
                    try {
                        let chunks = [],
                            bytes = 0;
                        if (typeof window.showSaveFilePicker === 'function') {
                            const handle = await window.showSaveFilePicker({
                                suggestedName: 'ramsey-labels.pdf',
                                types: [
                                    {
                                        description: __(
                                            'PDF document',
                                            'ramsey-labels-independent',
                                        ),
                                        accept: { 'application/pdf': ['.pdf'] },
                                    },
                                ],
                            });
                            file = await handle.createWritable();
                        }
                        const sink = file || {
                            write: (chunk) => {
                                bytes += chunk.length;
                                if (bytes > 32 * 1024 * 1024)
                                    throw Error(
                                        __(
                                            'This browser needs segment downloads for a PDF this large, or a browser with file streaming support.',
                                            'ramsey-labels-independent',
                                        ),
                                    );
                                chunks.push(chunk);
                            },
                            close: () => {},
                            abort: () => {
                                chunks = [];
                            },
                        };
                        await R.exportPDFStream(profile, records, sink, {
                            cancelled: () => state.generation !== generation,
                            /* translators: 1: exported labels, 2: total labels. */
                            progress: (done, total) =>
                                msg(
                                    sprintf(
                                        /* translators: labels exported; total labels. */ __(
                                            'Exporting %1$s of %2$s labels',
                                            'ramsey-labels-independent',
                                        ),
                                        done,
                                        total,
                                    ),
                                ),
                        });
                        if (!file)
                            R.download(
                                new Blob(chunks, { type: 'application/pdf' }),
                                'ramsey-labels.pdf',
                            );
                    } catch (error) {
                        try {
                            await file?.abort?.();
                        } catch {
                            /* An already-aborted sink must not mask the original error. */
                        }
                        throw error;
                    } finally {
                        state.busy = false;
                        state.exporting = false;
                        render();
                    }
                    msg(__('Complete PDF exported.', 'ramsey-labels-independent'));
                }),
                button(__('Cancel current operation', 'ramsey-labels-independent'), () => {
                    state.generation++;
                }),
                button(__('Export label PNG', 'ramsey-labels-independent'), async () => {
                    if (state.busy)
                        throw Error(
                            __(
                                'Preview is still rendering. Please wait.',
                                'ramsey-labels-independent',
                            ),
                        );
                    if (!state.job) await prepare();
                    const job = state.job;
                    if (!job) return;
                    const blob = await R.exportPNG(
                        job.profile.design,
                        state.segmentInfo.records[0],
                        { dpi: job.layout.page.dpi },
                    );
                    if (state.job !== job)
                        throw Error(
                            __(
                                'Export cancelled because the queue or profile changed.',
                                'ramsey-labels-independent',
                            ),
                        );
                    R.download(blob, 'ramsey-labels-label.png');
                }),
                button(__('Export full-label SVG', 'ramsey-labels-independent'), async () => {
                    if (state.busy)
                        throw Error(
                            __(
                                'Preview is still rendering. Please wait.',
                                'ramsey-labels-independent',
                            ),
                        );
                    if (!state.job) await prepare();
                    if (state.job)
                        R.download(
                            await R.exportSVG(
                                state.job.profile.design,
                                state.segmentInfo.records[0],
                            ),
                            'ramsey-labels-label.svg',
                        );
                }),
                button(__('Export barcode SVG', 'ramsey-labels-independent'), async () => {
                    if (state.busy)
                        throw Error(
                            __(
                                'Preview is still rendering. Please wait.',
                                'ramsey-labels-independent',
                            ),
                        );
                    if (!state.job) await prepare();
                    if (state.job)
                        R.download(
                            R.exportBarcodeSVG(
                                state.job.profile.design,
                                state.segmentInfo.records[0],
                            ),
                            'ramsey-labels-barcode.svg',
                        );
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
                text: __(
                    'Read-only inspection first. Importing creates a backup of Ramsey Labels settings and never modifies the original plugin.',
                    'ramsey-labels-independent',
                ),
            }),
        );
        area.append(
            button(__('Inspect installed plugin', 'ramsey-labels-independent'), async () => {
                const result = await request('migration');
                area.append(el('pre', { text: JSON.stringify(result, null, 2) }));
            }),
            button(__('Preview migration', 'ramsey-labels-independent'), async () => {
                const plan = await request('migration', 'POST', { action: 'preview' });
                area.append(el('pre', { text: JSON.stringify(plan, null, 2) }));
                if (plan.hash)
                    area.append(
                        button(
                            __('Apply previewed migration', 'ramsey-labels-independent'),
                            async () => {
                                if (
                                    !confirm(
                                        __(
                                            'Apply this migration to Ramsey Labels settings?',
                                            'ramsey-labels-independent',
                                        ),
                                    )
                                )
                                    return;
                                const result = await request('migration', 'POST', {
                                    action: 'apply',
                                    hash: plan.hash,
                                });
                                msg(
                                    __(
                                        'Migration completed. Reload to see changes.',
                                        'ramsey-labels-independent',
                                    ),
                                );
                            },
                        ),
                    );
            }),
            button(__('Restore migration backup', 'ramsey-labels-independent'), async () => {
                if (
                    !confirm(
                        __(
                            'Restore saved Ramsey Labels settings from before migration?',
                            'ramsey-labels-independent',
                        ),
                    )
                )
                    return;
                await request('migration', 'POST', { action: 'restore', confirmed: true });
                location.reload();
            }),
        );
    }
    window.RamseyLabels = Object.freeze({
        version: B.version,
        queueRecords: (records) => {
            appendRecords(records);
            showTab('data');
        },
        queueProducts: async (ids) => {
            state.source = 'products';
            await loadRecords(ids);
        },
        clear: () => {
            if (state.exporting)
                throw Error(
                    __('Cancel the export before clearing the queue.', 'ramsey-labels-independent'),
                );
            state.records = [];
            invalidateJob();
            showTab('data');
        },
        showPreview: () => showTab('print'),
        cancel: () => {
            state.generation++;
        },
        refresh: render,
        encode: window.RLIBarcodes.encode,
        exports: Object.freeze({
            png: R.exportPNG,
            svg: R.exportSVG,
            barcodeSVG: R.exportBarcodeSVG,
            calibrationSVG: R.exportCalibrationSVG,
            pdf: R.exportPDF,
            streamPDF: R.exportPDFStream,
        }),
        segment: window.RLIBatches.segment,
        restoreDraft: () => {
            let draft;
            try {
                draft = JSON.parse(localStorage.getItem('ramsey-labels-draft-v1') || 'null');
            } catch {}
            if (
                !draft ||
                Date.now() - draft.updated > 7 * 24 * 60 * 60 * 1000 ||
                !Array.isArray(draft.records)
            )
                return false;
            appendRecords(draft.records);
            showTab('data');
            return true;
        },
        saveDraft: () => {
            if (
                !confirm(
                    __(
                        'Save this queue in this browser? The draft may contain customer data and is not sent to WordPress.',
                        'ramsey-labels-independent',
                    ),
                )
            )
                return false;
            localStorage.setItem(
                'ramsey-labels-draft-v1',
                JSON.stringify({ updated: Date.now(), records: state.records }),
            );
            return true;
        },
    });
    R.configure({
        imageResolver: async (id) => {
            if (typeof id === 'string' && /^(https?:|data:image\/|blob:)/i.test(id)) return id;
            const attachment = String(id).replace(/^wp-image:/, '');
            if (!/^\d+$/.test(attachment))
                throw Error(__('Select a local media attachment.', 'ramsey-labels-independent'));
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
