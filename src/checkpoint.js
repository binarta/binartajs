function BinartaCheckpointjs() {
    var checkpoint = this;

    this.signinForm = new SigninForm();
    this.registrationForm = new RegistrationForm();
    this.profile = new Profile();

    function RegistrationForm() {
        var self = this;

        this.reset = function () {
            new IdleState(self);
        };
        this.reset();

        this.status = function () {
            return self.currentStatus.status;
        };

        this.violationReport = function () {
            return self.currentStatus.violationReport;
        };

        this.submit = function (creds, response) {
            self.currentStatus.submit(creds, response);
        };

        this.setAlreadyRegistered = function () {
            new RegisteredState(self);
        };

        function IdleState(fsm) {
            fsm.currentStatus = this;
            this.status = 'idle';
            this.violationReport = {};

            this.submit = function (creds, response) {
                new WorkingState(fsm, creds, response);
            }
        }

        function WorkingState(fsm, creds, response) {
            fsm.currentStatus = this;
            this.status = 'working';
            this.violationReport = {};

            var request = {
                email: creds.email,
                alias: creds.username || creds.email,
                username: creds.username || creds.email,
                password: creds.password,
                vat: creds.vat,
                captcha: creds.captcha
            };
            checkpoint.gateway.register(request, {
                success: onSuccess,
                rejected: onRejection
            });

            function onSuccess() {
                self.setAlreadyRegistered();
                checkpoint.signinForm.submit({
                    username: request.username,
                    password: request.password
                }, response);
            }

            function onRejection(violationReport) {
                new RejectedState(fsm, violationReport);
            }
        }

        function RejectedState(fsm, violationReport) {
            fsm.currentStatus = this;
            if (fsm.eventListener)
                fsm.eventListener.rejected();

            this.status = 'rejected';
            this.violationReport = violationReport;

            this.submit = function (creds, response) {
                new WorkingState(fsm, creds, response);
            }
        }

        function RegisteredState(fsm) {
            fsm.currentStatus = this;
            this.status = 'registered';
            this.violationReport = {};

            this.submit = function () {
                throw new Error('already.registered');
            }
        }
    }

    function SigninForm() {
        var self = this;

        this.reset = function () {
            new IdleState(self);
        };
        this.reset();

        this.status = function () {
            return self.currentStatus.status;
        };

        this.violation = function () {
            return self.currentStatus.violation;
        };

        this.submit = function (creds, response) {
            self.currentStatus.submit(creds, response);
        };

        function IdleState(fsm) {
            fsm.currentStatus = this;
            this.status = 'idle';
            this.violation = '';

            this.submit = function (creds, response) {
                new WorkingState(fsm, creds, response);
            }
        }

        function WorkingState(fsm, creds, response) {
            fsm.currentStatus = this;
            this.status = 'working';
            this.violation = '';

            checkpoint.gateway.signin(creds, {
                success: onSuccess,
                rejected: onRejection
            });

            function onSuccess() {
                new AuthenticatedState(fsm);
                checkpoint.registrationForm.setAlreadyRegistered();
                checkpoint.profile.refresh(response);
            }

            function onRejection() {
                new RejectedState(fsm);
            }
        }

        function RejectedState(fsm) {
            fsm.currentStatus = this;
            this.status = 'rejected';
            this.violation = 'credentials.mismatch';

            this.submit = function (creds, response) {
                new WorkingState(fsm, creds, response);
            }
        }

        function AuthenticatedState(fsm) {
            fsm.currentStatus = this;
            this.status = 'authenticated';
            this.violation = '';

            this.submit = function () {
                throw new Error('already.authenticated');
            }
        }
    }

    function Profile() {
        var authenticated = false;
        var metadataCache;

        this.billing = new Billing();

        this.refresh = function (response) {
            response = toNoOpResponse(response);
            checkpoint.gateway.fetchAccountMetadata({
                unauthenticated: onSignout,
                activeAccountMetadata: function (it) {
                    authenticated = true;
                    metadataCache = it;
                    response.success();
                }
            });
        };

        function onSignout() {
            authenticated = false;
            metadataCache = {};
            checkpoint.registrationForm.reset();
            checkpoint.signinForm.reset();
        }

        this.signout = function() {
            checkpoint.gateway.signout();
            onSignout();
        };

        function toNoOpResponse(it) {
            var response = {
                success:function() {}
            };
            if(it) {
                if(it.success)
                    response.success = it.success;
            }
            return response;
        }

        this.isAuthenticated = function () {
            return authenticated;
        };

        this.metadata = function() {
            return metadataCache;
        };

        function Billing() {
            this.isComplete = function () {
                return metadataCache && metadataCache.billing && metadataCache.billing.complete;
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
                if (metadataCache) {
                    if (metadataCache.billing)
                        metadataCache.billing.complete = true;
                    else
                        metadataCache.billing = {complete: true}
                } else
                    metadataCache = {billing: {complete: true}}
            }
        }
    }
}