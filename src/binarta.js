function BinartajsFactory(deps) {
    var binartajs = new Binartajs();
    binartajs.localStorage = deps && deps.localStorage ? deps.localStorage : WebStorageFactory('localStorage');
    binartajs.sessionStorage = deps && deps.sessionStorage ? deps.sessionStorage : WebStorageFactory('sessionStorage');

    var ui;

    this.addUI = function (it) {
        ui = it;
    };

    this.addSubSystems = function (it) {
        transferAttributes(it, binartajs);
    };

    this.create = function () {
        return binartajs;
    };

    function Binartajs() {
        this.toResponseAdapter = function (response) {
            var adapter = {};
            Object.keys(response || {}).forEach(function (it) {
                adapter[it] = response[it];
            });
            return adapter;
        }
    }

    function transferAttributes(from, to) {
        Object.keys(from).forEach(function (key) {
            to[key] = from[key];
            to[key].ui = ui;
            to[key].binarta = binartajs;
            if (to[key].installed)
                to[key].installed();
        });
    }
}

function BinartaMergingUI() {
    var self = this;
    var uis = [];

    this.add = function (ui) {
        uis.push(ui);
        Object.keys(ui).filter(isExposed).forEach(expose);
    };

    function isExposed(it) {
        return self[it] == undefined
    }

    function expose(it) {
        self[it] = function () {
            var args = arguments;
            uis.forEach(function (ui) {
                if (ui[it] != undefined)
                    ui[it](args);
            })
        }
    }

    Array.prototype.slice.call(arguments).forEach(this.add);
}

function BinartaRX() {
    var rx = this;
    var listeners = [];

    this.add = function (l) {
        if (l.predicate === undefined) l.predicate = function () {
            return true;
        };
        l.notify = function (evt, ctx) {
            if (l[evt] && l.predicate(ctx))
                l[evt](ctx);
        };
        listeners.push(l);
    };

    this.observe = function (l) {
        return new Observer(rx, l);
    };

    this.observeIf = function (predicate, l) {
        l.predicate = predicate;
        return this.observe(l);
    };

    this.forEach = function (cb) {
        listeners.slice().forEach(cb);
    };

    this.notify = function (evt, ctx) {
        this.forEach(function (l) {
            l.notify(evt, ctx);
        })
    };

    this.remove = function (l) {
        var idx = listeners.indexOf(l);
        if (idx > -1)
            listeners.splice(idx, 1);
    };

    this.isEmpty = function () {
        return listeners.length == 0;
    };

    function Observer(root, listener) {
        var observer = this;

        root.add(listener);

        observer.disconnect = function () {
            rx.remove(listener);
        }
    }
}

function BinartaTL() {
    this.shift = function () {
        return new Date();
    };
}

function BinartaWidget(ConcreteWidget) {
    var refresh;

    function Widget() {
        var registry = new BinartaRX();
        var widget = this;
        var status = 'idle', initialized;

        widget.observe = function (l) {
            refresh = function () {
                initialized = true;
                widget.refresh();
            };
            var it = registry.observe(l);
            raiseStatus();
            if (!initialized)
                refresh();
            if (widget.onNewObserver)
                widget.onNewObserver();
            return it;
        };

        function setStatus(it) {
            status = it;
            raiseStatus();
        }

        function raiseStatus() {
            registry.notify('status', status);
        }

        function response(it) {
            setStatus('working');
            return {
                success: function () {
                    setStatus('idle');
                    it.success.apply(null, arguments);
                },
                rejected: function (it) {
                    setStatus('rejected');
                    registry.notify('rejected', it);
                }
            };
        }

        ConcreteWidget.apply(widget, [registry, response].concat(arguments));
        setStatus('idle');
    }

    return new Widget();
}