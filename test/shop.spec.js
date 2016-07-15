(function () {
    (function () {
        describe('binarta-shopjs', function () {
            var binarta, ui;

            beforeEach(function () {
                ui = new UI();
                var factory = new BinartajsFactory();
                factory.addUI(ui);
                var checkpoint = new BinartaCheckpointjs();
                var shop = new BinartaShopjs(checkpoint);
                factory.addSubSystems({
                    checkpoint: checkpoint,
                    shop: shop
                });
                binarta = factory.create();
            });

            describe('when previewing an order', function () {
                var renderer;

                beforeEach(function () {
                    renderer = jasmine.createSpy('spy');
                });

                it('then gateway receives a preview order request', function () {
                    binarta.shop.gateway = new GatewaySpy();
                    binarta.shop.previewOrder('order', renderer);
                    expect(binarta.shop.gateway.previewOrderRequest).toEqual('order');
                });

                it('then renderer receives previewed order', function () {
                    binarta.shop.gateway = new ValidOrderGateway();
                    binarta.shop.previewOrder('-', renderer);
                    expect(renderer).toHaveBeenCalledWith('previewed-order');
                });
            });

            describe('checkout', function () {
                var order;

                beforeEach(function () {
                    order = {items: []};
                });

                it('checkout starts out idle', function () {
                    expect(binarta.shop.checkout.status()).toEqual('idle');
                });

                describe('when idle', function () {
                    it('then it is not possible to signin', function () {
                        expect(binarta.shop.checkout.signin).toThrowError('signin.not.supported.when.checkout.in.idle.state');
                    });
                });

                it('the exposed roadmap hides gateway steps', function () {
                    binarta.shop.checkout.start(order, [
                        'authentication-required',
                        'summary',
                        'setup-payment-provider',
                        'completed'
                    ]);
                    expect(binarta.shop.checkout.roadmap()).toEqual([
                        {name: 'summary', locked: true, unlocked: false},
                        {name: 'completed', locked: true, unlocked: false}
                    ]);
                });

                it('the exposed roadmap does not change as you proceed through it', function () {
                    binarta.shop.checkout.start(order, [
                        'authentication-required',
                        'summary',
                        'setup-payment-provider',
                        'completed'
                    ]);
                    binarta.shop.checkout.next();
                    expect(binarta.shop.checkout.roadmap()).toEqual([
                        {name: 'summary', locked: false, unlocked: true},
                        {name: 'completed', locked: true, unlocked: false}
                    ]);
                });

                describe('when checkout is started', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.start(order, [
                            'authentication-required',
                            'completed'
                        ]);
                    });

                    it('then the context is exposed', function () {
                        expect(binarta.shop.checkout.context().order).toEqual(order);
                    });

                    it('then the order is persisted in session storage', function () {
                        expect(JSON.parse(sessionStorage.getItem('binartaJSCheckout')).order).toEqual(order);
                    });

                    it('then the roadmap is persisted in session storage', function () {
                        expect(JSON.parse(sessionStorage.getItem('binartaJSCheckout')).roadmap).toEqual(['authentication-required', 'completed']);
                    });
                });

                it('when checkout is canceled the context is removed from session storage', function () {
                    binarta.shop.checkout.start(order, [
                        'authentication-required',
                        'completed'
                    ]);
                    binarta.shop.checkout.cancel();
                    expect(JSON.parse(sessionStorage.getItem('binartaJSCheckout'))).toEqual({});
                });

                describe('on the authentication required step', function () {
                    beforeEach(function () {
                        binarta.checkpoint.gateway = new InvalidCredentialsGateway();
                        binarta.checkpoint.profile.refresh();
                        binarta.shop.checkout.start(order, [
                            'authentication-required',
                            'completed'
                        ]);
                    });

                    it('then status exposed the current step', function () {
                        expect(binarta.shop.checkout.status()).toEqual('authentication-required');
                    });

                    it('then restarting checkout has no effect', function () {
                        binarta.shop.checkout.start(order);
                        expect(binarta.shop.checkout.status()).toEqual('authentication-required');
                    });

                    it('then you can cancel checkout', function () {
                        binarta.shop.checkout.cancel();
                        expect(binarta.shop.checkout.status()).toEqual('idle');
                    });

                    it('on signin proceed to next step', function () {
                        binarta.checkpoint.gateway = new ValidCredentialsGateway();
                        binarta.checkpoint.profile.refresh();

                        binarta.shop.checkout.retry();

                        expect(binarta.shop.checkout.status()).toEqual('completed');
                    });
                });

                it('when already signed in proceed to next step', function () {
                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.profile.refresh();

                    binarta.shop.checkout.start(order, [
                        'authentication-required',
                        'completed'
                    ]);

                    expect(binarta.shop.checkout.status()).toEqual('completed');
                });

                describe('on the checkout summary step', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.start(order, [
                            'summary',
                            'completed'
                        ])
                    });

                    it('then status exposes the current step', function () {
                        expect(binarta.shop.checkout.status()).toEqual('summary');
                    });

                    it('then restarting checkout has no effect', function () {
                        binarta.shop.checkout.start(order);
                        expect(binarta.shop.checkout.status()).toEqual('summary');
                    });

                    it('then you can cancel checkout', function () {
                        binarta.shop.checkout.cancel();
                        expect(binarta.shop.checkout.status()).toEqual('idle');
                    });

                    it('on confirmation the order can be rejected', function () {
                        binarta.shop.gateway = new InvalidOrderGateway();

                        binarta.shop.checkout.confirm();

                        expect(binarta.shop.checkout.status()).toEqual('summary');
                        expect(binarta.shop.checkout.violationReport()).toEqual('violation-report');
                    });

                    it('when payment provider setup the only rejection reason proceed to next step', function () {
                        binarta.shop.gateway = new PaymentProviderRequiresSetupGateway();
                        binarta.shop.checkout.confirm();
                        expect(binarta.shop.checkout.status()).toEqual('summary');
                    });

                    it('on confirmation the order can be accepted', function () {
                        binarta.shop.gateway = new ValidOrderGateway();
                        var spy = jasmine.createSpy('spy');

                        binarta.shop.checkout.confirm(spy);

                        expect(binarta.shop.checkout.status()).toEqual('completed');
                        expect(spy).toHaveBeenCalled();
                    });
                });

                describe('order confirmation proceeds to next step when rejected because payment provider requires setup and next step is meant to setup the payment provider', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.start(order, [
                            'summary',
                            'setup-payment-provider'
                        ])
                    });

                    it('when payment provider setup is not the only rejection reason do not proceed', function () {
                        binarta.shop.gateway = new NotOnlyPaymentProviderRequiresSetupGateway();
                        binarta.shop.checkout.confirm();
                        expect(binarta.shop.checkout.status()).toEqual('summary');
                    });

                    it('when payment provider setup is the only rejection reason proceed to next step', function () {
                        binarta.shop.gateway = new PaymentProviderRequiresSetupGateway();
                        var spy = jasmine.createSpy('spy');

                        binarta.shop.checkout.confirm(spy);

                        expect(binarta.shop.checkout.status()).toEqual('setup-payment-provider');
                        expect(spy).toHaveBeenCalled();
                    });
                });

                describe('on the setup payment provider step', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.start(order, [
                            'setup-payment-provider',
                            'completed'
                        ])
                    });

                    it('on retry attempt to place order', function () {
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.shop.checkout.retry();
                        expect(binarta.shop.gateway.submitOrderRequest).toEqual(order);
                    });

                    it('when order is accepted proceed to next step', function () {
                        binarta.shop.gateway = new ValidOrderGateway();
                        var spy = jasmine.createSpy('spy');

                        binarta.shop.checkout.retry(spy);

                        expect(binarta.shop.checkout.status()).toEqual('completed');
                        expect(spy).toHaveBeenCalled();
                    });

                    it('when order is rejected expose violation report', function () {
                        binarta.shop.gateway = new InvalidOrderGateway();

                        binarta.shop.checkout.retry();

                        expect(binarta.shop.checkout.status()).toEqual('setup-payment-provider');
                        expect(binarta.shop.checkout.violationReport()).toEqual('violation-report');
                    });
                });

                describe('on the checkout completed step', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.start(order, [
                            'completed'
                        ])
                    });

                    it('then status exposed the current step', function () {
                        expect(binarta.shop.checkout.status()).toEqual('completed');
                    });

                    it('then restarting checkout is possible', function () {
                        binarta.shop.checkout.start(order, [
                            'authentication-required'
                        ]);
                        expect(binarta.shop.checkout.status()).toEqual('authentication-required');
                    });

                    it('then you can cancel checkout', function () {
                        binarta.shop.checkout.cancel();
                        expect(binarta.shop.checkout.status()).toEqual('idle');
                    });
                });

                describe('installing custom steps', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.installCustomStepDefinition('custom-step', CustomStep);
                        binarta.shop.checkout.start(order, [
                            'custom-step'
                        ]);
                    });

                    it('then status exposes the current step', function () {
                        expect(binarta.shop.checkout.status()).toEqual('custom-step');
                    });

                    it('then restarting checkout has no effect', function () {
                        binarta.shop.checkout.start(order);
                        expect(binarta.shop.checkout.status()).toEqual('custom-step');
                    });

                    it('then you can cancel checkout', function () {
                        binarta.shop.checkout.cancel();
                        expect(binarta.shop.checkout.status()).toEqual('idle');
                    });

                    it('then the custom step is included in the roadmap', function() {
                        expect(binarta.shop.checkout.roadmap()).toEqual([
                            {name: 'custom-step', locked: false, unlocked: true}
                        ]);
                    });
                });

                it('custom steps can be gateway steps and left out of the roadmap', function() {
                    binarta.shop.checkout.installCustomStepDefinition('custom-step', CustomStep, {isGatewayStep:true});
                    binarta.shop.checkout.start(order, [
                        'custom-step'
                    ]);
                    expect(binarta.shop.checkout.roadmap()).toEqual([]);
                });

                function CustomStep(fsm) {
                    fsm.currentState = this;
                    this.name = 'custom-step';
                }

                it('you can jump to a specific step directly', function () {
                    binarta.shop.checkout.jumpTo('completed');
                    expect(binarta.shop.checkout.status()).toEqual('completed');
                });
            });

            describe('profile extensions', function () {
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
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.checkpoint.profile.billing.initiate('payment-provider');
                        expect(binarta.shop.gateway.initiateBillingAgreementRequest).toEqual('payment-provider');
                    });

                    it('initiate billing agreement remembers payment provider on session storage', function () {
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.checkpoint.profile.billing.initiate('payment-provider');
                        expect(sessionStorage.billingAgreementProvider).toEqual('payment-provider');
                    });

                    it('initiate billing agreement passes ui to gateway', function () {
                        binarta.shop.gateway = new InterfacesWithUIGateway();
                        binarta.checkpoint.profile.billing.initiate('irrelevant');
                        expect(ui.isWiredToGateway).toBeTruthy();
                    });

                    it('initiate billing agreement reports start of work to ui', function () {
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.checkpoint.profile.billing.initiate('irrelevant');
                        expect(ui.isInitiatingBillingAgreement).toBeTruthy();
                    });

                    it('cancel billing agreement delegates to ui', function () {
                        binarta.checkpoint.profile.billing.cancel();
                        expect(ui.receivedCanceledBillingAgreementRequest).toBeTruthy();
                    });

                    it('confirm billing agreement delegates to gateway', function () {
                        sessionStorage.billingAgreementProvider = 'p';
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.checkpoint.profile.billing.confirm({confirmationToken: 't'});
                        expect(binarta.shop.gateway.confirmBillingAgreementRequest).toEqual({
                            paymentProvider: 'p',
                            confirmationToken: 't'
                        });
                    });

                    it('confirm billing agreement delegates passes ui to gateway', function () {
                        binarta.shop.gateway = new InterfacesWithUIGateway();
                        binarta.checkpoint.profile.billing.confirm({});
                        expect(ui.isWiredToGateway).toBeTruthy();
                    });

                    it('confirm billing agreement delegates to ui', function () {
                        binarta.shop.gateway = new CompleteBillingDetailsGateway();
                        binarta.checkpoint.profile.billing.confirm({});
                        expect(ui.confirmedBillingAgreementRequest).toBeTruthy();
                    });

                    it('when confirm billing agreement completes then billing details report as completed', function () {
                        binarta.shop.gateway = new CompleteBillingDetailsGateway();
                        binarta.checkpoint.profile.billing.confirm({});
                        expect(binarta.checkpoint.profile.billing.isComplete()).toBeTruthy();
                    });
                });
            })
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
})();