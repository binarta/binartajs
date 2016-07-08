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

        it('profile is unauthenticated', function () {
            expect(binarta.checkpoint.profile.isAuthenticated()).toBeFalsy();
        });

        it('profile is unauthenticated on refresh', function () {
            binarta.checkpoint.gateway = new UnauthenticatedGateway();
            binarta.checkpoint.profile.refresh();
            expect(binarta.checkpoint.profile.isAuthenticated()).toBeFalsy();
        });

        it('profile is authenticated on refresh', function () {
            binarta.checkpoint.gateway = new AuthenticatedGateway();
            binarta.checkpoint.profile.refresh();
            expect(binarta.checkpoint.profile.isAuthenticated()).toBeTruthy();
        });

        it('profile is exposed on refresh', function () {
            binarta.checkpoint.gateway = new AuthenticatedGateway();
            binarta.checkpoint.profile.refresh();
            expect(binarta.checkpoint.profile.metadata()).toEqual({principal: 'p'});
        });

        it('profile is unauthenticated on refresh when session expires', function () {
            binarta.checkpoint.gateway = new AuthenticatedGateway();
            binarta.checkpoint.profile.refresh();

            binarta.checkpoint.gateway = new UnauthenticatedGateway();
            binarta.checkpoint.profile.refresh();

            expect(binarta.checkpoint.profile.isAuthenticated()).toBeFalsy();
            expect(binarta.checkpoint.profile.metadata()).toEqual({});
        });

        describe('registration form', function () {
            it('starts out in idle state', function () {
                expect(binarta.checkpoint.registrationForm.status()).toEqual('idle');
            });

            it('initially exposes a blank violation report', function () {
                expect(binarta.checkpoint.registrationForm.violationReport()).toEqual({});
            });

            describe('when submitting form and waiting for a response', function () {
                beforeEach(function () {
                    binarta.checkpoint.gateway = new GatewaySpy();
                    binarta.checkpoint.registrationForm.submit({
                        email: 'e',
                        username: 'u',
                        password: 'p',
                        vat: 'v',
                        captcha: 'c'
                    });
                });

                it('then credentials are captured by the gateway', function () {
                    expect(binarta.checkpoint.gateway.registrationRequest).toEqual({
                        email: 'e',
                        alias: 'u',
                        username: 'u',
                        password: 'p',
                        vat: 'v',
                        captcha: 'c'
                    });
                });


                it('then working state is exposed', function () {
                    expect(binarta.checkpoint.registrationForm.status()).toEqual('working');
                });

                it('then there is still a blank violation report exposed', function () {
                    expect(binarta.checkpoint.registrationForm.violationReport()).toEqual({});
                });
            });

            it('username defaults to email if not specified', function () {
                binarta.checkpoint.gateway = new GatewaySpy();
                binarta.checkpoint.registrationForm.submit({email: 'e'});
                expect(binarta.checkpoint.gateway.registrationRequest.username).toEqual('e');
            });

            it('alias defaults to username', function () {
                binarta.checkpoint.gateway = new GatewaySpy();
                binarta.checkpoint.registrationForm.submit({username: 'u'});
                expect(binarta.checkpoint.gateway.registrationRequest.alias).toEqual('u');
            });

            it('alias defaults to email if username not specified', function () {
                binarta.checkpoint.gateway = new GatewaySpy();
                binarta.checkpoint.registrationForm.submit({email: 'e'});
                expect(binarta.checkpoint.gateway.registrationRequest.alias).toEqual('e');
            });

            describe('when submitting form with invalid credentials', function () {
                beforeEach(function () {
                    binarta.checkpoint.gateway = new InvalidCredentialsGateway();
                    binarta.checkpoint.registrationForm.submit('-');
                });

                it('then working state is exposed', function () {
                    expect(binarta.checkpoint.registrationForm.status()).toEqual('rejected');
                });

                it('then a violation report is exposed', function () {
                    expect(binarta.checkpoint.registrationForm.violationReport()).toEqual('violation-report');
                });

                it('then resubmission is possible', function () {
                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.registrationForm.submit('-');
                    expect(binarta.checkpoint.registrationForm.status()).toEqual('registered');
                });

                it('resubmission supports the optional event listener', function () {
                    var listener = jasmine.createSpyObj('listener', ['success']);

                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.registrationForm.submit('-', listener);

                    expect(listener.success).toHaveBeenCalled();
                });
            });

            it('you can install an optional form rejection listener', function () {
                var listener = jasmine.createSpyObj('listener', ['rejected']);
                binarta.checkpoint.registrationForm.eventListener = listener;

                binarta.checkpoint.gateway = new InvalidCredentialsGateway();
                binarta.checkpoint.registrationForm.submit('-');

                expect(listener.rejected).toHaveBeenCalled();
            });

            describe('when submitting form with valid credentials', function () {
                beforeEach(function () {
                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.registrationForm.submit('-');
                });

                it('then registered state is exposed', function () {
                    expect(binarta.checkpoint.registrationForm.status()).toEqual('registered');
                });

                it('then signin form is in authenticated state', function () {
                    expect(binarta.checkpoint.signinForm.status()).toEqual('authenticated');
                });

                it('then profile is in authenticated state', function () {
                    expect(binarta.checkpoint.profile.isAuthenticated()).toBeTruthy();
                });

                it('then there is still a blank violation report exposed', function () {
                    expect(binarta.checkpoint.registrationForm.violationReport()).toEqual({});
                });

                it('then resubmission is not possible', function () {
                    expect(binarta.checkpoint.registrationForm.submit).toThrowError('already.registered');
                });

                it('when profile refresh results in the user being unauthenticated then the form resets', function () {
                    binarta.checkpoint.gateway = new UnauthenticatedGateway();
                    binarta.checkpoint.profile.refresh();
                    expect(binarta.checkpoint.registrationForm.status()).toEqual('idle');
                });
            });

            it('you can optionally pass an event listener for the current request', function () {
                var listener = jasmine.createSpyObj('listener', ['success']);

                binarta.checkpoint.gateway = new ValidCredentialsGateway();
                binarta.checkpoint.registrationForm.submit('-', listener);

                expect(listener.success).toHaveBeenCalled();
            });
        });

        describe('signin form', function () {
            it('starts out in idle state', function () {
                expect(binarta.checkpoint.signinForm.status()).toEqual('idle');
            });

            it('initially exposes a blank violation', function () {
                expect(binarta.checkpoint.signinForm.violation()).toEqual('');
            });

            describe('when submitting form and waiting for a response', function () {
                beforeEach(function () {
                    binarta.checkpoint.gateway = new GatewaySpy();
                    binarta.checkpoint.signinForm.submit('credentials');
                });

                it('then credentials are captured by the gateway', function () {
                    expect(binarta.checkpoint.gateway.signinRequest).toEqual('credentials');
                });

                it('then working state is exposed', function () {
                    expect(binarta.checkpoint.signinForm.status()).toEqual('working');
                });

                it('then there is still a blank violation exposed', function () {
                    expect(binarta.checkpoint.signinForm.violation()).toEqual('');
                });
            });

            describe('when submitting form with invalid credentials', function () {
                beforeEach(function () {
                    binarta.checkpoint.gateway = new InvalidCredentialsGateway();
                    binarta.checkpoint.signinForm.submit('-');
                });

                it('then working state is exposed', function () {
                    expect(binarta.checkpoint.signinForm.status()).toEqual('rejected');
                });

                it('then a violation is exposed', function () {
                    expect(binarta.checkpoint.signinForm.violation()).toEqual('credentials.mismatch');
                });

                it('then resubmission is possible', function () {
                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.signinForm.submit('-');
                    expect(binarta.checkpoint.signinForm.status()).toEqual('authenticated');
                });

                it('resubmission supports the optional event listener', function () {
                    var listener = jasmine.createSpyObj('listener', ['success']);

                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.signinForm.submit('-', listener);

                    expect(listener.success).toHaveBeenCalled();
                });
            });

            describe('when submitting form with valid credentials', function () {
                beforeEach(function () {
                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.signinForm.submit('-');
                });

                it('then authenticated state is exposed', function () {
                    expect(binarta.checkpoint.signinForm.status()).toEqual('authenticated');
                });

                it('then there is still a blank violation exposed', function () {
                    expect(binarta.checkpoint.signinForm.violation()).toEqual('');
                });

                it('then resubmission is not possible', function () {
                    expect(binarta.checkpoint.signinForm.submit).toThrowError('already.authenticated');
                });

                it('when profile refresh results in the user being unauthenticated then the form resets', function () {
                    binarta.checkpoint.gateway = new UnauthenticatedGateway();
                    binarta.checkpoint.profile.refresh();
                    expect(binarta.checkpoint.signinForm.status()).toEqual('idle');
                });

                it('then registration form exposes registered state', function () {
                    expect(binarta.checkpoint.registrationForm.status()).toEqual('registered');
                });
            });

            it('you can optionally pass an event listener for the current request', function () {
                var listener = jasmine.createSpyObj('listener', ['success']);

                binarta.checkpoint.gateway = new ValidCredentialsGateway();
                binarta.checkpoint.signinForm.submit('-', listener);

                expect(listener.success).toHaveBeenCalled();
            });
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

                it('initiate billing agreement reports start of work to ui', function () {
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

        this.initiatingBillingAgreement = function () {
            this.isInitiatingBillingAgreement = true;
        };

        this.canceledBillingAgreement = function () {
            self.receivedCanceledBillingAgreementRequest = true;
        };

        this.confirmedBillingAgreement = function () {
            self.confirmedBillingAgreementRequest = true;
        }
    }
})();