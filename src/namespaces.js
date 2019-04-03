function BinartaNamespacesjs() {
    var namespaces = this;

    namespaces.add = PermittedBinartaWidget(AddWidget);

    function AddWidget(rx) {
        var widget = this;
        var reseller = false;

        widget.permission = 'application.license.go.live';
        widget.refresh = function () {
            reseller = true;
            raiseResellerStatus();
        };
        widget.onNewObserver = function () {
            raiseResellerStatus();
        };
        widget.signedout = function() {
            reseller = false;
        };

        function raiseResellerStatus() {
            if (reseller)
                rx.notify('reseller');
        }
    }
}