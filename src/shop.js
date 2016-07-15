function BinartaShopjs(checkpoint) {
    var shop = this;

    checkpoint.profile.billing = new Billing(checkpoint.profile);
    this.checkout = new Checkout();

    this.previewOrder = function (order, render) {
        shop.gateway.previewOrder(order, {success: render});
    };

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
            if(metadata == undefined)
                metadata = {};
            if(metadata.isGatewayStep)
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
                var unlocked = ctx.unlockedSteps.some(function(step) {
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
                    rejected: proceedWhenPaymentProviderRequiresSetupOtherwise(onSuccess(onSuccessListener), cacheViolationReport)
                });
            };

            function onSuccess(listener) {
                return function () {
                    fsm.next();
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
        this.isComplete = function () {
            return profile.metadataCache && profile.metadataCache.billing && profile.metadataCache.billing.complete;
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
    }
}