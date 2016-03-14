function BinartaCheckpointjs() {
    var checkpoint = this;

    this.profile = new Profile();

    function Profile() {
        var metadata;

        this.billing = new Billing();

        this.refresh = function () {
            checkpoint.gateway.fetchAccountMetadata({
                activeAccountMetadata: function (it) {
                    metadata = it;
                }
            });
        };

        function Billing() {
            this.isComplete = function () {
                return metadata && metadata.billing && metadata.billing.complete;
            };

            this.initiate = function (id) {
                checkpoint.gateway.initiateBillingAgreement(id, checkpoint.ui);
            };

            this.cancel = function() {
                checkpoint.ui.canceledBillingAgreement();
            };

            this.confirm = function(ctx) {
                checkpoint.gateway.confirmBillingAgreement(ctx, checkpoint.ui);
            }
        }
    }
}