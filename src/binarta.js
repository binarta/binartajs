function BinartajsFactory() {
    var binartajs = new Binartajs();
    var ui;

    this.addUI = function(it) {
        ui = it;
    };

    this.addSubSystems = function(it) {
        transferAttributes(it, binartajs);
    };

    this.create = function() {
        return binartajs;
    };

    function Binartajs() {}

    function transferAttributes(from, to) {
        Object.keys(from).forEach(function(key) {
            to[key] = from[key];
            to[key].ui = ui;
        });
    }
}
