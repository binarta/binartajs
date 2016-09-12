function BinartaInMemoryGatewaysjs() {
    this.application = new ApplicationGateway();
    this.checkpoint = new CheckpointGateway();
    this.shop = new ShopGateway();

    function ApplicationGateway() {
        this.fetchApplicationProfile = function (request, response) {
            response.success({name: 'myapp'});
        }
    }

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

        this.signout = function (response) {
            activeProfile = undefined;
            if (response && response.unauthenticated)
                response.unauthenticated();
        };

        this.fetchAccountMetadata = function (response) {
            if (activeProfile)
                response.activeAccountMetadata(activeProfile);
            else
                response.unauthenticated();
        };

        this.permissions = ['p1', 'p2', 'p3'];
        this.addPermission = function(permission) {
            this.permissions.push(permission);
        }
        this.removePermission = function(permission) {
            this.permissions.splice(this.permissions.indexOf(permission), 1);
        }

        this.fetchPermissions = function (request, response) {
            response.success(this.permissions.map(function (it) {
                return {name: it}
            }));
        }
    }

    function ShopGateway() {
        var addresses = [];
        this.paymentConfirmations = [];

        this.fetchBillingProfile = function (response) {
            response.success({vat: 'BE1234567890'});
        };

        this.fetchAddresses = function (response) {
            response.success(addresses);
        };

        this.addAddress = function (request, response) {
            if (request.label == 'invalid')
                response.rejected({label: ['invalid']});
            else {
                addresses.push(request);
                response.success();
            }
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

        this.validateOrder = function (request, response) {
            response.success();
        };

        this.submitOrder = function (request, response) {
            if (request.provider == 'with-insufficient-funds')
                response.rejected('violation-report');
            else
                response.success({approvalUrl: 'approval-url'});
        };

        this.cancelOrder = function (request, response) {
            response.success();
        };

        this.confirmPayment = function (request, response) {
            this.paymentConfirmations.push(request);
            if (request.token == 'invalid')
                response.rejected({token: ['invalid']});
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