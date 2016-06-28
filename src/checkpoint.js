function BinartaCheckpointjs() {
    var checkpoint = this;

    this.profile = new Profile();

    function Profile() {
        var authenticated = false;
        var metadata;

        this.billing = new Billing();

        this.refresh = function () {
            checkpoint.gateway.fetchAccountMetadata({
                unauthenticated: function () {
                    authenticated = false;
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