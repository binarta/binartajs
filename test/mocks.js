function GatewaySpy() {
    this.fetchApplicationProfile = spy('fetchApplicationProfileRequest');
    this.signin = spy('signinRequest');
    this.signout = spy('signoutRequest');
    this.delete = spy('deleteRequest');
    this.register = spy('registrationRequest');
    this.updateBillingProfile = spy('updateBillingProfileRequest');
    this.addAddress = spy('addAddressRequest');
    this.updateAddress = spy('updateAddressRequest');
    this.initiateBillingAgreement = spy('initiateBillingAgreementRequest');
    this.confirmBillingAgreement = spy('confirmBillingAgreementRequest');
    this.previewOrder = spy('previewOrderRequest');
    this.validateOrder = spy('validateOrderRequest');
    this.submitOrder = spy('submitOrderRequest');
    this.confirmPayment = spy('confirmPaymentRequest');
    this.cancelOrder = spy('cancelOrderRequest');
    this.fetchAdhesiveSnapshot = spy('fetchAdhesiveSnapshotRequest');
    this.addConfig = spy('addConfigRequest');
    this.findPublicConfig = spy('findPublicConfigRequest');
    this.findConfig = spy('findConfigRequest');
    this.findCouponById = spy('findCouponByIdRequest');
    this.containsCoupon = spy('containsCouponRequest');
    this.stripeConnect = spy('stripeConnectRequest');
    this.stripeConnected = spy('stripeConnectedRequest', 'stripeConnectedResponse');
    this.stripeDisconnect = spy('stripeDisconnectRequest', 'stripeDisconnectResponse');
    this.getPaymentOnReceiptParams = spy('getPaymentOnReceiptParamsRequest', 'getPaymentOnReceiptParamsResponse');
    this.getCCParams = spy('getCCParamsRequest', 'getCCParamsResponse');
    this.getBancontactParams = spy('getBancontactParamsRequest', 'getBancontactParamsResponse');
    this.disablePaymentMethod = spy('disablePaymentMethodRequest', 'disablePaymentMethodResponse');
    this.configurePaymentOnReceipt = spy('configurePaymentOnReceiptRequest', 'configurePaymentOnReceiptResponse');
    this.configureBancontact = spy('configureBancontactRequest', 'configureBancontactResponse');
    this.configureCC = spy('configureCCRequest', 'configureCCResponse');
    this.findUpcomingEvents = spy('findUpcomingEventsRequest');
    this.getWidgetAttributes = spy('getWidgetAttributesRequest');
    this.saveWidgetAttributes = spy('saveWidgetAttributesRequest');

    function spy(requestAttribute, responseAttribute) {
        return function (request, response) {
            this[requestAttribute] = request || true;
            if (responseAttribute)
                this[responseAttribute] = response;
        }
    }
}

function InterfacesWithUIGateway() {
    this.initiateBillingAgreement = wire;
    this.confirmBillingAgreement = wire;

    function wire(ignored, ui) {
        ui.wiredToGateway();
    }
}

function ValidApplicationGateway() {
    this.fetchApplicationProfile = function (request, response) {
        response.success({
            name: 'test-application',
            supportedLanguages: ['en', 'nl']
        });
    };

    this.fetchAdhesiveSnapshot = function (request, response) {
        response.success({
            timestamp: moment('20170906155112645+02:00', 'YYYYMMDDHHmmssSSSZ').toDate(),
            stream: [
                {type: 't', msg: 'Hello World!'},
                {type: 'images', relativePath: 'bg.img', etag: 'e'},
                {type: 'config', key: 'adhesive.config', value: 'from-adhesive-reading'}
            ]
        });
    };

    this.findPublicConfig = function (request, response) {
        response.success('v');
    };

    this.findConfig = function (request, response) {
        response.success('v');
    };

    this.addConfig = function (request, response) {
        response.success();
    };

    this.getWidgetAttributes = function (request, response) {
        response.success({
            aspectRatio: {width: 3, height: 2},
            fittingRule: 'contain'
        })
    };

    this.saveWidgetAttributes = function(request, response) {
        response.success();
    }
}

function InvalidApplicationGateway() {
    this.saveWidgetAttributes = function(request, response) {
        response.rejected('report');
    }
}

function ValidCalendarGateway() {
    this.findUpcomingEvents = function (request, response) {
        response.success([
            {id: 'a', start: '2017-02-01T16:00:00Z'},
            {id: 'b', start: '2017-02-02T16:00:00Z'},
            {id: 'c', start: '2017-02-03T16:00:00Z'}
        ]);
    }
}

