function BinartaShopjs() {
    var shop = this;

    this.checkout = new Checkout();

    function Checkout() {
        var self = this;

        var stepDefinitions = {
            'authentication-required': AuthRequiredState,
            'summary': SummaryState,
            'completed': CompletedState
        };

        this.installCustomStepDefinition = function (id, definition) {
            stepDefinitions[id] = definition;
        };

        this.status = function () {
            return self.currentState.name;
        };

        this.start = function (order, roadmap) {
            if (self.status() == 'idle' || self.status() == 'completed') {
                self.persist({roadmap: roadmap, order: order});
                self.next();
            }
        };

        this.persist = function (ctx) {
            sessionStorage.setItem('binartaJSCheckout', JSON.stringify(ctx));
        };

        this.context = function () {
            return JSON.parse(sessionStorage.getItem('binartaJSCheckout'));
        };

        function clear() {
            sessionStorage.setItem('binartaJSCheckout', '{}');
        }

        this.jumpTo = function (id) {
            new stepDefinitions[id](self);
        };

        this.next = function () {
            var ctx = self.context();
            var step = ctx.roadmap.shift();
            self.persist(ctx);
            new (stepDefinitions[step])(self);
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

        function AuthRequiredState(fsm) {
            fsm.currentState = this;
            this.name = 'authentication-required';

            fsm.retry = function () {
                if (shop.binarta.checkpoint.profile.isAuthenticated())
                    fsm.next();
            };
            fsm.retry();
        }

        function SummaryState(fsm) {
            fsm.currentState = this;
            this.name = 'summary';
            var violationReportCache = {};

            fsm.confirm = function (onSuccessListener) {
                shop.gateway.submitOrder(fsm.context().order, {
                    success: onSuccess(onSuccessListener),
                    rejected: cacheViolationReport
                });
            };

            function onSuccess(listener) {
                return function() {
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

        function CompletedState(fsm) {
            fsm.currentState = this;
            this.name = 'completed';
        }

        new IdleState(self);
    }
}