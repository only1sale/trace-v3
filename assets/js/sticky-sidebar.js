(function () {
    'use strict';

    var STICKY_TOP = 24;
    var FADE_AFTER = 36;
    var tracked = [];
    var ticking = false;

    function desktopEnabled(el) {
        if (el.classList.contains('expert-author-panel')) {
            return window.matchMedia('(min-width: 901px)').matches;
        }
        if (el.classList.contains('network-page-toc')) {
            return window.matchMedia('(min-width: 981px)').matches;
        }
        return window.matchMedia('(min-width: 1181px)').matches;
    }

    function layoutTop(el) {
        var top = 0;
        var node = el;
        while (node) {
            top += node.offsetTop || 0;
            node = node.offsetParent;
        }
        return top;
    }

    function rememberOrigins() {
        tracked.forEach(function (item) {
            item.origin = layoutTop(item.el);
            item.el.classList.remove('is-sticky-following');
        });
        update();
    }

    function update() {
        ticking = false;
        var y = window.pageYOffset || document.documentElement.scrollTop || 0;

        tracked.forEach(function (item) {
            if (!desktopEnabled(item.el)) {
                item.el.classList.remove('is-sticky-following');
                return;
            }

            /* Wait until the element has not only reached its sticky top,
               but followed the viewport a small distance. This avoids a
               visual flash exactly at the transition point. */
            var following = y + STICKY_TOP >= item.origin + FADE_AFTER;
            item.el.classList.toggle('is-sticky-following', following);
        });
    }

    function requestUpdate() {
        if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(update);
        }
    }

    function init() {
        var elements = document.querySelectorAll(
            '.cancer-section-nav, .cancer-page-toc, .expert-author-panel'
        );

        if (!elements.length) return;

        tracked = Array.prototype.map.call(elements, function (el) {
            return { el: el, origin: layoutTop(el) };
        });

        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', rememberOrigins);
        window.addEventListener('load', rememberOrigins);
        update();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
