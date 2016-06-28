(function() {
    (function() {
        describe('binarta-shopjs', function() {
            var binarta, ui;

            beforeEach(function() {
                ui = new UI();
                var factory = new BinartajsFactory();
                factory.addUI(ui);
                factory.addSubSystems({shop: new BinartaShopjs()});
                binarta = factory.create();
            });

            describe('checkout', function() {
                var order;

                beforeEach(function() {
                    order = {};
                });

                it('checkout starts out idle', function() {
                    expect(binarta.shop.checkout.status()).toEqual('idle');
                });

                describe('when idle', function() {
                    it('then it is not possible to signin', function() {
                        expect(binarta.shop.checkout.signin).toThrowError('signin.not.supported.when.checkout.in.idle.state');
                    });
                });


                describe('when starting checkout', function() {
                    beforeEach(function() {
                        binarta.shop.checkout.start(order)
                    });

                    it('then authentication is required', function() {
                        expect(binarta.shop.checkout.status()).toEqual('authentication-required');
                    });

                    it('then restarting checkout has no effect', function() {
                        binarta.shop.checkout.start(order);
                        expect(binarta.shop.checkout.status()).toEqual('authentication-required');
                    });

                    it('then you can cancel checkout', function() {
                        binarta.shop.checkout.cancel();
                        expect(binarta.shop.checkout.status()).toEqual('idle');
                    });

                    describe('when signing in', function() {
                        var credentials;

                        beforeEach(function() {
                            credentials = 'credentials';
                            binarta.shop.checkout.signin(credentials);
                        });

                        it('then next step', function() {
                            // expect(binarta.shop.checkout.status()).toEqual('-');
                        });
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