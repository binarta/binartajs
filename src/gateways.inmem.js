function BinartaInMemoryGatewaysjs() {
    this.checkpoint = new CheckpointGateway();
    this.shop = new ShopGateway();

    function CheckpointGateway() {
        var self = this;
        var accounts = [];
        var activeProfile;

        this.authenticated = false;

        this.register = function (request, response) {
            var violationReport = {};

            if (request.username == 'invalid')
                violationReport.username = ['invalid'];
            if (request.password == 'invalid')
                violationReport.password = ['invalid'];

            if (Object.keys(violationReport).length == 0) {
                request.principal = 'principal(' + request.username + ')';
                request.token = 'token(' + request.username + ')';
                accounts.push(request);
                response.success();
            } else
                response.rejected(violationReport);
        };

        this.signin = function (request, response) {
            var credentialsFound = accounts.map(isMatchingCredentials(request)).reduce(function (p, c) {
                return p || c;
            }, false);

            if (credentialsFound) {
                activeProfile = accounts.filter(isMatchingCredentials(request))[0];
                response.success();
            } else
                response.rejected();
        };

        function isMatchingCredentials(request) {
            return function (it) {
                return isMatchingUsernamePassword(request, it) || isMatchingToken(request, it)
            };
        }

        function isMatchingUsernamePassword(request, account) {
            return request.username && request.username == account.username && request.password && request.password == account.password
        }

        function isMatchingToken(request, account) {
            return request.token && request.token == account.token
        }

        this.signout = function () {
            activeProfile = undefined;
        };

        this.fetchAccountMetadata = function (response) {
            if (activeProfile)
                response.activeAccountMetadata(activeProfile);
            else
                response.unauthenticated();
        };
    }

    function ShopGateway() {
        var addresses = [];

        this.fetchBillingProfile = function (response) {
            response.success({vat: 'BE1234567890'});
        };

        this.fetchAddresses = function (response) {
            response.success(addresses);
        };

        this.addAddress = function (request, response) {
            addresses.push(request);
            response.success();
        };

        this.updateAddress = function (request, response) {
            var address = addresses.reduce(function (p, c) {
                if (c.label == request.label)
                    return c;
                return p;
            }, {});
            Object.keys(request).forEach(function (k) {
                address[k] = request[k];
            });
            response.success();
        };

        this.updateBillingProfile = function (request, response) {
            response.success();
        };

        this.previewOrder = function (request, response) {
            response.success(request);
        };

        this.submitOrder = function (request, response) {
            if (request.provider == 'with-insufficient-funds')
                response.rejected('violation-report');
            else
                response.success();
        };

        this.initiateBillingAgreement = function (id, ui) {
            ui.approveBillingAgreement({
                paymentProvider: id,
                url: 'http://' + id + '/billing/agreement?token=t'
            });
        };

        this.confirmBillingAgreement = function (ctx, ui) {
            ui.confirmedBillingAgreement();
        }
    }
}