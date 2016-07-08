function BinartaInMemoryGatewaysjs() {
    this.checkpoint = new CheckpointGateway();
    this.shop = new ShopGateway();

    function CheckpointGateway() {
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
                return request.username == it.username && request.password == it.password
            };
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

    function ShopGateway() {
        this.submitOrder = function (request, response) {
            if (request.provider == 'with-insufficient-funds')
                response.rejected('violation-report');
            else
                response.success();
        }
    }
}