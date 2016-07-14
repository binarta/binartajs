function GatewaySpy() {
    this.signin = spy('signinRequest');
    this.signout = spy('signoutRequest');
    this.register = spy('registrationRequest');
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
    }
}

function AuthenticatedGateway() {
    this.signout = function () {
    };

    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({principal: 'p'});
    }
}

function InvalidCredentialsGateway() {
    this.register = function (request, response) {
        response.rejected('violation-report');
    };

    this.signin = function (request, response) {
        response.rejected();
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

function InCompleteBillingDetailsGateway() {
    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({billing: {complete: false}});
    }
}

function CompleteBillingDetailsGateway() {
    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({billing: {complete: true}});
    };

    this.confirmBillingAgreement = function (request, response) {
        response.confirmedBillingAgreement();
    }
}