function BinartaShopjs(checkpoint) {
    var shop = this;

    checkpoint.profile.billing = new Billing(checkpoint.profile);
    checkpoint.profile.refresh = checkpoint.profile.billing.refresh(checkpoint.profile.refresh);
    this.basket = new Basket();
    this.checkout = new Checkout();

    this.previewOrder = function (order, render) {
        shop.gateway.previewOrder(order, {success: render});
    };

    this.validateOrder = function (order, response) {
        shop.gateway.validateOrder(order, response);
    };

    function Basket() {
        var self = this;
        var order;

        this.eventRegistry = new BinartaRX();

        function isUninitialized() {
            return !localStorage.basket;
        }

        function initialize() {
            order = {
                items: []
            };
            recalculateOrderQuantity();
            flush();
        }

        function flush() {
            localStorage.basket = JSON.stringify(order);
        }

        function rehydrate() {
            order = JSON.parse(localStorage.basket);
        }

        function contains(it) {
            return order.items.reduce(function (p, c) {
                return p || c.id == it.id;
            }, false)
        }

        function findItemById(id) {
            return order.items.reduce(function (p, c) {
                return p || (c.id == id ? c : null)
            }, null)
        }

        function increment(it) {
            findItemById(it.id).quantity += it.quantity;
            recalculateOrderQuantity();
        }

        function recalculateOrderQuantity() {
            order.quantity = order.items.map(function (it) {
                return it.quantity;
            }).reduce(function (p, c) {
                return p + c;
            }, 0);
        }

        function decrement(it) {
            findItemById(it.id).quantity -= it.quantity;
        }

        function append(it) {
            var item = {id: it.id, price: it.price, quantity: it.quantity};
            if (it.configuration) item.configuration = it.configuration;
            order.items.push(item);
        }

        function isQuantified(it) {
            return it.quantity > 0;
        }

        function removeItem(toRemove) {
            var idx = order.items.reduce(function (p, c, i) {
                return c.id == toRemove.id ? i : p;
            }, -1);
            order.items.splice(idx, 1);
        }

        if (isUninitialized()) initialize();
        rehydrate();

        function onError(violationReport, order, cb, success) {
            if (violationInReportFor(violationReport, order.item.id)) {
                cb();
                if (order.error)
                    order.error(violationInReportFor(violationReport, order.item.id));
            } else success();
        }

        function violationInReportFor(report, id) {
            return report.items[id];
        }

        function validate(success, rejected) {
            shop.validateOrder({items: order.items}, {
                success: success,
                rejected: rejected
            });
        }

        function onSuccess(it) {
            flush();
            if (it.success) it.success();
        }

        this.refresh = function (success) {
            var couponCode = this.couponCode();
            shop.previewOrder({
                items: self.items().map(function (it) {
                    var item = {id: it.id, quantity: it.quantity};
                    if (it.configuration) item.configuration = it.configuration;
                    if (couponCode) {
                        item.couponCode = couponCode;
                        couponCode = undefined;
                    }
                    return item
                })
            }, function (payload) {
                order.items = payload.items;
                order.presentableItemTotal = payload.presentableItemTotal;
                order.additionalCharges = payload.additionalCharges;
                order.presentablePrice = payload.presentablePrice;
                recalculateOrderQuantity();
                flush();
                if (success) success();
            });
        };

        this.toOrder = function () {
            return toRichOrder(JSON.parse(JSON.stringify(order)));
        };

        function toRichOrder(order) {
            order.items = order.items.map(function (it) {
                it.incrementQuantity = function () {
                    self.update({item: {id: it.id, quantity: it.quantity + 1}});
                };
                it.decrementQuantity = function () {
                    self.update({item: {id: it.id, quantity: it.quantity - 1}});
                };
                it.update = function () {
                    self.update({item: {id: it.id, quantity: it.quantity}});
                };
                it.remove = function () {
                    self.remove(it);
                };
                return it;
            });
            return order;
        }

        this.restore = function () {
            rehydrate();
            self.refresh();
        };

        this.add = function (it) {
            var success = function () {
                self.refresh(function () {
                    onSuccess(it);
                    self.eventRegistry.forEach(function (l) {
                        l.itemAdded();
                    });
                });
            };

            var error = function (violationReport) {
                onError(violationReport, it, revertAdd, success);
            };

            if (isQuantified(it.item)) {
                contains(it.item) ? increment(it.item) : append(it.item);
                validate(success, error);
            }

            function revertAdd() {
                var item = findItemById(it.item.id);
                if (item && item.quantity - it.item.quantity > 0) decrement(it.item);
                else removeItem(it.item);
            }
        };

        this.update = function (it) {
            var success = function () {
                self.refresh(function () {
                    onSuccess(it);
                    self.eventRegistry.forEach(function (l) {
                        l.itemUpdated();
                    });
                });
            };
            var error = function (violationReport) {
                onError(violationReport, it, rehydrate, success);
            };
            if (isQuantified(it.item)) {
                findItemById(it.item.id).quantity = it.item.quantity + 0;
                validate(success, error);
            }
        };

        this.remove = function (toRemove, onSuccess) {
            removeItem(toRemove);
            self.refresh(function () {
                if (onSuccess) onSuccess();
                self.eventRegistry.forEach(function (l) {
                    l.itemRemoved();
                });
            });
        };

        this.items = function () {
            return order.items;
        };

        this.subTotal = function () {
            var calculate = function () {
                return order.items.reduce(function (sum, it) {
                    return sum + (it.price * it.quantity)
                }, 0);
            };
            return order.items ? calculate() : 0;
        };

        this.presentableSubTotal = function () {
            return order.presentableItemTotal;
        };

        this.clear = function () {
            initialize();
        };

        this.couponCode = function (code) {
            if (code) {
                order.coupon = code;
                flush();
            }
            return order.coupon;
        }
    }

    function Checkout() {
        var self = this;

        var stepDefinitions = {
            'authentication-required': AuthRequiredStep,
            'summary': SummaryStep,
            'setup-payment-provider': SetupPaymentProviderStep,
            'completed': CompletedStep
        };
        var gatewaySteps = [
            'authentication-required',
            'setup-payment-provider'
        ];

        this.installCustomStepDefinition = function (id, definition, metadata) {
            stepDefinitions[id] = definition;
            if (metadata == undefined)
                metadata = {};
            if (metadata.isGatewayStep)
                gatewaySteps.push(id);
        };

        this.status = function () {
            return self.currentState.name;
        };

        this.start = function (order, roadmap) {
            if (self.status() == 'idle' || self.status() == 'completed') {
                self.persist({roadmap: roadmap, currentStep: 'idle', unlockedSteps: [roadmap[0]], order: order});
                self.next();
            }
        };

        this.persist = function (ctx) {
            sessionStorage.setItem('binartaJSCheckout', JSON.stringify(ctx));
        };

        this.context = function () {
            return JSON.parse(sessionStorage.getItem('binartaJSCheckout')) || {};
        };

        this.roadmap = function () {
            var ctx = self.context();
            return ctx.roadmap.filter(function (it) {
                return gatewaySteps.every(function (gatewayStep) {
                    return it != gatewayStep;
                });
            }).map(function (it) {
                var unlocked = ctx.unlockedSteps.some(function (step) {
                    return step == it;
                });
                return {
                    name: it,
                    locked: !unlocked,
                    unlocked: unlocked
                }
            });
        };

        function clear() {
            sessionStorage.setItem('binartaJSCheckout', '{}');
        }

        this.jumpTo = function (id) {
            new stepDefinitions[id](self);
        };

        this.isNextStep = function (it) {
            var ctx = self.context();
            return ctx.roadmap[toNextStepIndex(ctx)] == it
        };

        function toNextStepIndex(ctx) {
            return ctx.roadmap.lastIndexOf(ctx.currentStep) + 1;
        }

        this.next = function () {
            var ctx = self.context();
            ctx.currentStep = ctx.roadmap[toNextStepIndex(ctx)];
            ctx.unlockedSteps.push(ctx.currentStep);
            self.persist(ctx);
            return new (stepDefinitions[ctx.currentStep])(self);
        };

        this.cancel = function () {
            clear();
            new IdleState(self);
        };

        this.signin = function (credentials) {
            if (!self.currentState.signin)
                throw new Error('signin.not.supported.when.checkout.in.idle.state');
            else
                self.currentState.signin(credentials);
        };

        function IdleState(fsm) {
            fsm.currentState = this;
            this.name = 'idle';
        }

        function AuthRequiredStep(fsm) {
            fsm.currentState = this;
            this.name = 'authentication-required';

            fsm.retry = function () {
                if (shop.binarta.checkpoint.profile.isAuthenticated())
                    fsm.next();
            };
            fsm.retry();
        }

        function SummaryStep(fsm) {
            fsm.currentState = this;
            this.name = 'summary';
            var violationReportCache = {};

            fsm.confirm = function (onSuccessListener) {
                shop.gateway.submitOrder(fsm.context().order, {
                    success: onSuccess(onSuccessListener),
                    rejected: proceedWhenPaymentProviderRequiresSetupOtherwise(next(onSuccessListener), cacheViolationReport)
                });
            };

            function onSuccess(listener) {
                return function () {
                    var ctx = self.context();
                    ctx.orderSubmitted = true;
                    self.persist(ctx);
                    next(listener)();
                }
            }

            function next(listener) {
                return function () {
                    fsm.next();
                    if (listener)
                        listener();
                }
            }

            function proceedWhenPaymentProviderRequiresSetupOtherwise(next, fallback) {
                return function (report) {
                    if (report && typeof(report) == 'object' && Object.keys(report).length == 1 && report.provider && report.provider[0] == 'setup' && fsm.isNextStep('setup-payment-provider')) {
                        next();
                    } else {
                        fallback(report);
                    }
                }
            }

            function cacheViolationReport(report) {
                violationReportCache = report;
            }

            fsm.violationReport = function () {
                return violationReportCache;
            }
        }

        function SetupPaymentProviderStep(fsm) {
            fsm.currentState = this;
            this.name = 'setup-payment-provider';
            var violationReportCache = {};

            if (fsm.context().orderSubmitted)
                fsm.next();

            fsm.retry = function (onSuccessListener) {
                shop.gateway.submitOrder(fsm.context().order, {
                    success: onSuccess(onSuccessListener),
                    rejected: cacheViolationReport
                });
            };

            function onSuccess(listener) {
                return function () {
                    fsm.next();
                    listener();
                }
            }

            function cacheViolationReport(report) {
                violationReportCache = report;
            }

            fsm.violationReport = function () {
                return violationReportCache;
            }
        }

        function CompletedStep(fsm) {
            fsm.currentState = this;
            this.name = 'completed';
        }

        new IdleState(self);
    }

    function Billing(profile) {
        var self = this;
        var profileCache = {};
        var addressesCache = [];

        profile.updateProfileRequestDecorators.push(function (request) {
            request.vat = self.vatNumber();
            request.address = {};
            return request;
        });
        profile.updateProfileHandlers.push(function (request, response) {
            updateBillingProfile(request, response, self.vatNumber());
            addAddress(request, response);
        });
        profile.addresses = function () {
            return addressesCache;
        };

        this.refresh = function (upstreamRefresh) {
            return function (response) {
                upstreamRefresh(response);
                fetchBillingProfile();
                fetchAddresses();
            }
        };

        this.vatNumber = function () {
            return profileCache.vat;
        };

        this.isComplete = function () {
            return billingDetails().complete;
        };

        this.initiate = function (id) {
            shop.ui.initiatingBillingAgreement();
            sessionStorage.billingAgreementProvider = id;
            shop.gateway.initiateBillingAgreement(id, shop.ui);
        };

        this.cancel = function () {
            shop.ui.canceledBillingAgreement();
        };

        this.confirm = function (ctx) {
            shop.gateway.confirmBillingAgreement(
                {
                    paymentProvider: sessionStorage.billingAgreementProvider,
                    confirmationToken: ctx.confirmationToken
                },
                new BinartaMergingUI(
                    shop.ui,
                    {confirmedBillingAgreement: confirmed}
                )
            );
        };

        function confirmed() {
            if (profile.metadataCache) {
                if (profile.metadataCache.billing)
                    profile.metadataCache.billing.complete = true;
                else
                    profile.metadataCache.billing = {complete: true}
            } else
                profile.metadataCache = {billing: {complete: true}}
        }

        function metadata() {
            return profile.metadataCache || {};
        }

        function billingDetails() {
            return metadata().billing || {};
        }

        function fetchBillingProfile() {
            shop.gateway.fetchBillingProfile({
                unauthenticated: function () {
                    profileCache = {};
                },
                success: function (it) {
                    profileCache = it;
                }
            });
        }

        function fetchAddresses() {
            shop.gateway.fetchAddresses({
                unauthenticated: function () {
                    addressesCache = [];
                },
                success: function (addresses) {
                    addressesCache = addresses.map(function (it) {
                        return new Address(it);
                    });
                }
            });
        }

        function updateBillingProfile(request, response, existingVatNumber) {
            if (request.vat && request.vat != existingVatNumber)
                shop.gateway.updateBillingProfile({vat: request.vat}, {
                    success: function () {
                        profileCache.vat = request.vat;
                        response.success();
                    }
                });
        }

        function addAddress(request, response) {
            if (request.address && Object.keys(request.address).length > 0)
                shop.gateway.addAddress(request.address, {
                    success: function () {
                        addressesCache.push(new Address(request.address));
                        response.success();
                    },
                    rejected: function (report) {
                        response.rejected({address: report});
                    }
                });
        }

        function Address(data) {
            var self = this;
            var emptyViolationReport = {};

            function hydrate(it) {
                Object.keys(it).forEach(function (k) {
                    self[k] = it[k];
                });
            }

            hydrate(data);

            this.status = function () {
                return self.currentStatus.status;
            };

            this.violationReport = function () {
                return self.currentStatus.violationReport || emptyViolationReport;
            };

            function IdleState(fsm) {
                fsm.currentStatus = this;
                this.status = 'idle';

                fsm.edit = function () {
                    new EditState(fsm);
                }
            }

            function EditState(fsm, violationReport) {
                fsm.currentStatus = this;
                this.status = 'editing';
                this.violationReport = violationReport || {};

                var request = {
                    id: {label: fsm.label},
                    label: fsm.label,
                    addressee: fsm.addressee,
                    street: fsm.street,
                    number: fsm.number,
                    zip: fsm.zip,
                    city: fsm.city,
                    country: fsm.country
                };

                fsm.cancel = function () {
                    new IdleState(fsm);
                };

                fsm.updateRequest = function () {
                    return request;
                };

                fsm.update = function () {
                    new WorkingState(fsm, request);
                };
            }

            function WorkingState(fsm, request) {
                fsm.currentStatus = this;
                this.status = 'working';

                shop.gateway.updateAddress(request, {
                    success: function () {
                        hydrate(request);
                        new IdleState(fsm);
                    },
                    rejected: function (report) {
                        new EditState(fsm, report);
                    }
                });
            }

            new IdleState(this);
        }
    }
}