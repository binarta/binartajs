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

                    it('then the order is exposed', function () {
                        expect(binarta.shop.checkout.order()).toEqual(order);
                    });

                    it('then the order is persisted in session storage', function () {
                        expect(JSON.parse(sessionStorage.binartaJSCheckoutOrder)).toEqual(order);
                    });

                    it('then the steps are persisted in session storage', function() {
                        expect(JSON.parse(sessionStorage.binartaJSCheckoutRoadmap)).toEqual(['completed']);
                    });
                });

                it('when checkout is canceled the order is removed from session storage', function () {
                    binarta.shop.checkout.start(order, [
                        'authentication-required',
                        'completed'
                    ]);
                    binarta.shop.checkout.cancel();
                    expect(JSON.parse(sessionStorage.binartaJSCheckoutOrder)).toEqual({});
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