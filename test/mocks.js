function GatewaySpy() {
    this.signin = spy('signinRequest');
    this.register = spy('registrationRequest');
    this.initiateBillingAgreement = spy('initiateBillingAgreementRequest');
    this.confirmBillingAgreement = spy('confirmBillingAgreementRequest');

    function spy(requestAttribute) {
        return function (request, response) {
            this[requestAttribute] = request;
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
    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({});
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

    this.fetchAccountMetadata = function (response) {
        response.activeAccountMetadata({billing: {complete: false}});
    }
}

function InvalidOrderGateway() {
    this.submitOrder = function(request, response) {
        response.rejected('violation-report');
    }
}

function ValidOrderGateway() {
    this.submitOrder = function(request, response) {
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