function ConfigNotFoundApplicationGateway() {
    this.findPublicConfig = function (request, response) {
        response.notFound();
    };

    this.findConfig = function (request, response) {
        response.notFound();
    }
}

function DeferredApplicationGateway() {
    var delegate = new ValidApplicationGateway();
    var eventRegistry = new BinartaRX();

    this.fetchAdhesiveSnapshot = function (request, response) {
        eventRegistry.add({
            continue: function () {
                delegate.fetchAdhesiveSnapshot(request, response);
            }
        });
    };

    this.continue = function () {
        eventRegistry.forEach(function (l) {
            l.continue();
        });
    }
}

function UnauthenticatedGateway() {
    this.fetchAccountMetadata = function (response) {
        response.unauthenticated();
    };

    this.fetchBillingProfile = function (response) {
        response.unauthenticated();
    };

    this.fetchAddresses = function (response) {
        response.unauthenticated();
    };

    this.addConfig = function (request, response) {
        response.unauthenticated();
    };

    this.findConfig = function (request, response) {
        response.unauthenticated();
    }
}

function MissingPermissionsGateway() {
    this.addConfig = function (request, response) {
        response.forbidden();
    };

    this.findConfig = function (request, response) {
        response.forbidden();
    }
}

function AuthenticatedGateway() {
    this.signout = function (response) {
        response.unauthenticated();
    };

    this.delete = function (response) {
        response.success();
    };

    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({principal: 'p', email: 'e'});
    };

    this.fetchPermissions = function (request, response) {
        if (request.principal == 'p')
            response.success(['p1', 'p2', 'p3'].map(function (it) {
                return {name: it};
            }));
    };

    this.fetchBillingProfile = function (response) {
        response.success({});
    };

    this.fetchAddresses = function (response) {
        response.success([
            {
                label: 'home',
                addressee: 'John Doe',
                street: 'Johny Lane',
                number: '1',
                zip: '1000',
                city: 'Johnyville',
                country: 'BE'
            },
            {
                label: 'work',
                addressee: 'John Doe',
                street: 'Johny Lane',
                number: '1',
                zip: '1000',
                city: 'Johnyville',
                country: 'BE'
            }
        ]);
    }
}

function InvalidCredentialsGateway() {
    this.register = function (request, response) {
        response.rejected('violation-report');
    };

    this.signin = function (request, response) {
        response.rejected();
    };

    this.fetchAccountMetadata = function (response) {
        response.unauthenticated();
    };

    this.fetchBillingProfile = function (response) {
        response.unauthenticated();
    };

    this.fetchAddresses = function (response) {
        response.unauthenticated();
    }
}

function ValidCredentialsGateway() {
    var delegate = new AuthenticatedGateway();

    this.register = function (request, response) {
        response.success();
    };

    this.signin = function (request, response) {
        response.success();
    };

    this.signout = function (response) {
        response.unauthenticated();
    };

    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({principal: 'p', email: 'e', billing: {complete: false}});
    };

    this.fetchPermissions = delegate.fetchPermissions;

    this.fetchBillingProfile = function () {
    };

    this.fetchAddresses = function () {
    }
}

function WithPermissionsGateway(permissions) {
    var delegate = new ValidCredentialsGateway();

    this.register = function (request, response) {
    };

    this.signin = function (request, response) {
        response.success();
    };

    this.signout = function () {
    };

    this.fetchAccountMetadata = delegate.fetchAccountMetadata;

    this.fetchPermissions = function (request, response) {
        response.success(permissions.map(function (it) {
            return {name: it};
        }));
    };

    this.fetchBillingProfile = function () {
    };

    this.fetchAddresses = function () {
    }
}

function InvalidOrderGateway() {
    this.submitOrder = function (request, response) {
        response.rejected('violation-report');
    };

    this.previewOrder = function (request, response) {
        response.success('previewed-order');
    };

    this.validateOrder = function (request, response) {
        var items = {};
        request.items.forEach(function (it) {
            items[it.id] = {quantity: ['invalid']};
        });
        response.rejected({items: items});
    };

    this.cancelOrder = function (request, response) {
        response.rejected('violation-report');
    };

    this.findCouponById = function (request, response) {
        response.notFound();
    };

    this.containsCoupon = function (request, response) {
        response.notFound();
    }
}

