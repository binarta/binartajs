function BinartaCatalogjs() {
    var catalog = this;

    catalog.browser = new BinartaWidget(BrowserWidget);

    function BrowserWidget(rx) {
        var watchedAttributes = ['type', 'path', 'parentPath'];
        var browser = this;
        var cache = {};

        browser.refresh = function () {
        };

        browser.onNewObserver = function () {
            watchedAttributes.forEach(function(it) {
                if(cache[it])
                    raise(it);
            });
        };

        watchedAttributes.forEach(function(it) {
            browser[it] = function(v) {
                cache[it] = v;
                raise(it);
            }
        });

        function raise(it) {
            rx.notify(it, cache[it]);
        }
    }
}