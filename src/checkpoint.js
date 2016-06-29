function BinartaCheckpointjs() {
    var checkpoint = this;

    this.signinForm = new SigninForm();
    this.profile = new Profile();

    function SigninForm() {
        var self = this;

        this.reset = function() {
            new IdleState(self);
        };
        this.reset();

        this.status = function() {
            return self.currentStatus.status;
        };

        this.violation = function() {
            return self.currentStatus.violation;
        };

        this.submit = function(creds) {
            self.currentStatus.submit(creds);
        };

        function IdleState(fsm) {
            fsm.currentStatus = this;
            this.status = 'idle';
            this.violation = '';

            this.submit = function(creds) {
                new WorkingState(fsm, creds);
            }
        }

        function WorkingState(fsm, creds) {
            fsm.currentStatus = this;
            this.status = 'working';
            this.violation = '';

            checkpoint.gateway.signin(creds, {
                success:onSuccess,
                rejected:onRejection
            });

            function onSuccess() {
                new AuthenticatedState(fsm);
            }

            function onRejection() {
                new RejectedState(fsm);
            }
        }

        function RejectedState(fsm) {
            fsm.currentStatus = this;
            this.status = 'rejected';
            this.violation = 'credentials.mismatch';

            this.submit = function(creds) {
                new WorkingState(fsm, creds);
            }
        }

        function AuthenticatedState(fsm) {
            fsm.currentStatus = this;
            this.status = 'authenticated';
            this.violation = '';

            this.submit = function() {
                throw new Error('already.authenticated');
            }
        }
    }

    function Profile() {
        var authenticated = false;
        var metadata;

        this.billing = new Billing();

        this.refresh = function () {
            checkpoint.gateway.fetchAccountMetadata({
                unauthenticated: function () {
                    authenticated = false;
                    checkpoint.signinForm.reset();
                },
                activeAccountMetadata: function (it) {
                    authenticated = true;
                    metadata = it;
                }
            });
        };

        this.isAuthenticated = function () {
            return authenticated;
        };

        function Billing() {
            this.isComplete = function () {
                return metadata && metadata.billing && metadata.billing.complete;
            };

            this.initiate = function (id) {
                checkpoint.ui.initiatingBillingAgreement();
                sessionStorage.billingAgreementProvider = id;
                checkpoint.gateway.initiateBillingAgreement(id, checkpoint.ui);
            };

            this.cancel = function () {
                checkpoint.ui.canceledBillingAgreement();
            };

            this.confirm = function (ctx) {
                checkpoint.gateway.confirmBillingAgreement(
                    {
                        paymentProvider: sessionStorage.billingAgreementProvider,
                        confirmationToken: ctx.confirmationToken
                    },
                    new BinartaMergingUI(
                        checkpoint.ui,
                        {confirmedBillingAgreement: confirmed}
                    )
                );
            };

            function confirmed() {
                if (metadata) {
                    if (metadata.billing)
                        metadata.billing.complete = true;
                    else
                        metadata.billing = {complete: true}
                } else
                    metadata = {billing: {complete: true}}
            }
        }
    }
}