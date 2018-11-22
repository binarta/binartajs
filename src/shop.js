function BinartaShopjs(checkpoint, deps) {
    var shop = this;
    var application = deps.application;
    shop.localStorage = deps && deps.localStorage ? deps.localStorage : WebStorageFactory('localStorage');
    shop.sessionStorage = deps && deps.sessionStorage ? deps.sessionStorage : WebStorageFactory('sessionStorage');

    checkpoint.profile.billing = new Billing(checkpoint.profile);
    checkpoint.profile.refresh = checkpoint.profile.billing.refresh(checkpoint.profile.refresh);
    this.basket = new Basket();
    this.checkout = new Checkout();
    this.couponDictionary = new CouponDictionary();

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
            return !shop.localStorage.basket;
        }

        this.initialize = function () {
            order = {
                items: []
            };
            recalculateOrderQuantity();
            flush();
        };

        function flush() {
            try {
                shop.localStorage.setItem('basket', JSON.stringify(order));
            } catch (ignored) {
            }
        }

        function rehydrate() {
            try {
                order = JSON.parse(shop.localStorage.basket);
            } catch (ignored) {
            }
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

        if (isUninitialized()) this.initialize();
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
            self.initialize();
            self.eventRegistry.forEach(function (it) {
                it.cleared();
            });
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
            'address-selection': AddressSelectionStep,
            'summary': SummaryStep,
            'setup-payment-provider': SetupPaymentProviderStep,
            'payment': PaymentStep,
            'completed': CompletedStep
        };
        var gatewaySteps = [
            'authentication-required',
            'setup-payment-provider',
            'payment'
        ];

        this.eventRegistry = new BinartaRX();

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
                order.termsAndConditions = 'accepted';
                self.persist({roadmap: roadmap, currentStep: 'idle', unlockedSteps: [roadmap[0]], order: order});
                self.next();
            }
        };

        this.persist = function (ctx) {
            shop.sessionStorage.setItem('binartaJSCheckout', JSON.stringify(ctx));
        };

        this.context = function () {
            return JSON.parse(shop.sessionStorage.getItem('binartaJSCheckout')) || {};
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
            shop.sessionStorage.setItem('binartaJSCheckout', '{}');
        }

        this.jumpTo = function (id) {
            new stepDefinitions[id](self);
            var ctx = self.context();
            ctx.currentStep = id;
            self.persist(ctx);
        };

        this.isNextStep = function (it) {
            var ctx = self.context();
            return ctx.roadmap[toNextStepIndex(ctx)] == it
        };

        function toNextStepIndex(ctx) {
            return ctx.roadmap.lastIndexOf(ctx.currentStep) + 1;
        }

        this.hasPreviousStep = function () {
            return self.previousStep();
        };

        this.previousStep = function () {
            var ctx = self.context();
            var finished = false;
            return ctx.roadmap.reduce(function (p, c, i) {
                if (p && !finished && ctx.roadmap.length == i + 1) return false;
                if (c == ctx.currentStep) finished = true;
                if (!finished && !gatewaySteps.some(function (gatewayStep) {
                    return c == gatewayStep;
                }))
                    return c;
                return p;
            }, undefined);
        };

        this.next = function () {
            var ctx = self.context();
            ctx.currentStep = ctx.roadmap[toNextStepIndex(ctx)];
            ctx.unlockedSteps.push(ctx.currentStep);
            self.persist(ctx);
            new (stepDefinitions[ctx.currentStep])(self);
            self.eventRegistry.forEach(function (l) {
                l.goto(self.status());
            });
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

        function AddressSelectionStep(fsm) {
            fsm.currentState = this;
            this.name = 'address-selection';

            fsm.selectAddresses = function (args) {
                if (!args || !args.billing && !args.shipping)
                    throw new Error('at.least.a.billing.address.must.be.selected');

                var ctx = self.context();
                ctx.order.billing = args.billing;
                ctx.order.shipping = args.shipping || args.billing;
                self.persist(ctx);

                fsm.next();
            };
        }

        function SummaryStep(fsm) {
            var self = this;
            fsm.currentState = this;
            this.name = 'summary';
            var violationReportCache = fsm.context().summaryViolationReport || {};

            fsm.getPaymentProvider = function () {
                return fsm.context().order.provider;
            };

            fsm.setPaymentProvider = function (provider) {
                var ctx = fsm.context();
                ctx.order.provider = provider;
                fsm.persist(ctx);
                shop.localStorage.setItem('binartaJSPaymentProvider', provider)
            };
            if (!fsm.getPaymentProvider())
                if (shop.localStorage.getItem('binartaJSPaymentProvider'))
                    fsm.setPaymentProvider(shop.localStorage.getItem('binartaJSPaymentProvider'));
                else {
                    var profile = application.profile();
                    if (profile.availablePaymentMethods && profile.availablePaymentMethods.length == 1)
                        fsm.setPaymentProvider(profile.availablePaymentMethods[0]);
                }

            fsm.setCouponCode = function (code) {
                var ctx = fsm.context();
                ctx.order.coupon = code;
                ctx.order.items.forEach(function (item) {
                    item.couponCode = code;
                });
                fsm.persist(ctx);
                fsm.eventRegistry.forEach(function (l) {
                    l.setCouponCode(code);
                });
            };

            fsm.confirm = function (onSuccessListener) {
                var ctx = fsm.context();
                delete ctx.summaryViolationReport;
                fsm.persist(ctx);
                shop.gateway.submitOrder(fsm.context().order, {
                    success: onSuccess(onSuccessListener),
                    rejected: proceedWhenPaymentProviderRequiresSetupOtherwise(next(onSuccessListener), cacheViolationReport)
                });
            };

            function onSuccess(listener) {
                return onOrderAccepted(function (args) {
                    var ctx = fsm.context();
                    ctx.orderSubmitted = true;
                    fsm.persist(ctx);
                    next(listener)();
                });
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

        function onOrderAccepted(listener) {
            return function (args) {
                var ctx = self.context();
                ctx.order.id = args.id;
                if (args.approvalUrl)
                    ctx.order.approvalUrl = args.approvalUrl;
                if (args.signingContext)
                    ctx.order.signingContext = args.signingContext;
                self.persist(ctx);
                listener(args);
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
                return onOrderAccepted(function (args) {
                    fsm.next();
                    if (listener)
                        listener();
                });
            }

            function cacheViolationReport(report) {
                violationReportCache = report;
            }

            fsm.violationReport = function () {
                return violationReportCache;
            }
        }

        function PaymentStep(fsm) {
            fsm.currentState = this;
            this.name = 'payment';
            var violationReportCache = {};

            fsm.confirm = function (request, onSuccess) {
                shop.gateway.confirmPayment(request, {
                    success: function () {
                        fsm.next();
                        if (onSuccess)
                            onSuccess();
                    },
                    rejected: function (report) {
                        var ctx = fsm.context();
                        ctx.summaryViolationReport = report;
                        fsm.persist(ctx);
                        returnToSummary(onSuccess)();
                    }
                });
            };

            fsm.cancelPayment = function (onSuccess) {
                shop.gateway.cancelOrder(fsm.context().order, {
                    success: returnToSummary(onSuccess),
                    rejected: cacheViolationReport
                });
            };

            function returnToSummary(onSuccess) {
                return function () {
                    var ctx = fsm.context();
                    delete ctx.order.id;
                    fsm.persist(ctx);
                    fsm.jumpTo('summary');
                    if (onSuccess)
                        onSuccess();
                }
            }

            function cacheViolationReport(report) {
                violationReportCache = report;
            }

            fsm.violationReport = function () {
                return violationReportCache;
            };

            clearBasketOnComplete(fsm);
        }

        function CompletedStep(fsm) {
            fsm.currentState = this;
            this.name = 'completed';

            clearBasketOnComplete(fsm);
        }

        function clearBasketOnComplete(fsm) {
            if (fsm.context().order.clearBasketOnComplete)
                shop.basket.clear();
        }

        new IdleState(self);
    }

    function Billing(profile) {
        var self = this;
        var profileCache = {};
        var addressesCache = [];
        var supportedCountriesCache = [{country: 'Albania', code: 'AL'}, {
            country: 'Algeria',
            code: 'DZ'
        }, {country: 'Argentina', code: 'AR'}, {country: 'Australia', code: 'AU'}, {
            country: 'Austria',
            code: 'AT'
        }, {country: 'Bahrain', code: 'BH'}, {country: 'Belarus', code: 'BY'}, {
            country: 'Belgium',
            code: 'BE'
        }, {country: 'Bolivia', code: 'BO'}, {country: 'Bosnia and Herzegovina', code: 'BA'}, {
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
        }, {country: 'Czech Republic', code: 'CZ'}, {country: 'Denmark', code: 'DK'}, {
            country: 'Dominican Republic',
            code: 'DO'
        }, {country: 'Ecuador', code: 'EC'}, {country: 'Egypt', code: 'EG'}, {
            country: 'El Salvador',
            code: 'SV'
        }, {country: 'Estonia', code: 'EE'}, {country: 'Finland', code: 'FI'}, {
            country: 'France',
            code: 'FR'
        }, {country: 'Germany', code: 'DE'}, {country: 'Greece', code: 'GR'}, {
            country: 'Guatemala',
            code: 'GT'
        }, {country: 'Honduras', code: 'HN'}, {country: 'Hong Kong', code: 'HK'}, {
            country: 'Hungary',
            code: 'HU'
        }, {country: 'Iceland', code: 'IS'}, {country: 'India', code: 'IN'}, {
            country: 'Indonesia',
            code: 'ID'
        }, {country: 'Iraq', code: 'IQ'}, {country: 'Ireland', code: 'IE'}, {
            country: 'Israel',
            code: 'IL'
        }, {country: 'Italy', code: 'IT'}, {country: 'Japan', code: 'JP'}, {
            country: 'Jordan',
            code: 'JO'
        }, {country: 'Kuwait', code: 'KW'}, {country: 'Latvia', code: 'LV'}, {
            country: 'Lebanon',
            code: 'LB'
        }, {country: 'Libya', code: 'LY'}, {country: 'Lithuania', code: 'LT'}, {
            country: 'Luxembourg',
            code: 'LU'
        }, {country: 'Macedonia', code: 'MK'}, {country: 'Malaysia', code: 'MY'}, {
            country: 'Malta',
            code: 'MT'
        }, {country: 'Mexico', code: 'MX'}, {country: 'Montenegro', code: 'ME'}, {
            country: 'Morocco',
            code: 'MA'
        }, {country: 'Netherlands', code: 'NL'}, {country: 'New Zealand', code: 'NZ'}, {
            country: 'Nicaragua',
            code: 'NI'
        }, {country: 'Norway', code: 'NO'}, {country: 'Oman', code: 'OM'}, {
            country: 'Panama',
            code: 'PA'
        }, {country: 'Paraguay', code: 'PY'}, {country: 'Peru', code: 'PE'}, {
            country: 'Philippines',
            code: 'PH'
        }, {country: 'Poland', code: 'PL'}, {country: 'Portugal', code: 'PT'}, {
            country: 'Puerto Rico',
            code: 'PR'
        }, {country: 'Qatar', code: 'QA'}, {country: 'Romania', code: 'RO'}, {
            country: 'Russia',
            code: 'RU'
        }, {country: 'Saudi Arabia', code: 'SA'}, {country: 'Serbia', code: 'RS'}, {
            country: 'Serbia and Montenegro',
            code: 'CS'
        }, {country: 'Singapore', code: 'SG'}, {country: 'Slovakia', code: 'SK'}, {
            country: 'Slovenia',
            code: 'SI'
        }, {country: 'South Africa', code: 'ZA'}, {country: 'South Korea', code: 'KR'}, {
            country: 'Spain',
            code: 'ES'
        }, {country: 'Sudan', code: 'SD'}, {country: 'Sweden', code: 'SE'}, {
            country: 'Switzerland',
            code: 'CH'
        }, {country: 'Syria', code: 'SY'}, {country: 'Taiwan', code: 'TW'}, {
            country: 'Thailand',
            code: 'TH'
        }, {country: 'Tunisia', code: 'TN'}, {country: 'Turkey', code: 'TR'}, {
            country: 'Ukraine',
            code: 'UA'
        }, {country: 'United Arab Emirates', code: 'AE'}, {
            country: 'United Kingdom',
            code: 'GB'
        }, {country: 'United States', code: 'US'}, {country: 'Uruguay', code: 'UY'}, {
            country: 'Venezuela',
            code: 'VE'
        }, {country: 'Vietnam', code: 'VN'}, {country: 'Yemen', code: 'YE'}];

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
        profile.supportedCountries = function () {
            return supportedCountriesCache;
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
            shop.sessionStorage.billingAgreementProvider = id;
            shop.gateway.initiateBillingAgreement(id, shop.ui);
        };

        this.cancel = function () {
            shop.ui.canceledBillingAgreement();
        };

        this.confirm = function (ctx) {
            shop.gateway.confirmBillingAgreement(
                {
                    paymentProvider: shop.sessionStorage.billingAgreementProvider,
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
            if (request.hasOwnProperty('vat') && request.vat != existingVatNumber)
                shop.gateway.updateBillingProfile({vat: request.vat}, {
                    success: function () {
                        profileCache.vat = request.vat;
                        response.success();
                    }
                });
        }

        function addAddress(request, response) {
            if (request.address && Object.keys(request.address).length > 0) {
                generateLabel(request.address);
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
        }

        function generateLabel(address) {
            if ((address.generateLabel || !address.label) && address.street && address.number && address.zip)
                address.label = '(' + address.zip + ') ' + address.street + ' ' + address.number;
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

                fsm.update = function (onSuccess) {
                    new WorkingState(fsm, request, onSuccess);
                };
            }

            function WorkingState(fsm, request, onSuccess) {
                fsm.currentStatus = this;
                this.status = 'working';

                generateLabel(request);
                shop.gateway.updateAddress(request, {
                    success: function () {
                        hydrate(request);
                        new IdleState(fsm);
                        if (onSuccess)
                            onSuccess();
                    },
                    rejected: function (report) {
                        new EditState(fsm, report);
                    }
                });
            }

            new IdleState(this);
        }
    }

    function CouponDictionary() {
        this.findById = function (id, presenter) {
            shop.gateway.findCouponById({id: id}, presenter);
        };

        this.contains = function (id, response) {
            shop.gateway.containsCoupon({id: id}, response);
        }
    }
}