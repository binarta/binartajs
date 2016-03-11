function BinartaInMemoryGatewaysjs() {
    this.checkpoint = new CheckpointGateway();

    function CheckpointGateway() {
        this.fetchAccountMetadata = function (response) {
            response.activeAccountMetadata({billing: {complete: false}});
        };

        this.initiateBillingAgreement = function (id, ui) {
            ui.approveBillingAgreement({
                paymentProvider: id,
                url: 'http://' + id + '/billing/agreement?token=t'
            });
        }
    }
}