function NotOnlyPaymentProviderRequiresSetupGateway() {
    this.submitOrder = function (request, response) {
        response.rejected({provider: ['setup'], termsAndConditions: ['required']});
    }
}

function PaymentProviderRequiresSetupGateway() {
    this.submitOrder = function (request, response) {
        response.rejected({provider: ['setup']});
    }
}

function UnknownOrderGateway() {
    var delegate = new ValidOrderGateway();

    this.previewOrder = function (order, response) {
        response.success({items: []});
    };

    this.validateOrder = delegate.validateOrder;
    this.submitOrder = delegate.submitOrder
}

function PreviewOrderGateway() {
    var delegate = new ValidOrderGateway();

    this.previewOrder = function (order, response) {
        response.success('previewed-order');
    };

    this.validateOrder = delegate.validateOrder;
    this.submitOrder = delegate.submitOrder
}

function ValidOrderGateway() {
    this.previewOrder = function (request, response) {
        request.items = request.items.map(function (it) {
            it.price = 100;
            return it;
        });
        request.presentableItemTotal = '$99.99';
        request.presentablePrice = '$99.99';
        request.additionalCharges = 'additional-charges';
        response.success(request);
    };

    this.validateOrder = function (request, response) {
        response.success();
    };

    this.submitOrder = function (request, response) {
        response.success({id: 'order-id'});
    };

    this.cancelOrder = function (request, response) {
        response.success();
    };

    this.findCouponById = function (request, response) {
        response.ok('coupon');
    };

    this.containsCoupon = function (request, response) {
        response.ok('contains-response');
    }
}

function ValidPaymentGateway() {
    this.confirmPayment = function (request, response) {
        response.success();
    };

    this.stripeConnect = function (request, response) {
        response.success({uri: 'stripe-connect-uri'});
    }
}

function InvalidPaymentGateway() {
    this.confirmPayment = function (request, response) {
        response.rejected('violation-report');
    }
}

function ExpiredPaymentGateway() {
    this.confirmPayment = function (request, response) {
        response.rejected({payment: [{label: 'expired'}]});
    }
}

function ValidOrderWithPaymentRequiredGateway() {
    var delegate = new ValidOrderGateway();

    this.submitOrder = function (request, response) {
        var onSuccess = response.success;
        response.success = function (ctx) {
            ctx.approvalUrl = 'approval-url';
            ctx.signingContext = {
                institution: 'test-bank',
                approvalUrl: ctx.approvalUrl
            };
            onSuccess(ctx);
        };
        delegate.submitOrder(request, response);
    };
}

function ValidOrderWithDeferredPreviewGateway() {
    var self = this;
    var delegate = new ValidOrderGateway();
    var spy = new GatewaySpy();
    var deferredPreviews = [];

    this.previewOrder = function (request, response) {
        spy.previewOrder(request, response);
        self.previewOrderRequest = spy.previewOrderRequest;
        deferredPreviews.push(function () {
            delegate.previewOrder(request, response);
        });
    };
    this.doPreviewOrders = function () {
        deferredPreviews.forEach(function (it) {
            it();
        });
        deferredPreviews = [];
    };

    this.validateOrder = delegate.validateOrder;
    this.submitOrder = delegate.submitOrder;
}

function InCompleteBillingProfileGateway() {
    var delegate = new AuthenticatedGateway();

    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({billing: {complete: false}});
    };

    this.fetchPermissions = delegate.fetchPermissions;

    this.fetchBillingProfile = function (response) {
        response.unauthenticated();
    };

    this.fetchAddresses = function (response) {
        response.success([]);
    }
}

function CompleteBillingProfileGateway() {
    var delegate = new AuthenticatedGateway();

    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({principal: 'p', email: 'e', billing: {complete: true}});
    };

    this.fetchPermissions = delegate.fetchPermissions;

    this.fetchBillingProfile = function (response) {
        response.success({vat: 'BE1234567890'});
    };

    this.fetchAddresses = function (response) {
        response.success([]);
    };

    this.confirmBillingAgreement = function (request, response) {
        response.confirmedBillingAgreement();
    }
}

function InvalidBillingProfileGateway() {
    this.addAddress = function (request, response) {
        response.rejected('violation-report');
    };

    this.updateAddress = function (request, response) {
        response.rejected('violation-report');
    }
}

function ValidBillingProfileGateway() {
    this.updateBillingProfile = function (request, response) {
        response.success();
    };

    this.addAddress = function (request, response) {
        response.success();
    };

    this.updateAddress = function (request, response) {
        response.success();
    }
}