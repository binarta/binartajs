(function () {
    (function () {
        describe('binarta-shopjs', function () {
            var binarta, ui;

            beforeEach(function () {
                ui = new UI();
                var factory = new BinartajsFactory();
                factory.addUI(ui);
                factory.addSubSystems({
                    checkpoint: new BinartaCheckpointjs(),
                    shop: new BinartaShopjs()
                });
                binarta = factory.create();
            });

            describe('when previewing an order', function() {
                var renderer;

                beforeEach(function() {
                    renderer = jasmine.createSpy('spy');
                });

                it('then gateway receives a preview order request', function() {
                    binarta.shop.gateway = new GatewaySpy();
                    binarta.shop.previewOrder('order', renderer);
                    expect(binarta.shop.gateway.previewOrderRequest).toEqual('order');
                });

                it('then renderer receives previewed order', function() {
                    binarta.shop.gateway = new ValidOrderGateway();
                    binarta.shop.previewOrder('-', renderer);
                    expect(renderer).toHaveBeenCalledWith('previewed-order');
                });
            });

            describe('checkout', function () {
                var order;

                beforeEach(function () {
                    order = {items:[]};
                });

                it('checkout starts out idle', function () {
                    expect(binarta.shop.checkout.status()).toEqual('idle');
                });

                describe('when idle', function () {
                    it('then it is not possible to signin', function () {
                        expect(binarta.shop.checkout.signin).toThrowError('signin.not.supported.when.checkout.in.idle.state');
                    });
                });

                describe('when checkout is started', function() {
                    beforeEach(function() {
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

                    it('then the roadmap is persisted in session storage', function() {
                        expect(JSON.parse(sessionStorage.getItem('binartaJSCheckout')).roadmap).toEqual(['completed']);
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

                    it('on confirmation the order can be rejected', function() {
                        binarta.shop.gateway = new InvalidOrderGateway();

                        binarta.shop.checkout.confirm();

                        expect(binarta.shop.checkout.status()).toEqual('summary');
                        expect(binarta.shop.checkout.violationReport()).toEqual('violation-report');
                    });

                    it('when payment provider setup the only rejection reason proceed to next step', function() {
                        binarta.shop.gateway = new PaymentProviderRequiresSetupGateway();
                        binarta.shop.checkout.confirm();
                        expect(binarta.shop.checkout.status()).toEqual('summary');
                    });

                    it('on confirmation the order can be accepted', function() {
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

                    it('when payment provider setup is not the only rejection reason do not proceed', function() {
                        binarta.shop.gateway = new NotOnlyPaymentProviderRequiresSetupGateway();
                        binarta.shop.checkout.confirm();
                        expect(binarta.shop.checkout.status()).toEqual('summary');
                    });

                    it('when payment provider setup is the only rejection reason proceed to next step', function() {
                        binarta.shop.gateway = new PaymentProviderRequiresSetupGateway();
                        var spy = jasmine.createSpy('spy');

                        binarta.shop.checkout.confirm(spy);

                        expect(binarta.shop.checkout.status()).toEqual('setup-payment-provider');
                        expect(spy).toHaveBeenCalled();
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

                    function CustomStep(fsm) {
                        fsm.currentState = this;
                        this.name = 'custom-step';
                    }
                });

                it('you can jump to a specific step directly', function () {
                    binarta.shop.checkout.jumpTo('completed');
                    expect(binarta.shop.checkout.status()).toEqual('completed');
                });
            });
        });

        function UI() {
        }
    })();
})();