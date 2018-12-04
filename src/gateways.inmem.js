function BinartaInMemoryGatewaysjs() {
    this.application = new ApplicationGateway();
    this.checkpoint = new CheckpointGateway();
    this.shop = new ShopGateway();
    this.hr = new HumanResourcesDB();

    function ApplicationGateway() {
        var self = this;

        this.now = moment();

        var applicationProfile;
        this.updateApplicationProfile = function (request) {
            Object.keys(request).forEach(function (k) {
                applicationProfile[k] = request[k];
            });
        };

        this.fetchApplicationProfile = function (request, response) {
            response.success(applicationProfile);
        };

        var sectionData;
        this.addSectionData = function (request) {
            sectionData.push(request);
        };

        this.fetchAdhesiveSnapshot = function (request, response) {
            var result = [
                {
                    type: 'requested.section',
                    id: request.id
                }
            ];
            sectionData.forEach(function (it) {
                result.push(it)
            });
            response.success({timestamp: self.now, stream: result});
        };

        var config;
        this.addPublicConfig = function (request) {
            request.scope = 'public';
            self.addConfig(request);
        };
        this.addConfig = function (request, response) {
            if (!config[request.scope])
                config[request.scope] = {};
            config[request.scope][request.id] = request.value;
            self.findConfig(request, response || {
                success: function () {
                }
            });
        };

        this.findPublicConfig = function (request, response) {
            request.scope = 'public';
            self.findConfig(request, response);
        };

        this.findConfig = function (request, response) {
            config[request.scope] && config[request.scope][request.id] != undefined ? response.success(config[request.scope][request.id]) : response.notFound()
        };

        this.submitContactForm = function (request, response) {
            response.success();
        };

        this.clear = function () {
            applicationProfile = {name: 'myapp'};
            config = {};
            sectionData = [];
        };
        this.clear();
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

        this.delete = function () {
            response.success();
        };

        this.fetchAccountMetadata = function (response) {
            if (activeProfile)
                response.activeAccountMetadata(activeProfile);
            else
                response.unauthenticated();
        };

        this.permissions = ['p1', 'p2', 'p3'];
        this.addPermission = function (permission) {
            this.permissions.push(permission);
        };

        this.removePermission = function (permission) {
            this.permissions.splice(this.permissions.indexOf(permission), 1);
        };

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
        };

        var coupons = [];
        this.addCoupon = function (coupon) {
            coupons.push(coupon);
        };

        this.findCouponById = function (request, response) {
            var coupon = coupons.reduce(function (p, c) {
                return p || (c.id == request.id ? c : p);
            }, null);
            coupon ? response.success(coupon) : response.notFound();
        };

        this.containsCoupon = function (request, response) {
            this.findCouponById(request, {
                success: function () {
                    response.success();
                },
                notFound: response.notFound
            })
        };

        var stripeAccountId;
        this.stripeConnect = function (request, response) {
            stripeAccountId = 'stripe-account-id';
            response.success({uri: 'http://example.org/stripe'});
        };

        this.stripeConnected = function (request, response) {
            if (stripeAccountId)
                response.success(stripeAccountId);
            else response.notFound();
        };

        this.stripeDisconnect = function (request, response) {
            stripeAccountId = undefined;
            response.success();
        };

        var bancontactParams = {supportedBy: ['piggybank', 'megabank']};
        this.getBancontactParams = function (request, response) {
            response.success(bancontactParams);
        };

        this.disablePaymentMethod = function (request, response) {
            delete bancontactParams.owner;
            delete bancontactParams.bankId;
            response.success();
        };

        this.configureBancontact = function (request, response) {
            bancontactParams.owner = request.owner;
            bancontactParams.bankId = request.bankId;
            response.success();
        };

        this.clear = function () {
            stripeAccountId = undefined;
            this.disablePaymentMethod({id: 'bancontact'}, {
                success: function () {
                }
            })
        }
    }

    function HumanResourcesDB() {
        var records = [
            {
                "id": "1",
                "name": "Financial Advisor",
                "sectorName": "Finance",
                "contractType": "permanent",
                "status": "vacant",
                "locationName": "Leuven",
                "duration": "PT0S"
            },
            {
                "id": "2",
                "name": "Technical Writer",
                "sectorName": "Customer Support",
                "contractType": "contractor",
                "status": "vacant",
                "locationName": "Leuven",
                "duration": "P12W"
            },
            {
                "id": "3",
                "name": "Project Manager",
                "sectorName": "Operations",
                "contractType": "part-time",
                "status": "vacant",
                "locationName": "Brussels",
                "duration": "PT0S"
            }
        ];

        this.search = function (request, response) {
            response.success(records);
        };

        this.get = function (request, response) {
            response.success(records.reduce(function (p, c) {
                return c.id == request.id ? c : p;
            }, null));
        }
    }
}
