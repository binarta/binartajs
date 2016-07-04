function BinartaShopjs() {
    var shop = this;

    this.checkout = new Checkout();

    function Checkout() {
        var self = this;
        var order, steps;

        var stepDefinitions = {
            'authentication-required': AuthRequiredState,
            'completed': CompletedState
        };

        this.installCustomStepDefinition = function(id, definition) {
            stepDefinitions[id] = definition;
        };

        this.status = function () {
            return self.currentState.name;
        };
        
        this.start = function (o, roadmap) {
            if(self.status() == 'idle' || self.status() == 'completed') {
                steps = roadmap.map(function (it) {
                    return stepDefinitions[it];
                });
                self.next();
            }
        };

        this.jumpTo = function(id) {
            new stepDefinitions[id](self);
        };

        this.next = function() {
            new (steps.shift())(self);
        };

        this.cancel = function () {
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

            fsm.retry = function() {
                if(shop.binarta.checkpoint.profile.isAuthenticated())
                    fsm.next();
            };
            fsm.retry();
        }

        function CompletedState(fsm) {
            fsm.currentState = this;
            this.name = 'completed';
        }

        this.cancel();
    }
}