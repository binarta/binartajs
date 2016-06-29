function BinartaInMemoryGatewaysjs() {
    this.checkpoint = new CheckpointGateway();

    function CheckpointGateway() {
        this.authenticated = false;
        
        this.signin = function(request, response) {
            if(request.username == 'valid' && request.password == 'credentials')
                response.success();
            else
                response.rejected();
        };

        this.fetchAccountMetadata = function (response) {
            response.activeAccountMetadata({billing: {complete: false}});
        };

        this.initiateBillingAgreement = function (id, ui) {
            ui.approveBillingAgreement({
                paymentProvider: id,
                url: 'http://' + id + '/billing/agreement?token=t'
            });
        };

        this.confirmBillingAgreement = function(ctx, ui) {
            ui.confirmedBillingAgreement();
        }
    }
}