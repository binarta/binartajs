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
                    order = {};
                });

                it('checkout starts out idle', function () {
                    expect(binarta.shop.checkout.status()).toEqual('idle');
                });

                describe('when idle', function () {
                    it('then it is not possible to signin', function () {
                        expect(binarta.shop.checkout.signin).toThrowError('signin.not.supported.when.checkout.in.idle.state');
                    });
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
            });

            // describe('active profile', function() {
            //     describe('billing details', function() {
            //         it('start out incomplete', function() {
            //             expect(binarta.checkpoint.profile.billing.isComplete()).toBeFalsy();
            //         });
            //
            //         it('profile refresh loads incomplete billing details', function() {
            //             binarta.checkpoint.profile.gateway = new InCompleteBillingDetailsGateway();
            //             binarta.checkpoint.profile.refresh();
            //             expect(binarta.checkpoint.profile.billing.isComplete()).toBeFalsy();
            //         });
            //
            //         it('profile refresh loads complete billing details', function() {
            //             binarta.checkpoint.profile.gateway = new CompleteBillingDetailsGateway();
            //             binarta.checkpoint.profile.refresh();
            //             expect(binarta.checkpoint.profile.billing.isComplete()).toBeTruthy();
            //         });
            //     });
            // });
        });

        function UI() {

        }

        // function InCompleteBillingDetailsGateway() {
        //     this.fetchAccountMetadata = function(response) {
        //         response.activeAccountMetadata({billing:{complete:false}});
        //     }
        // }
        //
        // function CompleteBillingDetailsGateway() {
        //     this.fetchAccountMetadata = function(response) {
        //         response.activeAccountMetadata({billing:{complete:true}});
        //     }
        // }
    })();
})();