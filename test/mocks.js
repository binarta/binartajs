function GatewaySpy() {
    this.signin = spy('signinRequest');
    this.signout = spy('signoutRequest');
    this.register = spy('registrationRequest');
    this.updateBillingProfile = spy('updateBillingProfileRequest');
    this.addAddress = spy('addAddressRequest');
    this.updateAddress = spy('updateAddressRequest');
    this.initiateBillingAgreement = spy('initiateBillingAgreementRequest');
    this.confirmBillingAgreement = spy('confirmBillingAgreementRequest');
    this.previewOrder = spy('previewOrderRequest');
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

function ValidOrderGateway() {
    this.previewOrder = function (order, response) {
        response.success('previewed-order');
    };

    this.submitOrder = function (request, response) {
        response.success();
    }
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