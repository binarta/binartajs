function BinartaShopjs() {
    this.checkout = new Checkout();

    function Checkout() {
        var self = this;
        var order;

        this.status = function () {
            return self.currentState.name;
        };

        this.start = function (o) {
            new AuthRequiredState(self);
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

            this.signin = function (credentials) {

            }
        }

        this.cancel();
    }

    // this.profile = new Profile();
    //
    // function Profile() {
    //     var metadata;
    //
    //     this.billing = new Billing();
    //
    //     this.refresh = function() {
    //         this.gateway.fetchAccountMetadata({activeAccountMetadata:function(it) {
    //             metadata = it;
    //         }});
    //     };
    //
    //     function Billing() {
    //         this.isComplete = function() {
    //             return metadata && metadata.billing && metadata.billing.complete;
    //         }
    //     }
    // }
}