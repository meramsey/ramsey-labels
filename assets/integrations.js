/** Safe navigation only: item selections never alter the source order. */
(function () {
    'use strict';
    document.addEventListener('click', function (event) {
        const button = event.target.closest('.rli-print-order-items');
        if (!button) return;
        const ids = Array.from(document.querySelectorAll('.rli-order-item-select:checked'))
            .map((input) => input.value)
            .filter((value) => /^\d+$/.test(value));
        if (!ids.length) {
            window.alert('Select at least one order item using the Label checkboxes.');
            return;
        }
        const url = new URL(button.dataset.url, window.location.href);
        if (url.origin !== window.location.origin) return;
        url.searchParams.set('rli_item_ids', ids.join(','));
        window.location.assign(url.toString());
    });
})();
