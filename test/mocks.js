function GatewaySpy() {
    this.fetchApplicationProfile = spy('fetchApplicationProfileRequest');
    this.signin = spy('signinRequest');
    this.signout = spy('signoutRequest');
    this.register = spy('registrationRequest');
    this.updateBillingProfile = spy('updateBillingProfileRequest');
    this.addAddress = spy('addAddressRequest');
    this.updateAddress = spy('updateAddressRequest');
    this.initiateBillingAgreement = spy('initiateBillingAgreementRequest');
    this.confirmBillingAgreement = spy('confirmBillingAgreementRequest');
    this.previewOrder = spy('previewOrderRequest');
    this.validateOrder = spy('validateOrderRequest');
    this.submitOrder = spy('submitOrderRequest');

    function spy(requestAttribute) {
        return function (request, response) {
            this[requestAttribute] = request || true;
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
        response.success({name: 'test-application'});
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
    }
}

function AuthenticatedGateway() {
    this.signout = function () {
    };

    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({principal: 'p', email: 'e'});
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
    this.register = function (request, response) {
        response.success();
    };

    this.signin = function (request, response) {
        response.success();
    };

    this.signout = function () {
    };

    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({billing: {complete: false}});
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
        response.success();
    }
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
    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({billing: {complete: false}});
    };

    this.fetchBillingProfile = function (response) {
        response.unauthenticated();
    };

    this.fetchAddresses = function (response) {
        response.success([]);
    }
}

function CompleteBillingProfileGateway() {
    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({billing: {complete: true}});
    };

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