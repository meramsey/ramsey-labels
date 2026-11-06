/** Canvas label rendering, lossless PDF export, and isolated browser printing. */
(function (root) {
    'use strict';
    const C = root.RLICore,
        B = root.RLIBarcodes;
    const imageCache = new Map(),
        barcodeCache = new Map();
    let imageResolver = async (src) => src;
    const approvedOrigins = new Set();
    const mmToPt = (mm) => (Number(mm) * 72) / 25.4;
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const escapeHTML = (value) =>
        String(value).replace(
            /[&<>"']/g,
            (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
        );
    function configure(options) {
        if (options.imageResolver) imageResolver = options.imageResolver;
    }
    function loadImage(source) {
        if (!source) return Promise.resolve(null);
        if (imageCache.has(source)) return imageCache.get(source);
        const promise = Promise.resolve(imageResolver(source)).then(
            (src) =>
                new Promise((resolve, reject) => {
                    if (/^https?:/i.test(src)) {
                        const url = new URL(src, location.href);
                        if (url.username || url.password) {
                            reject(new Error('Image URLs must not contain credentials.'));
                            return;
                        }
                        if (url.origin !== location.origin && !approvedOrigins.has(url.origin)) {
                            if (
                                !confirm(
                                    'This label requests an image from ' +
                                        url.origin +
                                        '. Loading it discloses your IP address to that server. Allow for this session?',
                                )
                            ) {
                                reject(
                                    new Error(
                                        'External image request declined. Select a local attachment instead.',
                                    ),
                                );
                                return;
                            }
                            approvedOrigins.add(url.origin);
                        }
                    }
                    if (
                        !/^(data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);|https?:\/\/|blob:)/i.test(
                            src,
                        )
                    ) {
                        reject(
                            new Error(
                                'Image source must be a media attachment, a data image, or an HTTP(S) image.',
                            ),
                        );
                        return;
                    }
                    const image = new Image();
                    image.crossOrigin = 'anonymous';
                    const timer = setTimeout(() => {
                        image.src = '';
                        reject(new Error('Image did not finish loading within 15 seconds.'));
                    }, 15000);
                    image.onload = () => {
                        clearTimeout(timer);
                        resolve(image);
                    };
                    image.onerror = () => {
                        clearTimeout(timer);
                        reject(
                            new Error(
                                'Image could not be loaded. For a CDN image, enable its CORS headers or select a local media attachment.',
                            ),
                        );
                    };
                    image.src = src;
                }),
        );
        imageCache.set(source, promise);
        promise.catch(() => imageCache.delete(source));
        if (imageCache.size > 500) imageCache.delete(imageCache.keys().next().value);
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
        return (e.italic ? 'italic ' : '') + (e.bold ? 'bold ' : '') + size + 'px "' + family + '"';
    }
    function drawText(ctx, text, e, width, height, dpi, issues) {
        let size = (e.fontSize * dpi) / 72,
            lines,
            lineHeight;
        const min = Math.min(size, Math.max(1, (e.minFontSize * dpi) / 72));
        do {
            ctx.font = fontString(e, size);
            lines = wrappedLines(ctx, text, width);
            lineHeight = size * 1.16;
            if (!e.autoFit || lines.length * lineHeight <= height + 0.2 || size <= min) break;
            size = Math.max(min, size - 0.5);
        } while (true);
        if (
            text &&
            (lines.length * lineHeight > height + 0.2 ||
                lines.some((line) => ctx.measureText(line).width > width + 0.2))
        ) {
            issues.push({
                severity: 'error',
                element: e.id,
                message:
                    'Text does not fit at the minimum font size. Enlarge this element or reduce its minimum font size.',
            });
        }
        ctx.fillStyle = e.color;
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
        if (!barcodeCache.has(key)) {
            barcodeCache.set(key, B.encode(e.format, text, { ecc: e.ecc, gs1: Boolean(e.gs1) }));
            if (barcodeCache.size > 1000) barcodeCache.delete(barcodeCache.keys().next().value);
        }
        return barcodeCache.get(key);
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
                'Barcode is too dense for this box/resolution. Enlarge it, shorten the value, or increase print DPI.',
            );
        if ((module * 25.4) / dpi < 0.19)
            issues.push({
                severity: 'warning',
                element: e.id,
                message:
                    'Narrow barcode modules (' +
                    ((module * 25.4) / dpi).toFixed(3) +
                    ' mm). Verify scanner readability on the actual printer.',
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
        let html = String(design.html).replace(/\{\{([^{}]+)\}\}/g, (full, key) =>
            escapeHTML(C.resolve(full, { values })),
        );
        html = html.replace(/\[barcode_img_url\]/g, escapeHTML(values.barcode_image || ''));
        html = html.replace(/\[(name|sku|price|id|line[1-4])\]/g, (_, key) =>
            escapeHTML(values[key] || ''),
        );
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
                throw new Error('An HTML image exceeds the 16-megapixel safety limit.');
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
                'This browser cannot safely rasterize this HTML design. Use the visual designer or remove external image resources.',
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
                'Label exceeds 16 megapixels or supported DPI. Reduce the size or print DPI.',
            );
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        const ctx = canvas.getContext('2d');
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
                        message: 'Rotated element extends outside the label.',
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
        const layout = C.paginate(records, profile),
            images = new Map(),
            issues = [];
        const indices = Array.from(new Set(layout.pages.flat().map((s) => s.recordIndex)));
        let bytes = 0;
        for (let k = 0; k < indices.length; k++) {
            if (options.cancelled && options.cancelled()) throw new Error('Print job cancelled.');
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
            const png = result.canvas.toDataURL('image/png');
            bytes += png.length;
            if (bytes > 120000000)
                throw new Error('Rendered job exceeds 120 MB. Split this batch or reduce DPI.');
            images.set(index, { png, width: result.canvas.width, height: result.canvas.height });
            result.canvas.width = 1;
            result.canvas.height = 1;
            if (options.progress) options.progress(k + 1, indices.length);
            if (k % 10 === 0) await nextFrame();
        }
        const errors = issues.filter((i) => i.severity === 'error');
        if (errors.length) {
            const error = new Error(
                'Printing blocked: ' +
                    errors.length +
                    ' rendering error(s). ' +
                    errors
                        .slice(0, 6)
                        .map((i) => i.name + ' / ' + i.element + ': ' + i.message)
                        .join('\n'),
            );
            error.issues = issues;
            throw error;
        }
        return { layout, images, issues, profile: C.clone(profile) };
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
            img.src = job.images.get(slot.recordIndex).png;
            img.alt = 'Label';
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
    async function printJob(job) {
        const previous = document.getElementById('rli-print-frame');
        if (previous) previous.remove();
        const frame = document.createElement('iframe');
        frame.id = 'rli-print-frame';
        frame.title = 'Ramsey Labels print document';
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
        const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data,
            rgb = new Uint8Array(canvas.width * canvas.height * 3);
        for (let i = 0, j = 0; i < rgba.length; i += 4) {
            rgb[j++] = rgba[i];
            rgb[j++] = rgba[i + 1];
            rgb[j++] = rgba[i + 2];
        }
        canvas.width = 1;
        canvas.height = 1;
        if (typeof CompressionStream !== 'undefined') {
            const stream = new Blob([rgb]).stream().pipeThrough(new CompressionStream('deflate'));
            return {
                data: new Uint8Array(await new Response(stream).arrayBuffer()),
                filter: '/Filter /FlateDecode ',
            };
        }
        return { data: rgb, filter: '' };
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
            if (options.cancelled && options.cancelled()) throw new Error('PDF export cancelled.');
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
    root.RLIRender = Object.freeze({
        configure,
        renderLabel,
        prepareJob,
        pageElement,
        printJob,
        exportPDF,
        download,
        sanitizeHTML,
        sanitizeCSS,
        escapeHTML,
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
