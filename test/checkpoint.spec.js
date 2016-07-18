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
            expect(binarta.checkpoint.profile.metadata()).toEqual({principal: 'p', email: 'e'});
            expect(binarta.checkpoint.profile.email()).toEqual('e');
        });

        it('profile is unauthenticated on refresh when session expires', function () {
            binarta.checkpoint.gateway = new AuthenticatedGateway();
            binarta.checkpoint.profile.refresh();

            binarta.checkpoint.gateway = new UnauthenticatedGateway();
            binarta.checkpoint.profile.refresh();

            expect(binarta.checkpoint.profile.isAuthenticated()).toBeFalsy();
            expect(binarta.checkpoint.profile.metadata()).toEqual({});
        });

        describe('profile refresh takes an optional event handler for the current request', function () {
            it('with optional success handler', function () {
                var spy = jasmine.createSpyObj('spy', ['success']);
                binarta.checkpoint.gateway = new AuthenticatedGateway();
                binarta.checkpoint.profile.refresh(spy);
                expect(spy.success).toHaveBeenCalled();
            });

            it('with optional unauthenticated handler', function () {
                var spy = jasmine.createSpyObj('spy', ['unauthenticated']);
                binarta.checkpoint.gateway = new UnauthenticatedGateway();
                binarta.checkpoint.profile.refresh(spy);
                expect(spy.unauthenticated).toHaveBeenCalled();
            });
        });

        it('profile signout delegates to gateway', function () {
            binarta.checkpoint.gateway = new GatewaySpy();
            binarta.checkpoint.profile.signout();
            expect(binarta.checkpoint.gateway.signoutRequest).toBeTruthy();
        });

        it('profile signout', function () {
            binarta.checkpoint.gateway = new AuthenticatedGateway();
            binarta.checkpoint.profile.signout();
            expect(binarta.checkpoint.profile.isAuthenticated()).toBeFalsy();
        });

        it('profile is initially in an idle status', function () {
            expect(binarta.checkpoint.profile.status()).toEqual('idle');
        });

        describe('when putting the profile in edit mode', function () {
            beforeEach(function () {
                binarta.checkpoint.profile.edit();
            });

            it('then the status reflects it is in edit mode', function () {
                expect(binarta.checkpoint.profile.status()).toEqual('editing');
            });

            it('then the profile exposes an update request', function () {
                expect(binarta.checkpoint.profile.updateRequest()).toEqual({});
            });

            it('then edit mode can be canceled', function () {
                binarta.checkpoint.profile.cancel();
                expect(binarta.checkpoint.profile.status()).toEqual('idle');
            });

            it('and update then profile returns to idle status', function () {
                binarta.checkpoint.profile.update();
                expect(binarta.checkpoint.profile.status()).toEqual('idle');
            });

            it('and update with custom update handlers defers idle status until update handlers complete', function () {
                var responseHandlers = [];
                binarta.checkpoint.profile.updateProfileHandlers.push(function (request, response) {
                    responseHandlers.push(response);
                });
                binarta.checkpoint.profile.updateProfileHandlers.push(function (request, response) {
                    responseHandlers.push(response);
                });

                binarta.checkpoint.profile.update();

                expect(binarta.checkpoint.profile.status()).toEqual('editing');
                responseHandlers[0].success();
                expect(binarta.checkpoint.profile.status()).toEqual('editing');
                responseHandlers[1].success();
                expect(binarta.checkpoint.profile.status()).toEqual('idle');
            });
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

                it('when profile signout is executed then the form resets', function () {
                    binarta.checkpoint.profile.signout();
                    expect(binarta.checkpoint.registrationForm.status()).toEqual('idle');
                });
            });

            describe('you can optionally pass an event listener for the current request', function () {
                var listener;

                beforeEach(function () {
                    listener = jasmine.createSpyObj('listener', ['success', 'rejected']);
                });

                it('on success', function () {
                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.registrationForm.submit('-', listener);
                    expect(listener.success).toHaveBeenCalled();
                });

                it('on rejected', function () {
                    binarta.checkpoint.gateway = new InvalidCredentialsGateway();
                    binarta.checkpoint.registrationForm.submit('-', listener);
                    expect(listener.rejected).toHaveBeenCalledWith('violation-report');
                });
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

                it('then registration form exposes registered state', function () {
                    expect(binarta.checkpoint.registrationForm.status()).toEqual('registered');
                });

                it('when profile refresh results in the user being unauthenticated then the form resets', function () {
                    binarta.checkpoint.gateway = new UnauthenticatedGateway();
                    binarta.checkpoint.profile.refresh();
                    expect(binarta.checkpoint.signinForm.status()).toEqual('idle');
                });

                it('when profile signout is executed then the form resets', function () {
                    binarta.checkpoint.profile.signout();
                    expect(binarta.checkpoint.signinForm.status()).toEqual('idle');
                });
            });

            describe('you can optionally pass an event listener for the current request', function () {
                var listener;

                beforeEach(function () {
                    listener = jasmine.createSpyObj('listener', ['success', 'rejected']);
                });

                it('on success', function () {
                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.signinForm.submit('-', listener);
                    expect(listener.success).toHaveBeenCalled();
                });

                it('on rejected', function () {
                    binarta.checkpoint.gateway = new InvalidCredentialsGateway();
                    binarta.checkpoint.signinForm.submit('-', listener);
                    expect(listener.rejected).toHaveBeenCalledWith('credentials.mismatch');
                })
            });
        });
    });

    function UI() {
    }
})();