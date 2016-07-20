function BinartajsFactory() {
    var binartajs = new Binartajs();
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
    }

    function transferAttributes(from, to) {
        Object.keys(from).forEach(function (key) {
            to[key] = from[key];
            to[key].ui = ui;
            from[key].binarta = binartajs;
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
    var listeners = [];

    this.add = function (l) {
        listeners.push(l);
    };

    this.forEach = function (cb) {
        listeners.forEach(cb);
    };

    this.remove = function (l) {
        var idx = listeners.indexOf(l);
        if (idx > -1)
            listeners.splice(idx, 1);
    };

    this.isEmpty = function() {
        return listeners.length == 0;
    }
}

