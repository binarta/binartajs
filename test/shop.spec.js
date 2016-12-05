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

                localStorage.removeItem('binartaJSPaymentProvider');
            });

            afterEach(function () {
                sessionStorage.removeItem('binartaJSCheckout');
            });

            describe('basket', function () {
                var eventListener;

                beforeEach(function () {
                    binarta.shop.basket.clear();

                    eventListener = jasmine.createSpyObj('event-listener', ['itemAdded', 'itemRemoved', 'itemUpdated', 'cleared']);
                    binarta.shop.basket.eventRegistry.add(eventListener);
                });

                it('initializing when local storage exceeds quota silently succeeds', function () {
                    binarta.shop.localStorage = {
                        setItem: function () {
                            throw new Error('QuotaExceeded');
                        }
                    };
                    binarta.shop.basket.initialize();
                });

                it('refreshing an empty basket remains empty', function () {
                    binarta.shop.gateway = new ValidOrderGateway();
                    binarta.shop.basket.refresh();
                    expect(binarta.shop.basket.items()).toEqual([]);
                    expect(binarta.shop.basket.subTotal()).toEqual(0);
                    expect(binarta.shop.basket.toOrder().quantity).toEqual(0);
                });

                it('restore when local storage is disabled silently succeeds', function () {
                    binarta.shop.localStorage = undefined;
                    binarta.shop.gateway = new ValidOrderGateway();
                    binarta.shop.basket.restore();
                });

                it('expose coupon code', function () {
                    expect(binarta.shop.basket.couponCode()).toBeUndefined();
                    binarta.shop.basket.couponCode('1234');
                    expect(binarta.shop.basket.couponCode()).toEqual('1234');
                    expect(JSON.parse(localStorage.basket).coupon).toEqual('1234');
                });

                it('restore coupon code from local storage', function () {
                    binarta.shop.gateway = new ValidOrderGateway();
                    localStorage.basket = JSON.stringify({items: [], coupon: '1234'});
                    binarta.shop.basket.restore();
                    expect(binarta.shop.basket.couponCode()).toEqual('1234');
                });

                describe('when adding an item to the basket', function () {
                    var item;
                    var error = jasmine.createSpy('error');
                    var success = jasmine.createSpy('success');

                    beforeEach(function () {
                        binarta.shop.gateway = new GatewaySpy();
                    });

                    it('return value from toOrder can be modified without affecting the actual basket', function () {
                        binarta.shop.basket.toOrder().quantity = 99;
                        expect(binarta.shop.basket.toOrder().quantity).toEqual(0);
                    });

                    it('validate the order', function () {
                        item = {id: 'sale-id', price: 100, quantity: 2};
                        binarta.shop.basket.add({item: item, success: success, error: error});
                        expect(binarta.shop.gateway.validateOrderRequest).toEqual({
                            items: [
                                {id: 'sale-id', price: 100, quantity: 2}
                            ]
                        });
                    });

                    describe('on succesful validation', function () {
                        beforeEach(function () {
                            binarta.shop.gateway = new ValidOrderWithDeferredPreviewGateway();
                            item = {id: 'sale-id', quantity: 2};
                            binarta.shop.basket.add({item: item, success: success, error: error});
                        });

                        it('basket refresh request is made', function () {
                            expect(binarta.shop.gateway.previewOrderRequest).toEqual({
                                items: [{
                                    id: 'sale-id',
                                    quantity: 2
                                }]
                            });
                        });

                        it('basket status is not yet updated', function () {
                            expect(binarta.shop.basket.toOrder().quantity).toEqual(0);
                            expect(success).not.toHaveBeenCalled();
                            expect(eventListener.itemAdded).not.toHaveBeenCalled();
                        });

                        describe('when refresh completes', function () {
                            beforeEach(function () {
                                binarta.shop.gateway.doPreviewOrders();
                            });

                            it('then the item is added to the item list', function () {
                                expect(binarta.shop.basket.items()).toEqual([{id: 'sale-id', price: 100, quantity: 2}]);
                                expect(binarta.shop.basket.toOrder().items[0].id).toEqual('sale-id');
                                expect(binarta.shop.basket.toOrder().items[0].quantity).toEqual(2);
                                expect(binarta.shop.basket.toOrder().items[0].price).toEqual(100);
                                expect(binarta.shop.basket.toOrder().quantity).toEqual(2);
                            });

                            it('calculate sub total', function () {
                                expect(binarta.shop.basket.subTotal()).toEqual(200);
                            });

                            it('expose presentable sub total', function () {
                                expect(binarta.shop.basket.presentableSubTotal()).toEqual('$99.99');
                            });

                            it('success callback has been called', function () {
                                expect(success).toHaveBeenCalled();
                                expect(eventListener.itemAdded).toHaveBeenCalled();
                            });

                            describe('repeatedly', function () {
                                beforeEach(function () {
                                });

                                describe('with success', function () {
                                    beforeEach(function () {
                                        binarta.shop.basket.add({item: item});
                                    });

                                    it('causes increments', function () {
                                        expect(binarta.shop.basket.items()).toEqual([
                                            {id: item.id, price: 100, quantity: 4}
                                        ]);
                                    });

                                    it('calculate sub total', function () {
                                        expect(binarta.shop.basket.subTotal()).toEqual(400);
                                    });
                                });

                                describe('with rejection', function () {
                                    beforeEach(function () {
                                        binarta.shop.gateway = new InvalidOrderGateway();
                                        binarta.shop.basket.add({item: item});
                                    });

                                    it('test', function () {
                                        expect(binarta.shop.basket.items()).toEqual([
                                            {id: item.id, price: 100, quantity: 2}
                                        ])
                                    });
                                });
                            });
                        });

                        it('add with configuration', function () {
                            binarta.shop.gateway = new ValidOrderGateway();
                            var item2 = {id: 'sale-id-2', price: 200, quantity: 1, configuration: {x: 'y'}};
                            binarta.shop.basket.add({item: item2, success: success, error: error});
                            expect(binarta.shop.basket.items()[1].configuration).toEqual({x: 'y'});
                        });

                        describe('and any additional items', function () {
                            var item2;

                            beforeEach(function () {
                                binarta.shop.gateway = new ValidOrderGateway();
                                item2 = {id: 'sale-id-2', price: 200, quantity: 1, configuration: {x: 'y'}};
                                binarta.shop.basket.couponCode('coupon-code');
                                binarta.shop.basket.add({item: item2, success: success, error: error});
                            });

                            it('are added to the item list', function () {
                                expect(binarta.shop.basket.items()).toEqual([
                                    {id: 'sale-id', price: 100, quantity: 2, couponCode: 'coupon-code'},
                                    {id: 'sale-id-2', price: 100, quantity: 1, configuration: {x: 'y'}}
                                ]);
                            });

                            it('calculate sub total', function () {
                                expect(binarta.shop.basket.subTotal()).toEqual(300);
                            });

                            it('are flushed', function () {
                                expect(JSON.parse(localStorage.basket)).toEqual({
                                    items: [
                                        {id: 'sale-id', price: 100, quantity: 2, couponCode: 'coupon-code'},
                                        {id: 'sale-id-2', price: 100, quantity: 1, configuration: {x: 'y'}}
                                    ],
                                    quantity: 3,
                                    presentableItemTotal: '$99.99',
                                    presentablePrice: '$99.99',
                                    additionalCharges: 'additional-charges',
                                    coupon: 'coupon-code'
                                });
                            });

                            describe('and updating an item', function () {
                                var updatedQuantity;

                                function resetSpies(spies) {
                                    spies.forEach(function (it) {
                                        it.calls.reset()
                                    });
                                }

                                beforeEach(function () {
                                    resetSpies([success, error]);
                                    binarta.shop.gateway = new GatewaySpy();
                                    updatedQuantity = 10;
                                    var it = binarta.shop.basket.toOrder().items[0];
                                    it.quantity = updatedQuantity;
                                    it.update();
                                });

                                it('then validate the order', function () {
                                    expect(binarta.shop.gateway.validateOrderRequest).toEqual({items: binarta.shop.basket.items()});
                                });

                                it('with the updated quantity', function () {
                                    expect(binarta.shop.gateway.validateOrderRequest.items[0].quantity).toEqual(updatedQuantity);
                                });

                                describe('with success', function () {
                                    beforeEach(function () {
                                        binarta.shop.gateway = new ValidOrderWithDeferredPreviewGateway();
                                        var it = binarta.shop.basket.toOrder().items[0];
                                        it.quantity = updatedQuantity;
                                        it.update();
                                    });

                                    it('basket refresh request is made', function () {
                                        expect(binarta.shop.gateway.previewOrderRequest).toEqual({
                                            items: [
                                                {
                                                    id: 'sale-id',
                                                    quantity: 10,
                                                    couponCode: 'coupon-code'
                                                },
                                                {
                                                    id: 'sale-id-2',
                                                    quantity: 1,
                                                    configuration: {x: 'y'}
                                                }]
                                        });
                                    });

                                    it('basket status is not yet updated', function () {
                                        expect(binarta.shop.basket.toOrder().quantity).toEqual(3);
                                        expect(success).not.toHaveBeenCalled();
                                        expect(eventListener.itemUpdated).not.toHaveBeenCalled();
                                    });

                                    describe('when refresh completes', function () {
                                        beforeEach(function () {
                                            binarta.shop.gateway.doPreviewOrders();
                                        });

                                        it('then quantity is updated', function () {
                                            expect(binarta.shop.basket.items()[0].quantity).toEqual(10);
                                        });

                                        it('then updates are flushed', function () {
                                            expect(JSON.parse(localStorage.basket)).toEqual({
                                                items: [
                                                    {
                                                        id: 'sale-id',
                                                        quantity: 10,
                                                        couponCode: 'coupon-code',
                                                        price: 100
                                                    },
                                                    {id: 'sale-id-2', quantity: 1, configuration: {x: 'y'}, price: 100}
                                                ],
                                                quantity: 11,
                                                presentableItemTotal: '$99.99',
                                                presentablePrice: '$99.99',
                                                additionalCharges: 'additional-charges',
                                                coupon: 'coupon-code'
                                            });
                                        });

                                        it('success callback has been called', function () {
                                            expect(eventListener.itemUpdated).toHaveBeenCalled();
                                        });

                                        describe('to blank', function () {
                                            beforeEach(function () {
                                                updatedItem = {id: item.id, price: item.price, quantity: ''};
                                                binarta.shop.basket.update({item: updatedItem});
                                            });

                                            it('then quantity is unaffected', function () {
                                                expect(binarta.shop.basket.items()[0].quantity).toEqual(10);
                                            });
                                        });

                                        describe('to zero', function () {
                                            beforeEach(function () {
                                                updatedItem = {id: item.id, price: item.price, quantity: 0};
                                                binarta.shop.basket.update({item: updatedItem});
                                            });

                                            it('then quantity is unaffected', function () {
                                                expect(binarta.shop.basket.items()[0].quantity).toEqual(10);
                                            });
                                        });
                                    });
                                });

                                describe('with rejection', function () {
                                    beforeEach(function () {
                                        binarta.shop.gateway = new InvalidOrderGateway();
                                        var it = binarta.shop.basket.toOrder().items[0];
                                        it.quantity = updatedQuantity;
                                        it.update();
                                    });

                                    it('original values are retained', function () {
                                        expect(binarta.shop.basket.items()[0].quantity).toEqual(item.quantity);
                                    });

                                    describe('for different item', function () {
                                        beforeEach(function () {
                                            binarta.shop.gateway = new ValidOrderGateway();
                                            updatedItem = {id: item.id, price: item.price, quantity: 10};
                                            binarta.shop.basket.update({item: updatedItem});
                                        });

                                        it('then quantity is updated', function () {
                                            expect(binarta.shop.basket.items()[0].quantity).toEqual(10);
                                        });

                                        it('then updates are flushed', function () {
                                            expect(JSON.parse(localStorage.basket)).toEqual({
                                                items: [
                                                    {
                                                        id: 'sale-id',
                                                        quantity: 10,
                                                        couponCode: 'coupon-code',
                                                        price: 100
                                                    },
                                                    {id: 'sale-id-2', quantity: 1, configuration: {x: 'y'}, price: 100}
                                                ],
                                                quantity: 11,
                                                presentableItemTotal: '$99.99',
                                                presentablePrice: '$99.99',
                                                additionalCharges: 'additional-charges',
                                                coupon: 'coupon-code'
                                            });
                                        });
                                    });

                                    describe('with rejection callback', function () {
                                        beforeEach(function () {
                                            resetSpies([success, error]);
                                            binarta.shop.gateway = new InvalidOrderGateway();
                                            updatedItem = {id: item.id, price: item.price, quantity: 10};
                                            binarta.shop.basket.update({item: updatedItem, error: error});
                                        });

                                        it('then callback is executed', function () {
                                            expect(error.calls.argsFor(0)[0]).toEqual({
                                                quantity: ['invalid']
                                            });
                                        })
                                    });

                                });
                            });

                            it('increment item quantity', function () {
                                binarta.shop.basket.toOrder().items[0].incrementQuantity();
                                expect(binarta.shop.basket.toOrder().items[0].quantity).toEqual(3);
                            });

                            it('decrement item quantity', function () {
                                binarta.shop.basket.toOrder().items[0].decrementQuantity();
                                expect(binarta.shop.basket.toOrder().items[0].quantity).toEqual(1);
                            });

                            it('removing an item is flushed to local storage', function () {
                                binarta.shop.basket.toOrder().items[0].remove();
                                expect(JSON.parse(localStorage.basket)).toEqual({
                                    items: [
                                        {
                                            id: 'sale-id-2',
                                            quantity: 1,
                                            configuration: {x: 'y'},
                                            couponCode: 'coupon-code',
                                            price: 100
                                        }
                                    ],
                                    quantity: 1,
                                    presentableItemTotal: '$99.99',
                                    presentablePrice: '$99.99',
                                    additionalCharges: 'additional-charges',
                                    coupon: 'coupon-code'
                                });
                            });

                            describe('remove', function () {
                                beforeEach(function () {
                                    binarta.shop.gateway = new ValidOrderWithDeferredPreviewGateway();
                                    binarta.shop.basket.toOrder().items[0].remove();
                                });

                                it('basket refresh request is made', function () {
                                    expect(binarta.shop.gateway.previewOrderRequest).toEqual({
                                        items: [
                                            {
                                                id: 'sale-id-2',
                                                quantity: 1,
                                                configuration: {x: 'y'},
                                                couponCode: 'coupon-code'
                                            }]
                                    });
                                });

                                it('remove will not trigger on success listener before refresh completes', function () {
                                    expect(eventListener.itemRemoved).not.toHaveBeenCalled();
                                });

                                it('when refresh completes on success listeners are triggered', function () {
                                    binarta.shop.gateway.doPreviewOrders();
                                    expect(eventListener.itemRemoved).toHaveBeenCalled();
                                });
                            });

                            describe('and clearing the basket', function () {
                                beforeEach(function () {
                                    binarta.shop.basket.clear();
                                });

                                it('then contents reset', function () {
                                    expect(binarta.shop.basket.items()).toEqual([]);
                                    expect(binarta.shop.basket.subTotal()).toEqual(0);
                                });

                                it('then on cleared listener is triggered', function () {
                                    expect(eventListener.cleared).toHaveBeenCalled();
                                });
                            });
                        })
                    });

                    describe('on rejection', function () {
                        beforeEach(function () {
                            error.calls.reset();
                            binarta.shop.gateway = new InvalidOrderGateway();
                            item = {id: 'sale-id', price: 100, quantity: 2};
                            binarta.shop.basket.add({item: item, success: success, error: error});
                        });

                        it('the basket remains empty', function () {
                            expect(binarta.shop.basket.items()).toEqual([]);
                        });

                        it('error callback is executed', function () {
                            expect(error.calls.argsFor(0)[0]).toEqual({
                                quantity: ['invalid']
                            });
                        });

                        describe('for different item', function () {
                            beforeEach(function () {
                                binarta.shop.gateway = new ValidOrderGateway();
                                binarta.shop.basket.add({item: item, success: success, error: error});
                                error.calls.reset();
                            });

                            it('error callback is not called', function () {
                                expect(error.calls.count()).toEqual(0);
                            });

                            it('then the item is added to the item list', function () {
                                expect(binarta.shop.basket.items()).toEqual([item]);
                            });

                            it('calculate sub total', function () {
                                expect(binarta.shop.basket.subTotal()).toEqual(200);
                            });

                            it('success callback has been called', function () {
                                expect(success.calls.count() > 0).toEqual(true);
                            });
                        });
                    });
                });

                describe('when adding an item to the basket for 0 quantity', function () {
                    var item;

                    beforeEach(function () {
                        item = {id: 'sale-id', price: 100, quantity: 0};
                        binarta.shop.basket.add({item: item});
                    });

                    it('then the item is added to the item list', function () {
                        expect(binarta.shop.basket.items()).toEqual([]);
                    });
                });

                describe('when rendering removed items', function () {
                    beforeEach(function () {
                        binarta.shop.gateway = new ValidOrderGateway();
                        binarta.shop.basket.add({item: {id: 'item-1', quantity: 1}});
                        binarta.shop.gateway = new UnknownOrderGateway();
                        binarta.shop.basket.add({item: {id: 'item-2', quantity: 1}});
                        binarta.shop.basket.refresh();
                    });

                    it('then removed item is removed from basket and localstorage', function () {
                        expect(binarta.shop.basket.items()).toEqual([]);
                        expect(localStorage.basket).toEqual(JSON.stringify(binarta.shop.basket.toOrder()));
                    });
                });
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
                    binarta.shop.gateway = new PreviewOrderGateway();
                    binarta.shop.previewOrder('-', renderer);
                    expect(renderer).toHaveBeenCalledWith('previewed-order');
                });
            });

            describe('when validating an order', function () {
                var renderer;

                beforeEach(function () {
                    renderer = jasmine.createSpyObj('spy', ['rejected']);
                });

                it('then gateway receives a validate order request', function () {
                    binarta.shop.gateway = new GatewaySpy();
                    binarta.shop.validateOrder('order', renderer);
                    expect(binarta.shop.gateway.validateOrderRequest).toEqual('order');
                });

                it('then renderer receives violation report', function () {
                    binarta.shop.gateway = new InvalidOrderGateway();
                    binarta.shop.validateOrder({items: []}, renderer);
                    expect(renderer.rejected).toHaveBeenCalledWith({items: {}});
                });
            });

            describe('checkout', function () {
                var order, eventListener;

                beforeEach(function () {
                    order = {items: [{}]};
                    eventListener = jasmine.createSpyObj('event-listener', ['goto']);
                    binarta.shop.checkout.eventRegistry.add(eventListener);
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
                        'payment',
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

                describe('back navigation support', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.start(order, [
                            'authentication-required',
                            'address-selection',
                            'summary',
                            'setup-payment-provider',
                            'payment',
                            'completed'
                        ]);
                    });

                    describe('on first step', function () {
                        it('exposes there is no previous step', function () {
                            expect(binarta.shop.checkout.hasPreviousStep()).toBeFalsy();
                        });
                    });

                    describe('when the previous step is a transitionary step', function () {
                        beforeEach(function () {
                            binarta.shop.checkout.next();
                        });

                        it('then expose there is no previous step', function () {
                            expect(binarta.shop.checkout.hasPreviousStep()).toBeFalsy();
                        });
                    });

                    describe('when there is a previous step', function () {
                        beforeEach(function () {
                            binarta.shop.checkout.next();
                            binarta.shop.checkout.next();
                        });

                        it('then expose there is one', function () {
                            expect(binarta.shop.checkout.hasPreviousStep()).toBeTruthy();
                        });

                        it('then expose the step name', function () {
                            expect(binarta.shop.checkout.previousStep()).toEqual('address-selection');
                        });
                    });

                    describe('when there is a step prior to a transitional step', function () {
                        beforeEach(function () {
                            binarta.shop.checkout.next();
                            binarta.shop.checkout.next();
                            binarta.shop.checkout.next();
                            binarta.shop.checkout.next();
                        });

                        it('then expose there is one', function () {
                            expect(binarta.shop.checkout.hasPreviousStep()).toBeTruthy();
                        });

                        it('then expose the step name', function () {
                            expect(binarta.shop.checkout.previousStep()).toEqual('summary');
                        });
                    });

                    describe('when on the last step', function () {
                        beforeEach(function () {
                            binarta.shop.checkout.next();
                            binarta.shop.checkout.next();
                            binarta.shop.checkout.next();
                            binarta.shop.checkout.next();
                            binarta.shop.checkout.next();
                        });

                        it('then expose there is no previous step', function () {
                            expect(binarta.shop.checkout.hasPreviousStep()).toBeFalsy();
                        });
                    });
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

                    it('then the terms and conditions are implicitly accepted', function () {
                        expect(binarta.shop.checkout.context().order.termsAndConditions).toEqual('accepted');
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
                        binarta.shop.gateway = new InvalidCredentialsGateway();
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
                    binarta.shop.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.profile.refresh();

                    binarta.shop.checkout.start(order, [
                        'authentication-required',
                        'completed'
                    ]);

                    expect(binarta.shop.checkout.status()).toEqual('completed');
                });

                describe('on the address selection step', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.start(order, [
                            'address-selection',
                            'completed'
                        ])
                    });

                    it('then status exposes the current step', function () {
                        expect(binarta.shop.checkout.status()).toEqual('address-selection');
                    });

                    it('then restarting checkout has no effect', function () {
                        binarta.shop.checkout.start(order);
                        expect(binarta.shop.checkout.status()).toEqual('address-selection');
                    });

                    it('then you can cancel checkout', function () {
                        binarta.shop.checkout.cancel();
                        expect(binarta.shop.checkout.status()).toEqual('idle');
                    });

                    it('when selecting neither a billing or shipping address', function () {
                        expect(binarta.shop.checkout.selectAddresses).toThrowError('at.least.a.billing.address.must.be.selected');
                        expect(binarta.shop.checkout.status()).toEqual('address-selection');
                    });

                    describe('when selecting a billing address', function () {
                        beforeEach(function () {
                            binarta.shop.checkout.selectAddresses({billing: {label: 'l', addressee: 'a'}});
                        });

                        it('then billing address is added to the backing order', function () {
                            expect(binarta.shop.checkout.context().order.billing).toEqual({label: 'l', addressee: 'a'});
                        });

                        it('then shipping address is added to the backing order', function () {
                            expect(binarta.shop.checkout.context().order.shipping).toEqual({
                                label: 'l',
                                addressee: 'a'
                            });
                        });

                        it('then flow proceeds to the next step', function () {
                            expect(binarta.shop.checkout.status()).toEqual('completed');
                        });

                        it('then event listener is requested to go to the next step', function () {
                            expect(eventListener.goto).toHaveBeenCalledWith('completed');
                        });
                    });

                    describe('when selecting both a billing and shipping address', function () {
                        beforeEach(function () {
                            binarta.shop.checkout.selectAddresses({
                                billing: {label: 'b', addressee: 'a'},
                                shipping: {label: 's', addressee: 'a'}
                            });
                        });

                        it('then billing address is added to the backing order', function () {
                            expect(binarta.shop.checkout.context().order.billing).toEqual({label: 'b', addressee: 'a'});
                        });

                        it('then shipping address is added to the backing order', function () {
                            expect(binarta.shop.checkout.context().order.shipping).toEqual({
                                label: 's',
                                addressee: 'a'
                            });
                        });

                        it('then flow proceeds to the next step', function () {
                            expect(binarta.shop.checkout.status()).toEqual('completed');
                        });
                    })
                });

                describe('on the checkout summary step', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.start(order, [
                            'summary',
                            'completed'
                        ]);
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

                    it('then the selected payment provider defaults to wire-transfer', function () {
                        expect(binarta.shop.checkout.getPaymentProvider()).toEqual('wire-transfer');
                    });

                    describe('and setting the payment provider', function () {
                        beforeEach(function () {
                            binarta.shop.checkout.setPaymentProvider('payment-provider');
                        });

                        it('then the order exposes the selected payment provider', function () {
                            expect(binarta.shop.checkout.context().order.provider).toEqual('payment-provider');
                        });

                        it('then new checkouts default to the selected payment provider', function () {
                            binarta.shop.checkout.cancel();
                            binarta.shop.checkout.start(order, ['summary']);
                            expect(binarta.shop.checkout.getPaymentProvider()).toEqual('payment-provider');
                        });
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

                    it('on confirmation when the order is accepted and requires payment expose payment details on order', function () {
                        binarta.shop.gateway = new ValidOrderWithPaymentRequiredGateway();
                        binarta.shop.checkout.confirm();
                        expect(binarta.shop.checkout.context().order.id).toEqual('order-id');
                        expect(binarta.shop.checkout.context().order.approvalUrl).toEqual('approval-url');
                    });

                    it('on confirmation with coupon code', function () {
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.shop.checkout.setCouponCode('coupon-code');
                        binarta.shop.checkout.confirm();
                        expect(binarta.shop.gateway.submitOrderRequest.items[0].couponCode).toEqual('coupon-code');
                    });
                });

                it('on the checkout summary step then the payment provider can be specified at checkout start', function () {
                    order.provider = 'payment-provider';
                    binarta.shop.checkout.start(order, [
                        'summary',
                        'completed'
                    ]);
                    expect(binarta.shop.checkout.getPaymentProvider()).toEqual('payment-provider');
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

                    it('when order is accepted and requires payment expose payment details on order', function () {
                        binarta.shop.gateway = new ValidOrderWithPaymentRequiredGateway();
                        binarta.shop.checkout.retry();
                        expect(binarta.shop.checkout.context().order.id).toEqual('order-id');
                        expect(binarta.shop.checkout.context().order.approvalUrl).toEqual('approval-url');
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

                it('setup payment provider step proceeds to next step when order has already been submitted', function () {
                    binarta.shop.gateway = new ValidOrderGateway();
                    binarta.shop.checkout.start(order, [
                        'summary',
                        'setup-payment-provider',
                        'completed'
                    ]);

                    binarta.shop.checkout.confirm();

                    expect(binarta.shop.checkout.status()).toEqual('completed');
                });

                describe('on the payment step', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.start(order, [
                            'payment',
                            'completed'
                        ])
                    });

                    it('when confirming the payment then confirm payment request is sent', function () {
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.shop.checkout.confirm('confirmation-context');
                        expect(binarta.shop.gateway.confirmPaymentRequest).toEqual('confirmation-context');
                    });

                    it('when payment confirmation has not yet completed then optional on success listener is not yet triggered', function () {
                        var spy = jasmine.createSpy('spy');
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.shop.checkout.confirm('-', spy);
                        expect(spy).not.toHaveBeenCalled();
                    });

                    it('when payment confirmation succeeds then proceed to next step', function () {
                        binarta.shop.gateway = new ValidPaymentGateway();
                        binarta.shop.checkout.confirm('-');
                        expect(binarta.shop.checkout.status()).toEqual('completed');
                    });

                    it('when payment confirmation succeeds then trigger an optional on success listener', function () {
                        var spy = jasmine.createSpy('spy');
                        binarta.shop.gateway = new ValidPaymentGateway();
                        binarta.shop.checkout.confirm('-', spy);
                        expect(spy).toHaveBeenCalled();
                    });

                    it('when payment confirmation is rejected expose violation report', function () {
                        binarta.shop.gateway = new InvalidPaymentGateway();

                        binarta.shop.checkout.confirm('-');

                        expect(binarta.shop.checkout.status()).toEqual('payment');
                        expect(binarta.shop.checkout.violationReport()).toEqual('violation-report');
                    });

                    it('when canceling the payment then cancel order request is sent', function () {
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.shop.checkout.cancelPayment();
                        expect(binarta.shop.gateway.cancelOrderRequest).toEqual(order);
                    });

                    it('when cancel has not yet completed then optional on success listener is not yet triggered', function () {
                        var spy = jasmine.createSpy('spy');
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.shop.checkout.cancelPayment(spy);
                        expect(spy).not.toHaveBeenCalled();
                    });

                    describe('when cancel completes', function () {
                        beforeEach(function () {
                            var ctx = binarta.shop.checkout.context();
                            ctx.order.id = 'o';
                            binarta.shop.checkout.persist(ctx);
                            binarta.shop.gateway = new ValidOrderGateway();
                            binarta.shop.checkout.cancelPayment();
                        });

                        it('then return to summary step', function () {
                            expect(binarta.shop.checkout.status()).toEqual('summary');
                        });

                        it('then remove id from order so ti can be resubmitted', function () {
                            expect(binarta.shop.checkout.context().order.id).toBeUndefined();
                        });
                    });

                    it('when cancel completes then trigger an optional on success listener', function () {
                        var spy = jasmine.createSpy('spy');
                        binarta.shop.gateway = new ValidOrderGateway();
                        binarta.shop.checkout.cancelPayment(spy);
                        expect(spy).toHaveBeenCalled();
                    });

                    it('when cancel is rejected expose violation report', function () {
                        binarta.shop.gateway = new InvalidOrderGateway();

                        binarta.shop.checkout.cancelPayment();

                        expect(binarta.shop.checkout.status()).toEqual('payment');
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

                it('basket can optionally be cleared when checkout reaches completed step', function () {
                    binarta.shop.gateway = new ValidOrderGateway();
                    binarta.shop.basket.add({item: {id: 'i', quantity: 1}});

                    binarta.shop.checkout.start({clearBasketOnComplete: true}, [
                        'completed'
                    ]);

                    expect(binarta.shop.basket.toOrder().quantity).toEqual(0);
                });

                it('basket can optionally be cleared when checkout reaches payment step and wire transfer is selected', function () {
                    binarta.shop.gateway = new ValidOrderGateway();
                    binarta.shop.basket.add({item: {id: 'i', quantity: 1}});

                    binarta.shop.checkout.start({clearBasketOnComplete: true, provider: 'wire-transfer'}, [
                        'payment'
                    ]);

                    expect(binarta.shop.basket.toOrder().quantity).toEqual(0);
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

                    it('then the custom step is included in the roadmap', function () {
                        expect(binarta.shop.checkout.roadmap()).toEqual([
                            {name: 'custom-step', locked: false, unlocked: true}
                        ]);
                    });
                });

                it('custom steps can be gateway steps and left out of the roadmap', function () {
                    binarta.shop.checkout.installCustomStepDefinition('custom-step', CustomStep, {isGatewayStep: true});
                    binarta.shop.checkout.start(order, [
                        'custom-step'
                    ]);
                    expect(binarta.shop.checkout.roadmap()).toEqual([]);
                });

                function CustomStep(fsm) {
                    fsm.currentState = this;
                    this.name = 'custom-step';
                }

                describe('jumping to a specific step', function () {
                    beforeEach(function () {
                        binarta.shop.checkout.start(order, [
                            'payment',
                            'completed'
                        ]);
                    });

                    it('you can jump to a specific step directly', function () {
                        binarta.shop.checkout.jumpTo('completed');
                        expect(binarta.shop.checkout.status()).toEqual('completed');
                    });

                    it('jumping to a specific step updates the internal current step so the next step can be calculated correctly', function () {
                        binarta.shop.checkout.jumpTo('completed');
                        expect(binarta.shop.checkout.context().currentStep).toEqual('completed');
                    });
                });
            });

            describe('profile extensions', function () {
                var eventListener;

                beforeEach(function () {
                    eventListener = jasmine.createSpyObj('event-listener', ['signedin', 'signedout', 'updated']);
                    binarta.checkpoint.profile.eventRegistry.add(eventListener);
                });

                describe('profile refresh takes an optional event handler for the current request', function () {
                    it('with optional success handler', function () {
                        var spy = jasmine.createSpyObj('spy', ['success']);
                        binarta.checkpoint.gateway = new AuthenticatedGateway();
                        binarta.shop.gateway = new AuthenticatedGateway();
                        binarta.checkpoint.profile.refresh(spy);
                        expect(spy.success).toHaveBeenCalled();
                    });

                    it('with optional unauthenticated handler', function () {
                        var spy = jasmine.createSpyObj('spy', ['unauthenticated']);
                        binarta.checkpoint.gateway = new UnauthenticatedGateway();
                        binarta.shop.gateway = new UnauthenticatedGateway();
                        binarta.checkpoint.profile.refresh(spy);
                        expect(spy.unauthenticated).toHaveBeenCalled();
                    });
                });

                it('addresses are initially empty', function () {
                    expect(binarta.checkpoint.profile.addresses()).toEqual([]);
                });

                describe('existing addresses are loaded on refresh', function () {
                    beforeEach(function () {
                        binarta.checkpoint.gateway = new AuthenticatedGateway();
                        binarta.shop.gateway = new AuthenticatedGateway();
                        binarta.checkpoint.profile.refresh();
                    });

                    it('and exposed', function () {
                        expect(binarta.checkpoint.profile.addresses().map(function (it) {
                            return it.label;
                        })).toEqual(['home', 'work']);
                    });

                    it('an address sits in idle status', function () {
                        expect(binarta.checkpoint.profile.addresses()[0].status()).toEqual('idle');
                    });

                    describe('editing an address', function () {
                        var address;

                        beforeEach(function () {
                            address = binarta.checkpoint.profile.addresses()[0];
                            address.edit();
                        });

                        it('exposes status as editing', function () {
                            expect(address.status()).toEqual('editing');
                        });

                        it('exposes an update request', function () {
                            expect(address.updateRequest()).toEqual({
                                id: {label: 'home'},
                                label: 'home',
                                addressee: 'John Doe',
                                street: 'Johny Lane',
                                number: '1',
                                zip: '1000',
                                city: 'Johnyville',
                                country: 'BE'
                            });
                        });

                        it('changes to the update request do not affect the actual address yet', function () {
                            address.updateRequest().addressee = 'x';
                            expect(address.addressee).toEqual('John Doe');
                        });

                        it('canceling returns to idle status', function () {
                            address.cancel();
                            expect(address.status()).toEqual('idle');
                        });

                        it('then update delegates to gateway', function () {
                            binarta.shop.gateway = new GatewaySpy();
                            address.updateRequest().addressee = 'Jane Smith';
                            address.update();
                            expect(binarta.shop.gateway.updateAddressRequest).toEqual({
                                id: {label: 'home'},
                                label: 'home',
                                addressee: 'Jane Smith',
                                street: 'Johny Lane',
                                number: '1',
                                zip: '1000',
                                city: 'Johnyville',
                                country: 'BE'
                            });
                        });

                        it('then update can be rejected', function () {
                            binarta.shop.gateway = new InvalidBillingProfileGateway();
                            address.update();
                            expect(address.status()).toEqual('editing');
                            expect(address.violationReport()).toEqual('violation-report');
                        });

                        it('then update affects current profile', function () {
                            binarta.shop.gateway = new ValidBillingProfileGateway();
                            address.updateRequest().addressee = 'x';
                            address.update();
                            expect(address.status()).toEqual('idle');
                            expect(address.addressee).toEqual('x');
                        });

                        it('when update succeeds trigger on success listener', function () {
                            binarta.shop.gateway = new ValidBillingProfileGateway();
                            var onSuccessListener = jasmine.createSpy('on-success');

                            address.update(onSuccessListener);

                            expect(onSuccessListener).toHaveBeenCalled();
                        });

                        it('then label can be modified', function () {
                            binarta.shop.gateway = new GatewaySpy();
                            address.updateRequest().label = 'work';

                            address.update();

                            expect(binarta.shop.gateway.updateAddressRequest.label).toEqual('work');
                            expect(binarta.shop.gateway.updateAddressRequest.id.label).toEqual('home');
                        });

                        it('then label can be regenerated', function () {
                            binarta.shop.gateway = new GatewaySpy();
                            address.updateRequest().generateLabel = true;
                            address.updateRequest().street = 'Johny Boulevard';
                            address.updateRequest().number = '2';
                            address.updateRequest().zip = '2000';

                            address.update();

                            expect(binarta.shop.gateway.updateAddressRequest.label).toEqual('(2000) Johny Boulevard 2');
                        });
                    });
                });

                describe('when putting the profile in edit mode', function () {
                    beforeEach(function () {
                        binarta.checkpoint.gateway = new CompleteBillingProfileGateway();
                        binarta.shop.gateway = new CompleteBillingProfileGateway();
                        binarta.checkpoint.profile.refresh();
                        binarta.checkpoint.profile.edit();
                    });

                    it('then the profile exposes an update request', function () {
                        expect(binarta.checkpoint.profile.updateRequest()).toEqual({vat: 'BE1234567890', address: {}});
                    });

                    it('then modifying the update profile request does not affect the current profile', function () {
                        binarta.checkpoint.profile.updateRequest().vat = 'BE0987654321';
                        expect(binarta.checkpoint.profile.updateRequest().vat).toEqual('BE0987654321');
                        expect(binarta.checkpoint.profile.billing.vatNumber()).toEqual('BE1234567890');
                    });

                    it('then update vat delegates to gateway', function () {
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.checkpoint.profile.updateRequest().vat = 'BE0987654321';
                        binarta.checkpoint.profile.update();
                        expect(binarta.shop.gateway.updateBillingProfileRequest).toEqual({vat: 'BE0987654321'});
                    });

                    it('then update vat affects current profile', function () {
                        binarta.shop.gateway = new ValidBillingProfileGateway();
                        binarta.checkpoint.profile.updateRequest().vat = 'BE0987654321';
                        binarta.checkpoint.profile.update();
                        expect(binarta.checkpoint.profile.status()).toEqual('idle');
                        expect(binarta.checkpoint.profile.billing.vatNumber()).toEqual('BE0987654321');
                    });

                    it('then update vat can clear the vat number', function () {
                        binarta.shop.gateway = new ValidBillingProfileGateway();
                        binarta.checkpoint.profile.updateRequest().vat = '';
                        binarta.checkpoint.profile.update();
                        expect(binarta.checkpoint.profile.status()).toEqual('idle');
                        expect(binarta.checkpoint.profile.billing.vatNumber()).toEqual('');
                    });

                    it('then update vat triggers event listener', function () {
                        binarta.shop.gateway = new ValidBillingProfileGateway();
                        binarta.checkpoint.profile.updateRequest().vat = 'BE0987654321';
                        binarta.checkpoint.profile.update();
                        expect(eventListener.updated).toHaveBeenCalled();
                    });

                    it('then update to add a new address does not delegate to gateway when address is empty', function () {
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.checkpoint.profile.update();
                        expect(binarta.shop.gateway.addAddressRequest).toBeUndefined();
                    });

                    it('then update to add a new address delegates to the gateway', function () {
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.checkpoint.profile.updateRequest().address.label = 'home';
                        binarta.checkpoint.profile.updateRequest().address.addressee = 'John Doe';
                        binarta.checkpoint.profile.updateRequest().address.street = 'Johny Lane';
                        binarta.checkpoint.profile.updateRequest().address.number = '1';
                        binarta.checkpoint.profile.updateRequest().address.zip = '1000';
                        binarta.checkpoint.profile.updateRequest().address.city = 'Johnyville';
                        binarta.checkpoint.profile.updateRequest().address.country = 'BE';

                        binarta.checkpoint.profile.update();

                        expect(binarta.shop.gateway.addAddressRequest).toEqual({
                            label: 'home',
                            addressee: 'John Doe',
                            street: 'Johny Lane',
                            number: '1',
                            zip: '1000',
                            city: 'Johnyville',
                            country: 'BE'
                        });
                    });

                    it('then address label is optional when adding a new address', function () {
                        binarta.shop.gateway = new GatewaySpy();
                        binarta.checkpoint.profile.updateRequest().address.addressee = 'John Doe';
                        binarta.checkpoint.profile.updateRequest().address.street = 'Johny Lane';
                        binarta.checkpoint.profile.updateRequest().address.number = '1';
                        binarta.checkpoint.profile.updateRequest().address.zip = '1000';
                        binarta.checkpoint.profile.updateRequest().address.city = 'Johnyville';
                        binarta.checkpoint.profile.updateRequest().address.country = 'BE';

                        binarta.checkpoint.profile.update();

                        expect(binarta.shop.gateway.addAddressRequest.label).toEqual('(1000) Johny Lane 1');
                    });

                    ['street', 'number', 'zip'].forEach(function (field) {
                        it('when ' + field + ' is undefined a label can not be generated', function () {
                            binarta.shop.gateway = new GatewaySpy();
                            binarta.checkpoint.profile.updateRequest().address.street = 'Johny Lane';
                            binarta.checkpoint.profile.updateRequest().address.number = '1';
                            binarta.checkpoint.profile.updateRequest().address.zip = '1000';

                            binarta.checkpoint.profile.updateRequest().address[field] = undefined;
                            binarta.checkpoint.profile.update();

                            expect(binarta.shop.gateway.addAddressRequest.label).toBeUndefined();
                        });
                    });

                    it('then update to add a new address is rejected', function () {
                        binarta.shop.gateway = new InvalidBillingProfileGateway();
                        binarta.checkpoint.profile.updateRequest().address.label = 'home';
                        binarta.checkpoint.profile.update();
                        expect(binarta.checkpoint.profile.violationReport()).toEqual({address: 'violation-report'});
                        expect(binarta.checkpoint.profile.updateRequest().address.label).toEqual('home');
                    });

                    it('then update to add a new address is accepted', function () {
                        binarta.shop.gateway = new ValidBillingProfileGateway();
                        binarta.checkpoint.profile.updateRequest().address.label = 'home';

                        binarta.checkpoint.profile.update();

                        expect(binarta.checkpoint.profile.status()).toEqual('idle');
                        expect(binarta.checkpoint.profile.addresses()[0].label).toEqual('home');
                    });
                });

                describe('billing profile', function () {
                    it('no vat number is initially exposed', function () {
                        expect(binarta.checkpoint.profile.billing.vatNumber()).toBeUndefined();
                    });

                    it('an authenticated user may still not have a vat number specified', function () {
                        binarta.checkpoint.gateway = new InCompleteBillingProfileGateway();
                        binarta.shop.gateway = new InCompleteBillingProfileGateway();
                        binarta.checkpoint.profile.refresh();
                        expect(binarta.checkpoint.profile.billing.vatNumber()).toBeUndefined();
                    });

                    it('an authenticated user may have a vat number specified', function () {
                        binarta.checkpoint.gateway = new CompleteBillingProfileGateway();
                        binarta.shop.gateway = new CompleteBillingProfileGateway();
                        binarta.checkpoint.profile.refresh();
                        expect(binarta.checkpoint.profile.billing.vatNumber()).toEqual('BE1234567890');
                    });

                    it('agreement start out incomplete', function () {
                        expect(binarta.checkpoint.profile.billing.isComplete()).toBeFalsy();
                    });

                    it('profile refresh loads incomplete billing agreement', function () {
                        binarta.checkpoint.gateway = new InCompleteBillingProfileGateway();
                        binarta.shop.gateway = new InCompleteBillingProfileGateway();
                        binarta.checkpoint.profile.refresh();
                        expect(binarta.checkpoint.profile.billing.isComplete()).toBeFalsy();
                    });

                    it('profile refresh loads complete billing agreement', function () {
                        binarta.checkpoint.gateway = new CompleteBillingProfileGateway();
                        binarta.shop.gateway = new CompleteBillingProfileGateway();
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
                        binarta.shop.gateway = new CompleteBillingProfileGateway();
                        binarta.checkpoint.profile.billing.confirm({});
                        expect(ui.confirmedBillingAgreementRequest).toBeTruthy();
                    });

                    it('when confirm billing agreement completes then billing details report as completed', function () {
                        binarta.shop.gateway = new CompleteBillingProfileGateway();
                        binarta.checkpoint.profile.billing.confirm({});
                        expect(binarta.checkpoint.profile.billing.isComplete()).toBeTruthy();
                    });
                });

                it('profile exposes a list of supported countries', function () {
                    expect(binarta.checkpoint.profile.supportedCountries()).toEqual([{
                        country: 'Albania',
                        code: 'AL'
                    }, {country: 'Algeria', code: 'DZ'}, {country: 'Argentina', code: 'AR'}, {
                        country: 'Australia',
                        code: 'AU'
                    }, {country: 'Austria', code: 'AT'}, {country: 'Bahrain', code: 'BH'}, {
                        country: 'Belarus',
                        code: 'BY'
                    }, {country: 'Belgium', code: 'BE'}, {
                        country: 'Bolivia',
                        code: 'BO'
                    }, {country: 'Bosnia and Herzegovina', code: 'BA'}, {
                        country: 'Brazil',
                        code: 'BR'
                    }, {country: 'Bulgaria', code: 'BG'}, {country: 'Canada', code: 'CA'}, {
                        country: 'Chile',
                        code: 'CL'
                    }, {country: 'China', code: 'CN'}, {country: 'Colombia', code: 'CO'}, {
                        country: 'Costa Rica',
                        code: 'CR'
                    }, {country: 'Croatia', code: 'HR'}, {country: 'Cuba', code: 'CU'}, {
                        country: 'Cyprus',
                        code: 'CY'
                    }, {country: 'Czech Republic', code: 'CZ'}, {
                        country: 'Denmark',
                        code: 'DK'
                    }, {country: 'Dominican Republic', code: 'DO'}, {country: 'Ecuador', code: 'EC'}, {
                        country: 'Egypt',
                        code: 'EG'
                    }, {country: 'El Salvador', code: 'SV'}, {country: 'Estonia', code: 'EE'}, {
                        country: 'Finland',
                        code: 'FI'
                    }, {country: 'France', code: 'FR'}, {country: 'Germany', code: 'DE'}, {
                        country: 'Greece',
                        code: 'GR'
                    }, {country: 'Guatemala', code: 'GT'}, {country: 'Honduras', code: 'HN'}, {
                        country: 'Hong Kong',
                        code: 'HK'
                    }, {country: 'Hungary', code: 'HU'}, {country: 'Iceland', code: 'IS'}, {
                        country: 'India',
                        code: 'IN'
                    }, {country: 'Indonesia', code: 'ID'}, {country: 'Iraq', code: 'IQ'}, {
                        country: 'Ireland',
                        code: 'IE'
                    }, {country: 'Israel', code: 'IL'}, {country: 'Italy', code: 'IT'}, {
                        country: 'Japan',
                        code: 'JP'
                    }, {country: 'Jordan', code: 'JO'}, {country: 'Kuwait', code: 'KW'}, {
                        country: 'Latvia',
                        code: 'LV'
                    }, {country: 'Lebanon', code: 'LB'}, {country: 'Libya', code: 'LY'}, {
                        country: 'Lithuania',
                        code: 'LT'
                    }, {country: 'Luxembourg', code: 'LU'}, {country: 'Macedonia', code: 'MK'}, {
                        country: 'Malaysia',
                        code: 'MY'
                    }, {country: 'Malta', code: 'MT'}, {country: 'Mexico', code: 'MX'}, {
                        country: 'Montenegro',
                        code: 'ME'
                    }, {country: 'Morocco', code: 'MA'}, {country: 'Netherlands', code: 'NL'}, {
                        country: 'New Zealand',
                        code: 'NZ'
                    }, {country: 'Nicaragua', code: 'NI'}, {country: 'Norway', code: 'NO'}, {
                        country: 'Oman',
                        code: 'OM'
                    }, {country: 'Panama', code: 'PA'}, {country: 'Paraguay', code: 'PY'}, {
                        country: 'Peru',
                        code: 'PE'
                    }, {country: 'Philippines', code: 'PH'}, {country: 'Poland', code: 'PL'}, {
                        country: 'Portugal',
                        code: 'PT'
                    }, {country: 'Puerto Rico', code: 'PR'}, {country: 'Qatar', code: 'QA'}, {
                        country: 'Romania',
                        code: 'RO'
                    }, {country: 'Russia', code: 'RU'}, {country: 'Saudi Arabia', code: 'SA'}, {
                        country: 'Serbia',
                        code: 'RS'
                    }, {country: 'Serbia and Montenegro', code: 'CS'}, {
                        country: 'Singapore',
                        code: 'SG'
                    }, {country: 'Slovakia', code: 'SK'}, {country: 'Slovenia', code: 'SI'}, {
                        country: 'South Africa',
                        code: 'ZA'
                    }, {country: 'South Korea', code: 'KR'}, {country: 'Spain', code: 'ES'}, {
                        country: 'Sudan',
                        code: 'SD'
                    }, {country: 'Sweden', code: 'SE'}, {country: 'Switzerland', code: 'CH'}, {
                        country: 'Syria',
                        code: 'SY'
                    }, {country: 'Taiwan', code: 'TW'}, {country: 'Thailand', code: 'TH'}, {
                        country: 'Tunisia',
                        code: 'TN'
                    }, {country: 'Turkey', code: 'TR'}, {
                        country: 'Ukraine',
                        code: 'UA'
                    }, {country: 'United Arab Emirates', code: 'AE'}, {
                        country: 'United Kingdom',
                        code: 'GB'
                    }, {country: 'United States', code: 'US'}, {country: 'Uruguay', code: 'UY'}, {
                        country: 'Venezuela',
                        code: 'VE'
                    }, {country: 'Vietnam', code: 'VN'}, {country: 'Yemen', code: 'YE'}]);
                });
            });

            describe('coupon dictionary', function () {
                var spy;

                beforeEach(function () {
                    spy = jasmine.createSpyObj('spy', ['notFound', 'ok']);
                });

                it('find by id performs lookup', function () {
                    binarta.shop.gateway = new GatewaySpy();
                    binarta.shop.couponDictionary.findById('x');
                    expect(binarta.shop.gateway.findCouponByIdRequest).toEqual({id: 'x'});
                });

                it('find by unknown id presents not found', function () {
                    binarta.shop.gateway = new InvalidOrderGateway();
                    binarta.shop.couponDictionary.findById('-', spy);
                    expect(spy.notFound).toHaveBeenCalled();
                });

                it('find by known id presents coupon details', function () {
                    binarta.shop.gateway = new ValidOrderGateway();
                    binarta.shop.couponDictionary.findById('-', spy);
                    expect(spy.ok).toHaveBeenCalledWith('coupon');
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
})();