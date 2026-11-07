/** Canvas label rendering, lossless PDF export, and isolated browser printing. */
(function (root) {
    'use strict';
    const __ = (message, domain) => globalThis.wp?.i18n?.__(message, domain) ?? message;
    const sprintf = (format, ...values) => {
        if (globalThis.wp?.i18n?.sprintf) return globalThis.wp.i18n.sprintf(format, ...values);
        let index = 0;
        return format.replace(/%%|%(?:(\d+)\$)?s/g, (token, position) =>
            token === '%%' ? '%' : String(values[position ? Number(position) - 1 : index++]),
        );
    };

    const C = root.RLICore,
        B = root.RLIBarcodes;
    const imageCache = new Map(),
        barcodeCache = new Map();
    const imageWeights = new Map(),
        symbolWeights = new Map();
    let imageBytes = 0,
        symbolBytes = 0;
    const IMAGE_CACHE_BYTES = 64 * 1024 * 1024,
        SYMBOL_CACHE_BYTES = 16 * 1024 * 1024;
    function dropImage(key) {
        imageBytes -= imageWeights.get(key) || 0;
        imageWeights.delete(key);
        imageCache.delete(key);
    }
    function clearCaches() {
        imageCache.clear();
        barcodeCache.clear();
        imageWeights.clear();
        symbolWeights.clear();
        imageBytes = 0;
        symbolBytes = 0;
    }
    function cacheStats() {
        return {
            imageBytes,
            symbolBytes,
            imageLimit: IMAGE_CACHE_BYTES,
            symbolLimit: SYMBOL_CACHE_BYTES,
            imageEntries: imageCache.size,
            symbolEntries: barcodeCache.size,
        };
    }
    let imageResolver = async (src) => src;
    let afterRender = null;
    const approvedOrigins = new Set();
    const trustedBlobs = new Set();
    const mmToPt = (mm) => (Number(mm) * 72) / 25.4;
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const escapeHTML = (value) =>
        String(value).replace(
            /[&<>"']/g,
            (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
        );
    function configure(options) {
        if (options.imageResolver) {
            imageResolver = options.imageResolver;
            clearCaches();
        }
        if (options.afterRender !== undefined)
            afterRender = typeof options.afterRender === 'function' ? options.afterRender : null;
    }
    async function safeImageSource(src) {
        if (!/^https?:/i.test(src)) return { src, revoke: () => {} };
        const url = new URL(src, location.href);
        if (url.username || url.password)
            throw Error(
                __('Image URLs must not contain credentials.', 'ramsey-labels-independent'),
            );
        if (url.origin !== location.origin) {
            const host = url.hostname.toLowerCase().replace(/\.$/, '');
            if (
                /^(?:localhost$|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|\[)/.test(
                    host,
                ) ||
                /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
                /\.(?:localhost|local|internal|lan|home|home\.arpa)$/.test(host)
            )
                throw Error(
                    __(
                        'Private-network image URLs are not allowed. Select a local media attachment.',
                        'ramsey-labels-independent',
                    ),
                );
            if (!approvedOrigins.has(url.origin)) {
                /* translators: %s: external image origin. */
                if (
                    !confirm(
                        sprintf(
                            /* translators: external image origin. */ __(
                                'This label requests an image from %s. Loading it discloses your IP address to that server. Allow for this session?',
                                'ramsey-labels-independent',
                            ),
                            url.origin,
                        ),
                    )
                )
                    throw Error(
                        __(
                            'External image request declined. Select a local attachment instead.',
                            'ramsey-labels-independent',
                        ),
                    );
                approvedOrigins.add(url.origin);
            }
        }
        const controller = new AbortController(),
            timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(url, {
                credentials: 'omit',
                redirect: 'error',
                mode: 'cors',
                referrerPolicy: 'no-referrer',
                signal: controller.signal,
            });
            const type = (response.headers.get('Content-Type') || '').split(';')[0].toLowerCase();
            if (
                !response.ok ||
                !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(type)
            )
                throw Error(
                    __(
                        'Remote images must be successful PNG, JPEG, GIF or WebP responses.',
                        'ramsey-labels-independent',
                    ),
                );
            const reader = response.body.getReader(),
                chunks = [];
            let bytes = 0;
            while (true) {
                const part = await reader.read();
                if (part.done) break;
                bytes += part.value.byteLength;
                if (bytes > 8000000) {
                    controller.abort();
                    throw Error(
                        __('Image exceeds the 8 MB transfer budget.', 'ramsey-labels-independent'),
                    );
                }
                chunks.push(part.value);
            }
            const object = URL.createObjectURL(new Blob(chunks, { type }));
            trustedBlobs.add(object);
            return { src: object, revoke: () => URL.revokeObjectURL(object) };
        } finally {
            clearTimeout(timer);
        }
    }
    function loadImage(source) {
        if (!source) return Promise.resolve(null);
        if (imageCache.has(source)) return imageCache.get(source);
        const promise = Promise.resolve(imageResolver(source))
            .then(safeImageSource)
            .then(
                ({ src, revoke }) =>
                    new Promise((resolve, reject) => {
                        if (/^https?:/i.test(src)) {
                            const url = new URL(src, location.href);
                            if (url.username || url.password) {
                                reject(
                                    new Error(
                                        __(
                                            'Image URLs must not contain credentials.',
                                            'ramsey-labels-independent',
                                        ),
                                    ),
                                );
                                return;
                            }
                            if (
                                url.origin !== location.origin &&
                                !approvedOrigins.has(url.origin)
                            ) {
                                if (
                                    !confirm(
                                        /* translators: %1$s: url.origin. */
                                        sprintf(
                                            /* translators: external image origin. */ __(
                                                'This label requests an image from %s. Loading it discloses your IP address to that server. Allow for this session?',
                                                'ramsey-labels-independent',
                                            ),
                                            url.origin,
                                        ),
                                    )
                                ) {
                                    reject(
                                        new Error(
                                            __(
                                                'External image request declined. Select a local attachment instead.',
                                                'ramsey-labels-independent',
                                            ),
                                        ),
                                    );
                                    return;
                                }
                                approvedOrigins.add(url.origin);
                            }
                        }
                        if (
                            !/^(data:image\/(png|jpeg|jpg|gif|webp);|https?:\/\/|blob:)/i.test(src)
                        ) {
                            reject(
                                new Error(
                                    __(
                                        'Image source must be a media attachment, a data image, or an HTTP(S) image.',
                                        'ramsey-labels-independent',
                                    ),
                                ),
                            );
                            return;
                        }
                        if (src.startsWith('blob:') && !trustedBlobs.has(src)) {
                            reject(
                                new Error(
                                    __(
                                        'Unverified blob image sources are not allowed.',
                                        'ramsey-labels-independent',
                                    ),
                                ),
                            );
                            return;
                        }
                        const image = new Image();
                        image.crossOrigin = 'anonymous';
                        const timer = setTimeout(() => {
                            revoke();
                            image.src = '';
                            reject(
                                new Error(
                                    __(
                                        'Image did not finish loading within 15 seconds.',
                                        'ramsey-labels-independent',
                                    ),
                                ),
                            );
                        }, 15000);
                        image.onload = () => {
                            clearTimeout(timer);
                            revoke();
                            trustedBlobs.delete(src);
                            if (image.naturalWidth * image.naturalHeight > 16000000) {
                                reject(
                                    Error(
                                        __(
                                            'Image exceeds the 16-megapixel decoding budget.',
                                            'ramsey-labels-independent',
                                        ),
                                    ),
                                );
                                return;
                            }
                            const weight =
                                image.naturalWidth * image.naturalHeight * 4 +
                                String(source).length * 2 +
                                512;
                            if (imageCache.get(source) === promise) {
                                imageWeights.set(source, weight);
                                imageBytes += weight;
                                while (imageBytes > IMAGE_CACHE_BYTES && imageCache.size)
                                    dropImage(imageCache.keys().next().value);
                            }
                            resolve(image);
                        };
                        image.onerror = () => {
                            clearTimeout(timer);
                            revoke();
                            trustedBlobs.delete(src);
                            reject(
                                new Error(
                                    __(
                                        'Image could not be loaded. For a CDN image, enable its CORS headers or select a local media attachment.',
                                        'ramsey-labels-independent',
                                    ),
                                ),
                            );
                        };
                        image.src = src;
                    }),
            );
        imageCache.set(source, promise);
        promise.catch(() => {
            if (imageCache.get(source) === promise) dropImage(source);
        });
        if (imageCache.size > 500) dropImage(imageCache.keys().next().value);
        return promise;
    }
    function wrappedLines(ctx, text, width) {
        const lines = [];
        for (const paragraph of String(text).replace(/\r\n?/g, '\n').split('\n')) {
            if (!paragraph) {
                lines.push('');
                continue;
            }
            const words = paragraph.split(/(\s+)/),
                segments = [];
            for (const word of words) {
                if (ctx.measureText(word).width <= width) segments.push(word);
                else {
                    let piece = '';
                    for (const char of Array.from(word)) {
                        if (piece && ctx.measureText(piece + char).width > width) {
                            segments.push(piece);
                            piece = '';
                        }
                        piece += char;
                    }
                    if (piece) segments.push(piece);
                }
            }
            let line = '';
            for (const part of segments) {
                if (line && ctx.measureText(line + part).width > width) {
                    lines.push(line.trimEnd());
                    line = part.trimStart();
                } else line += part;
            }
            lines.push(line.trimEnd());
        }
        return lines;
    }
    function fontString(e, size) {
        const family = [
            'Arial',
            'Verdana',
            'Georgia',
            'Times New Roman',
            'Courier New',
            'sans-serif',
            'serif',
            'monospace',
        ].includes(e.fontFamily)
            ? e.fontFamily
            : 'Arial';
        return (
            (e.italic ? 'italic ' : '') +
            (e.bold ? 'bold ' : '') +
            size +
            'px ' +
            (['sans-serif', 'serif', 'monospace'].includes(family)
                ? family
                : JSON.stringify(family))
        );
    }
    function drawText(ctx, text, e, width, height, dpi, issues) {
        let size = (e.fontSize * dpi) / 72,
            lines,
            lineHeight;
        const min = Math.min(size, Math.max(1, (e.minFontSize * dpi) / 72));
        const fits = (candidate) => {
            ctx.font = fontString(e, candidate);
            lines = wrappedLines(ctx, text, width);
            lineHeight = candidate * 1.16;
            return (
                lines.length * lineHeight <= height + 0.2 &&
                lines.every((line) => ctx.measureText(line).width <= width + 0.2)
            );
        };
        if (!fits(size) && e.autoFit) {
            if (fits(min)) {
                let low = min,
                    high = size;
                for (let step = 0; step < 12; step++) {
                    const mid = (low + high) / 2;
                    if (fits(mid)) low = mid;
                    else high = mid;
                }
                size = Math.max(min, Math.floor(low * 2) / 2);
                fits(size);
            } else {
                size = min;
            }
        }
        if (
            text &&
            (lines.length * lineHeight > height + 0.2 ||
                lines.some((line) => ctx.measureText(line).width > width + 0.2))
        ) {
            issues.push({
                severity: 'error',
                element: e.id,
                message: __(
                    'Text does not fit at the minimum font size. Enlarge this element or reduce its minimum font size.',
                    'ramsey-labels-independent',
                ),
            });
            return;
        }
        ctx.fillStyle = e.color;
        ctx.direction = ['inherit', 'ltr', 'rtl'].includes(e.direction) ? e.direction : 'inherit';
        ctx.textBaseline = 'top';
        ctx.textAlign = ['left', 'center', 'right'].includes(e.align) ? e.align : 'left';
        const x = ctx.textAlign === 'center' ? width / 2 : ctx.textAlign === 'right' ? width : 0;
        const top =
            e.vAlign === 'bottom'
                ? height - lines.length * lineHeight
                : e.vAlign === 'top'
                  ? 0
                  : (height - lines.length * lineHeight) / 2;
        lines.forEach((line, i) => {
            const y = Math.max(0, top) + i * lineHeight;
            ctx.fillText(line, x, y);
            if (e.underline) {
                const w = ctx.measureText(line).width,
                    left =
                        x -
                        (ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0);
                ctx.fillRect(left, y + size * 1.02, w, Math.max(1, size / 16));
            }
        });
    }
    function symbolFor(e, text) {
        const key = JSON.stringify([e.format, text, e.ecc, Boolean(e.gs1)]);
        if (barcodeCache.has(key)) return barcodeCache.get(key);
        const symbol = B.encode(e.format, text, { ecc: e.ecc, gs1: Boolean(e.gs1) });
        const weight = symbol.width * symbol.height * 8 + key.length * 2 + 512;
        barcodeCache.set(key, symbol);
        symbolWeights.set(key, weight);
        symbolBytes += weight;
        while (
            (symbolBytes > SYMBOL_CACHE_BYTES || barcodeCache.size > 1000) &&
            barcodeCache.size
        ) {
            const oldest = barcodeCache.keys().next().value;
            symbolBytes -= symbolWeights.get(oldest) || 0;
            symbolWeights.delete(oldest);
            barcodeCache.delete(oldest);
        }
        return symbol;
    }
    function drawBarcode(ctx, text, e, width, height, dpi, issues) {
        const symbol = symbolFor(e, text),
            q = symbol.quiet;
        const textHeight = e.showText ? ((e.fontSize * dpi) / 72) * 1.3 : 0,
            areaHeight = height - textHeight;
        const module = Math.floor(
            symbol.kind === 'linear'
                ? width / (symbol.width + 2 * q)
                : Math.min(width / (symbol.width + 2 * q), areaHeight / (symbol.height + 2 * q)),
        );
        if (module < 1 || areaHeight < 1)
            throw new Error(
                __(
                    'Barcode is too dense for this box/resolution. Enlarge it, shorten the value, or increase print DPI.',
                    'ramsey-labels-independent',
                ),
            );
        if ((module * 25.4) / dpi < 0.19)
            issues.push({
                severity: 'warning',
                element: e.id,
                message:
                    /* translators: %1$s: ((module * 25.4) / dpi).toFixed(3). */
                    sprintf(
                        /* translators: barcode module width in millimeters. */ __(
                            'Narrow barcode modules (%s mm). Verify scanner readability on the actual printer.',
                            'ramsey-labels-independent',
                        ),
                        ((module * 25.4) / dpi).toFixed(3),
                    ),
            });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#000000';
        const left = Math.floor((width - (symbol.width + 2 * q) * module) / 2) + q * module;
        const top =
            symbol.kind === 'linear'
                ? 0
                : Math.floor((areaHeight - (symbol.height + 2 * q) * module) / 2) + q * module;
        const barHeight = Math.floor(areaHeight);
        for (let y = 0; y < symbol.matrix.length; y++) {
            let start = -1;
            for (let x = 0; x <= symbol.width; x++) {
                if (x < symbol.width && symbol.matrix[y][x]) {
                    if (start < 0) start = x;
                } else if (start >= 0) {
                    ctx.fillRect(
                        left + start * module,
                        top + y * module,
                        (x - start) * module,
                        symbol.kind === 'linear' ? barHeight : module,
                    );
                    start = -1;
                }
            }
        }
        if (e.showText) {
            ctx.save();
            ctx.translate(0, height - textHeight);
            drawText(
                ctx,
                symbol.text.replace(/[\x00-\x1f\x7f]/g, ''),
                Object.assign({}, e, { autoFit: true, align: 'center', vAlign: 'middle' }),
                width,
                textHeight,
                dpi,
                issues,
            );
            ctx.restore();
        }
    }
    function transformedText(e, record) {
        let text = C.resolve(e.content, record);
        if (e.transform === 'upper') text = text.toUpperCase();
        if (e.transform === 'lower') text = text.toLowerCase();
        if (e.transform === 'title') text = text.replace(/\b\w/g, (c) => c.toUpperCase());
        return (text ? e.prefix || '' : '') + text + (text ? e.suffix || '' : '');
    }
    /** Only inert formatting markup is allowed. No scripts, links, forms or external CSS. */
    function sanitizeHTML(html) {
        const template = document.createElement('template');
        template.innerHTML = String(html);
        const body = template.content;
        const allowed = new Set([
            'DIV',
            'SPAN',
            'P',
            'BR',
            'TABLE',
            'THEAD',
            'TBODY',
            'TFOOT',
            'TR',
            'TD',
            'TH',
            'IMG',
            'B',
            'STRONG',
            'I',
            'EM',
            'U',
            'S',
            'SMALL',
            'H1',
            'H2',
            'H3',
            'HR',
            'UL',
            'OL',
            'LI',
        ]);
        for (const node of Array.from(body.querySelectorAll('*'))) {
            if (!allowed.has(node.tagName)) {
                node.remove();
                continue;
            }
            for (const attr of Array.from(node.attributes)) {
                if (
                    ![
                        'style',
                        'class',
                        'id',
                        'src',
                        'alt',
                        'width',
                        'height',
                        'colspan',
                        'rowspan',
                    ].includes(attr.name)
                )
                    node.removeAttribute(attr.name);
            }
            if (node.hasAttribute('style'))
                node.setAttribute('style', sanitizeCSS(node.getAttribute('style')));
            if (
                node.tagName === 'IMG' &&
                !/^(https?:\/\/|data:image\/(png|jpeg|jpg|webp|gif);|wp-image:\d+$)/i.test(
                    node.getAttribute('src') || '',
                )
            )
                node.removeAttribute('src');
        }
        return template.innerHTML;
    }
    function sanitizeCSS(css) {
        css = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
        // Reject escaped identifiers, at-rules and image functions rather than
        // attempting to recognize every browser's URL-bearing CSS grammar.
        if (
            /[\\@<>]/.test(css) ||
            /(?:url|image-set|expression|behavior|-moz-binding)\s*[:(]/i.test(css)
        )
            return '';
        return css;
    }
    async function renderHTML(design, record, canvas, issues) {
        const scale = canvas.width / design.width,
            values = Object.assign({}, record.values);
        if (design.html.includes('barcode_image') || design.html.includes('barcode_img_url')) {
            const symbol = B.encode(
                design.htmlBarcodeFormat || 'code128',
                C.resolve(design.htmlBarcodeSource || '{{sku|id}}', record),
            );
            const small = document.createElement('canvas');
            small.width = Math.max(100, Math.ceil(design.width * scale));
            small.height = Math.max(100, Math.ceil((design.height * scale) / 2));
            drawBarcode(
                small.getContext('2d'),
                symbol.text,
                C.element('barcode', {
                    format: design.htmlBarcodeFormat || 'code128',
                    content: symbol.text,
                }),
                small.width,
                small.height,
                scale * 25.4,
                issues,
            );
            values.barcode_image = small.toDataURL('image/png');
            values.barcode_img_url = values.barcode_image;
        }
        const html = C.resolve(design.html, { values }, { escape: escapeHTML, maxLength: 200000 });
        const holder = document.createElement('template');
        holder.innerHTML = sanitizeHTML(html);
        for (const tag of holder.content.querySelectorAll('img')) {
            const src = tag.getAttribute('src');
            if (!src) continue;
            const img = await loadImage(src),
                tmp = document.createElement('canvas');
            tmp.width = img.naturalWidth;
            tmp.height = img.naturalHeight;
            if (tmp.width * tmp.height > 16000000)
                throw new Error(
                    __(
                        'An HTML image exceeds the 16-megapixel safety limit.',
                        'ramsey-labels-independent',
                    ),
                );
            tmp.getContext('2d').drawImage(img, 0, 0);
            tag.setAttribute('src', tmp.toDataURL('image/png'));
        }
        const svgNS = 'http://www.w3.org/2000/svg',
            htmlNS = 'http://www.w3.org/1999/xhtml';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', String(canvas.width));
        svg.setAttribute('height', String(canvas.height));
        const foreign = document.createElementNS(svgNS, 'foreignObject');
        foreign.setAttribute('width', '100%');
        foreign.setAttribute('height', '100%');
        const wrapper = document.createElementNS(htmlNS, 'div');
        wrapper.setAttribute(
            'style',
            'width:' +
                (design.width * 96) / 25.4 +
                'px;height:' +
                (design.height * 96) / 25.4 +
                'px;background:white;overflow:hidden;transform:scale(' +
                (scale * 25.4) / 96 +
                ');transform-origin:0 0;font:12px Arial;',
        );
        const style = document.createElementNS(htmlNS, 'style');
        style.textContent =
            '*{box-sizing:border-box}body,p{margin:0}' + sanitizeCSS(design.css || '');
        wrapper.append(style);
        for (const node of Array.from(holder.content.childNodes))
            wrapper.append(node.cloneNode(true));
        foreign.append(wrapper);
        svg.append(foreign);
        const serialized = new XMLSerializer().serializeToString(svg),
            uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
        const img = await loadImage(uri);
        canvas.getContext('2d').drawImage(img, 0, 0);
        try {
            canvas.getContext('2d').getImageData(0, 0, 1, 1);
        } catch (error) {
            throw new Error(
                __(
                    'This browser cannot safely rasterize this HTML design. Use the visual designer or remove external image resources.',
                    'ramsey-labels-independent',
                ),
            );
        }
    }
    async function renderLabel(design, record, options = {}) {
        const dpi = Number(options.dpi || 300),
            scale = dpi / 25.4,
            canvas = document.createElement('canvas'),
            issues = [];
        const validation = C.validateDesign(design);
        if (validation.length) throw new Error(validation.join('\n'));
        const pixelWidth = Math.max(1, Math.round(design.width * scale)),
            pixelHeight = Math.max(1, Math.round(design.height * scale));
        if (!Number.isFinite(dpi) || dpi < 72 || dpi > 600 || pixelWidth * pixelHeight > 16000000)
            throw new Error(
                __(
                    'Label exceeds 16 megapixels or supported DPI. Reduce the size or print DPI.',
                    'ramsey-labels-independent',
                ),
            );
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        const ctx = canvas.getContext('2d');
        if (design.showCurrency === false && record.values?.currency_symbol) {
            record = C.clone(record);
            const symbol = String(record.values.currency_symbol);
            for (const key of [
                'price',
                'regular_price',
                'sale_price',
                'price_incl_tax',
                'price_excl_tax',
            ]) {
                if (record.values[key])
                    record.values[key] = String(record.values[key]).split(symbol).join('').trim();
            }
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (design.mode === 'html') {
            try {
                await renderHTML(design, record, canvas, issues);
            } catch (error) {
                issues.push({ severity: 'error', element: 'html', message: error.message });
            }
            return { canvas, issues };
        }
        for (const raw of design.elements) {
            const e = Object.assign(C.element(raw.type), raw);
            if (!e.visible || (e.condition && !C.resolve(e.condition, record))) continue;
            const x = e.x * scale,
                y = e.y * scale,
                w = e.w * scale,
                h = e.h * scale,
                rotation = (e.rotation * Math.PI) / 180;
            if (rotation) {
                const boundW = Math.abs(w * Math.cos(rotation)) + Math.abs(h * Math.sin(rotation));
                const boundH = Math.abs(w * Math.sin(rotation)) + Math.abs(h * Math.cos(rotation));
                if (
                    x + w / 2 - boundW / 2 < -0.1 ||
                    x + w / 2 + boundW / 2 > canvas.width + 0.1 ||
                    y + h / 2 - boundH / 2 < -0.1 ||
                    y + h / 2 + boundH / 2 > canvas.height + 0.1
                )
                    issues.push({
                        severity: 'error',
                        element: e.id,
                        message: __(
                            'Rotated element extends outside the label.',
                            'ramsey-labels-independent',
                        ),
                    });
            }
            ctx.save();
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate(rotation);
            ctx.translate(-w / 2, -h / 2);
            ctx.beginPath();
            ctx.rect(0, 0, w, h);
            ctx.clip();
            if (e.background && e.background !== 'transparent') {
                ctx.fillStyle = e.background;
                ctx.fillRect(0, 0, w, h);
            }
            try {
                const text = transformedText(e, record);
                if (e.type === 'text') drawText(ctx, text, e, w, h, dpi, issues);
                else if (e.type === 'barcode') drawBarcode(ctx, text, e, w, h, dpi, issues);
                else if (e.type === 'image' && text) {
                    const image = await loadImage(text),
                        ratio =
                            e.fit === 'cover'
                                ? Math.max(w / image.naturalWidth, h / image.naturalHeight)
                                : Math.min(w / image.naturalWidth, h / image.naturalHeight);
                    ctx.drawImage(
                        image,
                        (w - image.naturalWidth * ratio) / 2,
                        (h - image.naturalHeight * ratio) / 2,
                        image.naturalWidth * ratio,
                        image.naturalHeight * ratio,
                    );
                } else if (['rect', 'line', 'ellipse'].includes(e.type)) {
                    ctx.strokeStyle = e.color;
                    ctx.lineWidth = Math.max(0.25, e.strokeWidth * scale);
                    ctx.beginPath();
                    if (e.type === 'rect')
                        ctx.rect(
                            ctx.lineWidth / 2,
                            ctx.lineWidth / 2,
                            w - ctx.lineWidth,
                            h - ctx.lineWidth,
                        );
                    if (e.type === 'line') {
                        ctx.moveTo(0, h / 2);
                        ctx.lineTo(w, h / 2);
                    }
                    if (e.type === 'ellipse')
                        ctx.ellipse(
                            w / 2,
                            h / 2,
                            Math.max(0.1, (w - ctx.lineWidth) / 2),
                            Math.max(0.1, (h - ctx.lineWidth) / 2),
                            0,
                            0,
                            2 * Math.PI,
                        );
                    ctx.stroke();
                }
            } catch (error) {
                issues.push({ severity: 'error', element: e.id, message: error.message });
                ctx.fillStyle = '#fff0f0';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#a00000';
                ctx.font = Math.max(8, Math.min(12, dpi / 20)) + 'px Arial';
                ctx.fillText('ERROR: ' + error.message, 2, Math.min(h - 2, 14));
            }
            ctx.restore();
        }
        return { canvas, issues };
    }
    async function prepareJob(profile, records, options = {}) {
        const layout = C.paginate(records, profile, { segmented: true }),
            images = new Map(),
            issues = [];
        const indices = Array.from(
            new Set(layout.pages.flatMap((page) => page.map((s) => s.recordIndex))),
        );
        const pixels =
            Math.round((profile.design.width * layout.page.dpi) / 25.4) *
            Math.round((profile.design.height * layout.page.dpi) / 25.4);
        if (indices.length * pixels * 4 > 128 * 1024 * 1024)
            throw Error(
                __(
                    'Segment exceeds its decoded-image memory budget. Use fewer distinct records or lower DPI.',
                    'ramsey-labels-independent',
                ),
            );
        let bytes = 0;
        for (let k = 0; k < indices.length; k++) {
            if (options.cancelled && options.cancelled())
                throw new Error(__('Print job cancelled.', 'ramsey-labels-independent'));
            const index = indices[k],
                result = await renderLabel(profile.design, records[index], {
                    dpi: layout.page.dpi,
                });
            result.issues.forEach((issue) =>
                issues.push(
                    Object.assign(
                        { record: index, name: records[index].values.name || String(index + 1) },
                        issue,
                    ),
                ),
            );
            if (afterRender)
                await afterRender({
                    canvas: result.canvas,
                    record: C.clone(records[index]),
                    recordIndex: index,
                    profileId: profile.id,
                });
            document.dispatchEvent(
                new CustomEvent('ramsey-labels:after-render', {
                    detail: { canvas: result.canvas, recordIndex: index, profileId: profile.id },
                }),
            );
            if (result.canvas.width * result.canvas.height > 16000000)
                throw Error(
                    __(
                        'A render extension exceeded the pixel budget.',
                        'ramsey-labels-independent',
                    ),
                );
            const png = result.canvas.toDataURL('image/png');
            bytes += png.length;
            if (bytes > 120000000)
                throw new Error(
                    __(
                        'Rendered job exceeds 120 MB. Split this batch or reduce DPI.',
                        'ramsey-labels-independent',
                    ),
                );
            images.set(index, { png, width: result.canvas.width, height: result.canvas.height });
            result.canvas.width = 1;
            result.canvas.height = 1;
            if (options.progress) options.progress(k + 1, indices.length);
            if (k % 2 === 0) await nextFrame();
        }
        const errors = issues.filter((i) => i.severity === 'error');
        if (errors.length) {
            const error = new Error(
                /* translators: %1$s: errors.length; %2$s: errors
                        .slice(0, 6)
                        .map((i) => i.name + ' / ' + i.element + ': ' + i.message)
                        .join('\n'). */
                sprintf(
                    /* translators: error count; concise error summaries. */ __(
                        'Printing blocked: %1$s rendering error(s). %2$s',
                        'ramsey-labels-independent',
                    ),
                    errors.length,
                    errors
                        .slice(0, 6)
                        .map((i) => i.name + ' / ' + i.element + ': ' + i.message)
                        .join('\n'),
                ),
            );
            error.issues = issues;
            throw error;
        }
        return {
            layout,
            images,
            issues,
            profile: C.clone(profile),
            descriptions: records.map((record) =>
                [record.values.name, record.values.sku, record.values.price]
                    .filter(Boolean)
                    .join(' — ')
                    .slice(0, 500),
            ),
        };
    }
    function pageElement(job, index) {
        const page = document.createElement('div'),
            p = job.layout.page,
            d = job.profile.design;
        page.className = 'rli-print-page';
        Object.assign(page.style, {
            position: 'relative',
            width: p.width + 'mm',
            height: p.height + 'mm',
            background: '#fff',
            overflow: 'hidden',
            boxSizing: 'border-box',
        });
        for (const slot of job.layout.pages[index]) {
            const img = document.createElement('img');
            const image = job.images.get(slot.recordIndex);
            if (!image.url) {
                const binary = atob(image.png.slice(image.png.indexOf(',') + 1)),
                    bytes = new Uint8Array(binary.length);
                for (let k = 0; k < binary.length; k++) bytes[k] = binary.charCodeAt(k);
                image.url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
            }
            img.src = image.url;
            /* translators: %s: printed product name, SKU and price. */
            img.alt = job.descriptions?.[slot.recordIndex]
                ? sprintf(
                      /* translators: product name, SKU and price. */ __(
                          'Label: %s',
                          'ramsey-labels-independent',
                      ),
                      job.descriptions[slot.recordIndex],
                  )
                : __('Label', 'ramsey-labels-independent');
            Object.assign(img.style, {
                position: 'absolute',
                left: slot.x + 'mm',
                top: slot.y + 'mm',
                width: d.width + 'mm',
                height: d.height + 'mm',
                maxWidth: 'none',
                display: 'block',
                boxSizing: 'border-box',
            });
            if (p.outlines) img.style.outline = '0.15mm solid #888';
            page.append(img);
        }
        return page;
    }
    async function printJob(job, options = {}) {
        const previous = document.getElementById('rli-print-frame');
        if (previous) previous.remove();
        const frame = document.createElement('iframe');
        frame.id = 'rli-print-frame';
        frame.title = __('Ramsey Labels print document', 'ramsey-labels-independent');
        Object.assign(frame.style, {
            position: 'fixed',
            left: '-12000px',
            top: '0',
            width: '1000px',
            height: '700px',
            border: '0',
        });
        document.body.append(frame);
        const doc = frame.contentDocument;
        doc.open();
        doc.write(
            '<!doctype html><html><head><meta charset="utf-8"><title>Ramsey Labels</title></head><body></body></html>',
        );
        doc.close();
        const style = doc.createElement('style');
        style.textContent =
            '@page{size:' +
            job.layout.page.width +
            'mm ' +
            job.layout.page.height +
            'mm;margin:0}html,body{margin:0!important;padding:0!important;background:white}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}.rli-print-page{break-after:page;page-break-after:always}.rli-print-page:last-child{break-after:auto;page-break-after:auto}';
        doc.head.append(style);
        job.layout.pages.forEach((_, i) =>
            doc.body.append(doc.importNode(pageElement(job, i), true)),
        );
        await Promise.all(Array.from(doc.images).map((image) => image.decode()));
        await nextFrame();
        await nextFrame();
        if (options.cancelled?.()) {
            frame.remove();
            throw Error(
                __(
                    'Print cancelled because the queue or profile changed.',
                    'ramsey-labels-independent',
                ),
            );
        }
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return frame;
    }
    const ascii = (text) => new TextEncoder().encode(String(text));
    function concatenate(chunks) {
        const size = chunks.reduce((sum, b) => sum + b.length, 0),
            result = new Uint8Array(size);
        let offset = 0;
        for (const b of chunks) {
            result.set(b, offset);
            offset += b.length;
        }
        return result;
    }
    async function imageStream(image) {
        const img = await loadImage(image.png),
            canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        if (typeof CompressionStream !== 'undefined') {
            const compressor = new CompressionStream('deflate'),
                reader = compressor.readable.getReader(),
                writer = compressor.writable.getWriter(),
                compressed = [];
            const draining = (async () => {
                while (true) {
                    const item = await reader.read();
                    if (item.done) break;
                    compressed.push(item.value);
                }
            })();
            for (let top = 0; top < canvas.height; top += 16) {
                const height = Math.min(16, canvas.height - top),
                    rgba = ctx.getImageData(0, top, canvas.width, height).data,
                    rgb = new Uint8Array(canvas.width * height * 3);
                for (let i = 0, j = 0; i < rgba.length; i += 4) {
                    rgb[j++] = rgba[i];
                    rgb[j++] = rgba[i + 1];
                    rgb[j++] = rgba[i + 2];
                }
                await writer.write(rgb);
            }
            await writer.close();
            await draining;
            canvas.width = 1;
            canvas.height = 1;
            return { data: concatenate(compressed), filter: '/Filter /FlateDecode ' };
        }
        const chunks = [];
        for (let top = 0; top < canvas.height; top += 16) {
            const height = Math.min(16, canvas.height - top),
                rgba = ctx.getImageData(0, top, canvas.width, height).data,
                rgb = new Uint8Array(canvas.width * height * 3);
            for (let i = 0, j = 0; i < rgba.length; i += 4) {
                rgb[j++] = rgba[i];
                rgb[j++] = rgba[i + 1];
                rgb[j++] = rgba[i + 2];
            }
            chunks.push(rgb);
        }
        canvas.width = 1;
        canvas.height = 1;
        return { data: concatenate(chunks), filter: '' };
    }
    /** Minimal PDF 1.4 writer. RGB image streams are losslessly compressed, not JPEG. */
    async function exportPDF(job, options = {}) {
        const objects = [null, null],
            imageIds = new Map();
        const add = (bytes) => {
            objects.push(bytes);
            return objects.length;
        };
        let count = 0;
        for (const [index, image] of job.images) {
            if (options.cancelled && options.cancelled())
                throw new Error(__('PDF export cancelled.', 'ramsey-labels-independent'));
            const stream = await imageStream(image);
            imageIds.set(
                index,
                add(
                    concatenate([
                        ascii(
                            '<< /Type /XObject /Subtype /Image /Width ' +
                                image.width +
                                ' /Height ' +
                                image.height +
                                ' /ColorSpace /DeviceRGB /BitsPerComponent 8 ' +
                                stream.filter +
                                '/Length ' +
                                stream.data.length +
                                ' >>\nstream\n',
                        ),
                        stream.data,
                        ascii('\nendstream'),
                    ]),
                ),
            );
            if (options.progress) options.progress(++count, job.images.size);
            if (count % 10 === 0) await nextFrame();
        }
        const kids = [],
            p = job.layout.page,
            d = job.profile.design,
            number = (v) => Number(v).toFixed(5);
        for (const slots of job.layout.pages) {
            let commands = '',
                resources = '';
            const used = new Set();
            for (const slot of slots) {
                const id = imageIds.get(slot.recordIndex),
                    name = 'I' + id;
                if (!used.has(id)) {
                    resources += '/' + name + ' ' + id + ' 0 R ';
                    used.add(id);
                }
                commands +=
                    'q ' +
                    number(mmToPt(d.width)) +
                    ' 0 0 ' +
                    number(mmToPt(d.height)) +
                    ' ' +
                    number(mmToPt(slot.x)) +
                    ' ' +
                    number(mmToPt(p.height - slot.y - d.height)) +
                    ' cm /' +
                    name +
                    ' Do Q\n';
                if (p.outlines)
                    commands +=
                        'q 0.5 G 0.3 w ' +
                        number(mmToPt(slot.x)) +
                        ' ' +
                        number(mmToPt(p.height - slot.y - d.height)) +
                        ' ' +
                        number(mmToPt(d.width)) +
                        ' ' +
                        number(mmToPt(d.height)) +
                        ' re S Q\n';
            }
            const contents = ascii(commands),
                contentId = add(
                    concatenate([
                        ascii('<< /Length ' + contents.length + ' >>\nstream\n'),
                        contents,
                        ascii('endstream'),
                    ]),
                );
            const pageId = add(
                ascii(
                    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
                        number(mmToPt(p.width)) +
                        ' ' +
                        number(mmToPt(p.height)) +
                        '] /Resources << /XObject << ' +
                        resources +
                        '>> >> /Contents ' +
                        contentId +
                        ' 0 R >>',
                ),
            );
            kids.push(pageId);
        }
        objects[0] = ascii('<< /Type /Catalog /Pages 2 0 R >>');
        objects[1] = ascii(
            '<< /Type /Pages /Count ' +
                kids.length +
                ' /Kids [' +
                kids.map((id) => id + ' 0 R').join(' ') +
                '] >>',
        );
        const chunks = [ascii('%PDF-1.4\n%RLI lossless labels\n')],
            offsets = [0];
        let offset = chunks[0].length;
        objects.forEach((object, index) => {
            offsets.push(offset);
            const chunk = concatenate([ascii(index + 1 + ' 0 obj\n'), object, ascii('\nendobj\n')]);
            chunks.push(chunk);
            offset += chunk.length;
        });
        const xref = offset;
        let trailer = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
        for (let i = 1; i < offsets.length; i++)
            trailer += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
        trailer +=
            'trailer\n<< /Size ' +
            (objects.length + 1) +
            ' /Root 1 0 R >>\nstartxref\n' +
            xref +
            '\n%%EOF\n';
        chunks.push(ascii(trailer));
        return new Blob(chunks, { type: 'application/pdf' });
    }
    function download(blob, filename) {
        const a = document.createElement('a'),
            url = URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    async function exportPNG(design, record, options = {}) {
        const rendered = await renderLabel(design, record, options);
        const errors = rendered.issues.filter((issue) => issue.severity === 'error');
        if (errors.length) throw Error(errors.map((issue) => issue.message).join('\n'));
        const blob = await new Promise((resolve) => rendered.canvas.toBlob(resolve, 'image/png'));
        rendered.canvas.width = 1;
        rendered.canvas.height = 1;
        if (!blob) throw Error(__('PNG export failed.', 'ramsey-labels-independent'));
        return blob;
    }
    function exportSVG(design, record) {
        const errors = C.validateDesign(design);
        if (errors.length) throw Error(errors.join('\n'));
        const e =
            design.mode === 'html'
                ? C.element('barcode', {
                      format: design.htmlBarcodeFormat,
                      content: design.htmlBarcodeSource,
                  })
                : design.elements.find(
                      (element) =>
                          element.type === 'barcode' &&
                          element.visible &&
                          (!element.condition || C.resolve(element.condition, record)),
                  );
        if (!e)
            throw Error(
                __('This design has no visible barcode to export.', 'ramsey-labels-independent'),
            );
        return new Blob([B.toSVG(symbolFor(e, transformedText(e, record)))], {
            type: 'image/svg+xml',
        });
    }
    function releaseJob(job) {
        if (!job) return;
        for (const image of job.images.values()) {
            if (image.url) {
                URL.revokeObjectURL(image.url);
                delete image.url;
            }
            dropImage(image.png);
        }
    }
    /** Incremental PDF objects with bounded image buffers and filesystem backpressure. */
    async function exportPDFStream(profile, records, sink, options = {}) {
        if (!root.RLIBatches || !sink || typeof sink.write !== 'function')
            throw Error(
                __(
                    'Streaming PDF requires the batch module and a writable sink.',
                    'ramsey-labels-independent',
                ),
            );
        const first = root.RLIBatches.segment(records, profile, 0),
            offsets = [0, 0, 0],
            kids = [],
            imageIds = new Map();
        let offset = 0,
            nextId = 3,
            pending = [],
            pendingBytes = 0;
        const flush = async () => {
            if (pendingBytes) {
                await sink.write(concatenate(pending));
                pending = [];
                pendingBytes = 0;
            }
        };
        const write = async (bytes) => {
            offset += bytes.length;
            if (offset >= 10000000000)
                throw Error(
                    __(
                        'PDF exceeds the offset range of this format. Export separate segments.',
                        'ramsey-labels-independent',
                    ),
                );
            pending.push(bytes);
            pendingBytes += bytes.length;
            if (pendingBytes >= 131072) await flush();
        };
        const object = async (id, bytes) => {
            offsets[id] = offset;
            await write(concatenate([ascii(id + ' 0 obj\n'), bytes, ascii('\nendobj\n')]));
        };
        const cancelled = () => {
            if (options.cancelled?.())
                throw Error(
                    __(
                        'PDF export cancelled because the print data changed.',
                        'ramsey-labels-independent',
                    ),
                );
        };
        try {
            await write(ascii('%PDF-1.4\n%Ramsey Labels incremental PDF\n'));
            for (let index = 0; index < first.count; index++) {
                cancelled();
                const segment = root.RLIBatches.segment(records, profile, index);
                const job = await prepareJob(segment.profile, segment.records, {
                    cancelled: options.cancelled,
                });
                try {
                    const localIds = new Map();
                    for (const [local, image] of job.images) {
                        // Segment records preserve source order and key/value identity across copies.
                        const record = segment.records[local];
                        const identity = JSON.stringify([record.key, record.source, record.values]);
                        if (!imageIds.has(identity)) {
                            const id = nextId++,
                                stream = await imageStream(image);
                            await object(
                                id,
                                concatenate([
                                    ascii(
                                        '<< /Type /XObject /Subtype /Image /Width ' +
                                            image.width +
                                            ' /Height ' +
                                            image.height +
                                            ' /ColorSpace /DeviceRGB /BitsPerComponent 8 ' +
                                            stream.filter +
                                            '/Length ' +
                                            stream.data.length +
                                            ' >>\nstream\n',
                                    ),
                                    stream.data,
                                    ascii('\nendstream'),
                                ]),
                            );
                            imageIds.set(identity, id);
                        }
                        localIds.set(local, imageIds.get(identity));
                    }
                    const p = job.layout.page,
                        d = job.profile.design,
                        number = (v) => Number(v).toFixed(5);
                    for (const slots of job.layout.pages) {
                        cancelled();
                        let commands = '',
                            resources = '';
                        const used = new Set();
                        for (const slot of slots) {
                            const id = localIds.get(slot.recordIndex),
                                name = 'I' + id;
                            if (!used.has(id)) {
                                resources += '/' + name + ' ' + id + ' 0 R ';
                                used.add(id);
                            }
                            commands +=
                                'q ' +
                                number(mmToPt(d.width)) +
                                ' 0 0 ' +
                                number(mmToPt(d.height)) +
                                ' ' +
                                number(mmToPt(slot.x)) +
                                ' ' +
                                number(mmToPt(p.height - slot.y - d.height)) +
                                ' cm /' +
                                name +
                                ' Do Q\n';
                            if (p.outlines)
                                commands +=
                                    'q 0.5 G 0.3 w ' +
                                    number(mmToPt(slot.x)) +
                                    ' ' +
                                    number(mmToPt(p.height - slot.y - d.height)) +
                                    ' ' +
                                    number(mmToPt(d.width)) +
                                    ' ' +
                                    number(mmToPt(d.height)) +
                                    ' re S Q\n';
                        }
                        const contents = ascii(commands),
                            contentId = nextId++,
                            pageId = nextId++;
                        await object(
                            contentId,
                            concatenate([
                                ascii('<< /Length ' + contents.length + ' >>\nstream\n'),
                                contents,
                                ascii('endstream'),
                            ]),
                        );
                        await object(
                            pageId,
                            ascii(
                                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
                                    number(mmToPt(p.width)) +
                                    ' ' +
                                    number(mmToPt(p.height)) +
                                    '] /Resources << /XObject << ' +
                                    resources +
                                    '>> >> /Contents ' +
                                    contentId +
                                    ' 0 R >>',
                            ),
                        );
                        kids.push(pageId);
                        if (offsets.length * 8 + kids.length * 8 > 33554432)
                            throw Error(
                                __(
                                    'PDF index exceeds its memory budget. Export separate segments.',
                                    'ramsey-labels-independent',
                                ),
                            );
                    }
                    options.progress?.(segment.end, first.total);
                } finally {
                    releaseJob(job);
                }
            }
            await object(1, ascii('<< /Type /Catalog /Pages 2 0 R >>'));
            await object(
                2,
                ascii(
                    '<< /Type /Pages /Count ' +
                        kids.length +
                        ' /Kids [' +
                        kids.map((id) => id + ' 0 R').join(' ') +
                        '] >>',
                ),
            );
            const xref = offset;
            await write(ascii('xref\n0 ' + nextId + '\n0000000000 65535 f \n'));
            for (let id = 1; id < nextId; id++)
                await write(ascii(String(offsets[id]).padStart(10, '0') + ' 00000 n \n'));
            await write(
                ascii(
                    'trailer\n<< /Size ' +
                        nextId +
                        ' /Root 1 0 R >>\nstartxref\n' +
                        xref +
                        '\n%%EOF\n',
                ),
            );
            cancelled();
            await flush();
            await sink.close?.();
            return { pages: kids.length, labels: first.total, bytes: offset };
        } catch (error) {
            await sink.abort?.();
            throw error;
        }
    }
    root.RLIRender = Object.freeze({
        configure,
        renderLabel,
        prepareJob,
        pageElement,
        printJob,
        exportPDF,
        exportPDFStream,
        exportPNG,
        exportSVG,
        clearCaches,
        cacheStats,
        releaseJob,
        download,
        sanitizeHTML,
        sanitizeCSS,
        escapeHTML,
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
