(function () {
    describe('binarta-checkpointjs', function () {
        var binarta, ui;

        beforeEach(function () {
            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            factory.addSubSystems({checkpoint: new BinartaCheckpointjs()});
            binarta = factory.create();
        });

        it('profile is unauthenticated', function() {
            expect(binarta.checkpoint.profile.isAuthenticated()).toBeFalsy();
        });

        it('profile is unauthenticated on refresh', function() {
            binarta.checkpoint.gateway = new UnauthenticatedGateway();
            binarta.checkpoint.profile.refresh();
            expect(binarta.checkpoint.profile.isAuthenticated()).toBeFalsy();
        });

        it('profile is authenticated on refresh', function() {
            binarta.checkpoint.gateway = new AuthenticatedGateway();
            binarta.checkpoint.profile.refresh();
            expect(binarta.checkpoint.profile.isAuthenticated()).toBeTruthy();
        });

        it('profile is unauthenticated on refresh when session expires', function() {
            binarta.checkpoint.gateway = new AuthenticatedGateway();
            binarta.checkpoint.profile.refresh();

            binarta.checkpoint.gateway = new UnauthenticatedGateway();
            binarta.checkpoint.profile.refresh();

            expect(binarta.checkpoint.profile.isAuthenticated()).toBeFalsy();
        });

        describe('signin form', function() {
            it('starts out in idle state', function() {
                expect(binarta.checkpoint.signinForm.status()).toEqual('idle');
            });

            it('initially exposes a blank violation', function() {
                expect(binarta.checkpoint.signinForm.violation()).toEqual('');
            });

            describe('when submitting form and waiting for a response', function() {
                beforeEach(function() {
                    binarta.checkpoint.gateway = new GatewaySpy();
                    binarta.checkpoint.signinForm.submit('credentials');
                });
                
                it('then credentials are captured by the gateway', function() {
                    expect(binarta.checkpoint.gateway.signinRequest).toEqual('credentials');
                });

                it('then working state is exposed', function() {
                    expect(binarta.checkpoint.signinForm.status()).toEqual('working');
                });

                it('then there is still a blank violation exposed', function() {
                    expect(binarta.checkpoint.signinForm.violation()).toEqual('');
                });
            });

            describe('when submitting form with invalid credentials', function() {
                beforeEach(function() {
                    binarta.checkpoint.gateway = new InvalidCredentialsGateway();
                    binarta.checkpoint.signinForm.submit('-');
                });

                it('then working state is exposed', function() {
                    expect(binarta.checkpoint.signinForm.status()).toEqual('rejected');
                });

                it('then a violation is exposed', function() {
                    expect(binarta.checkpoint.signinForm.violation()).toEqual('credentials.mismatch');
                });

                it('then resubmission is possible', function() {
                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.signinForm.submit('-');
                    expect(binarta.checkpoint.signinForm.status()).toEqual('authenticated');
                });
            });

            describe('when submitting form with valid credentials', function() {
                beforeEach(function() {
                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.signinForm.submit('-');
                });

                it('then authenticated state is exposed', function() {
                    expect(binarta.checkpoint.signinForm.status()).toEqual('authenticated');
                });

                it('then there is still a blank violation exposed', function() {
                    expect(binarta.checkpoint.signinForm.violation()).toEqual('');
                });

                it('then resubmission is not possible', function() {
                    expect(binarta.checkpoint.signinForm.submit).toThrowError('already.authenticated');
                });

                it('when profile refresh results in the user being unauthenticated then the form resets', function() {
                    binarta.checkpoint.gateway = new UnauthenticatedGateway();
                    binarta.checkpoint.profile.refresh();
                    expect(binarta.checkpoint.signinForm.status()).toEqual('idle');
                });
            })
        });

        describe('active profile', function () {
            describe('billing details', function () {
                it('start out incomplete', function () {
                    expect(binarta.checkpoint.profile.billing.isComplete()).toBeFalsy();
                });

                it('profile refresh loads incomplete billing details', function () {
                    binarta.checkpoint.gateway = new InCompleteBillingDetailsGateway();
                    binarta.checkpoint.profile.refresh();
                    expect(binarta.checkpoint.profile.billing.isComplete()).toBeFalsy();
                });

                it('profile refresh loads complete billing details', function () {
                    binarta.checkpoint.gateway = new CompleteBillingDetailsGateway();
                    binarta.checkpoint.profile.refresh();
                    expect(binarta.checkpoint.profile.billing.isComplete()).toBeTruthy();
                });

                it('initiate billing agreement delegates to gateway', function () {
                    binarta.checkpoint.gateway = new GatewaySpy();
                    binarta.checkpoint.profile.billing.initiate('payment-provider');
                    expect(binarta.checkpoint.gateway.initiateBillingAgreementRequest).toEqual('payment-provider');
                });

                it('initiate billing agreement remembers payment provider on session storage', function () {
                    binarta.checkpoint.gateway = new GatewaySpy();
                    binarta.checkpoint.profile.billing.initiate('payment-provider');
                    expect(sessionStorage.billingAgreementProvider).toEqual('payment-provider');
                });

                it('initiate billing agreement passes ui to gateway', function () {
                    binarta.checkpoint.gateway = new InterfacesWithUIGateway();
                    binarta.checkpoint.profile.billing.initiate('irrelevant');
                    expect(ui.isWiredToGateway).toBeTruthy();
                });

                it('initiate billing agreement reports start of work to ui', function() {
                    binarta.checkpoint.gateway = new GatewaySpy();
                    binarta.checkpoint.profile.billing.initiate('irrelevant');
                    expect(ui.isInitiatingBillingAgreement).toBeTruthy();
                });

                it('cancel billing agreement delegates to ui', function () {
                    binarta.checkpoint.profile.billing.cancel();
                    expect(ui.receivedCanceledBillingAgreementRequest).toBeTruthy();
                });

                it('confirm billing agreement delegates to gateway', function () {
                    sessionStorage.billingAgreementProvider = 'p';
                    binarta.checkpoint.gateway = new GatewaySpy();
                    binarta.checkpoint.profile.billing.confirm({confirmationToken: 't'});
                    expect(binarta.checkpoint.gateway.confirmBillingAgreementRequest).toEqual({
                        paymentProvider: 'p',
                        confirmationToken: 't'
                    });
                });

                it('confirm billing agreement delegates passes ui to gateway', function () {
                    binarta.checkpoint.gateway = new InterfacesWithUIGateway();
                    binarta.checkpoint.profile.billing.confirm({});
                    expect(ui.isWiredToGateway).toBeTruthy();
                });

                it('confirm billing agreement delegates to ui', function () {
                    binarta.checkpoint.gateway = new CompleteBillingDetailsGateway();
                    binarta.checkpoint.profile.billing.confirm({});
                    expect(ui.confirmedBillingAgreementRequest).toBeTruthy();
                });

                it('when confirm billing agreement completes then billing details report as completed', function () {
                    binarta.checkpoint.gateway = new CompleteBillingDetailsGateway();
                    binarta.checkpoint.profile.billing.confirm({});
                    expect(binarta.checkpoint.profile.billing.isComplete()).toBeTruthy();
                });
            });
        });
    });

    function UI() {
        var self = this;

        this.wiredToGateway = function () {
            self.isWiredToGateway = true;
        };

        this.initiatingBillingAgreement = function() {
            this.isInitiatingBillingAgreement = true;
        };

        this.canceledBillingAgreement = function () {
            self.receivedCanceledBillingAgreementRequest = true;
        };

        this.confirmedBillingAgreement = function () {
            self.confirmedBillingAgreementRequest = true;
        }
    }

    function GatewaySpy() {
        this.signin = spy('signinRequest');
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
        this.fetchAccountMetadata = function(response) {
            response.unauthenticated();
        }
    }

    function AuthenticatedGateway() {
        this.fetchAccountMetadata = function(response) {
            response.activeAccountMetadata({});
        }
    }

    function InvalidCredentialsGateway() {
        this.signin = function(request, response) {
            response.rejected();
        }
    }

    function ValidCredentialsGateway() {
        this.signin = function(request, response) {
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
})();