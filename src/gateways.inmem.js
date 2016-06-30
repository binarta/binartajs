function BinartaInMemoryGatewaysjs() {
    this.checkpoint = new CheckpointGateway();

    function CheckpointGateway() {
        var accounts = [];
        
        this.authenticated = false;
        
        this.register = function(request, response) {
            var violationReport = {};
            
            if(request.username == 'invalid')
                violationReport.username = ['invalid'];
            if(request.password == 'invalid')
                violationReport.password = ['invalid'];
            
            if(Object.keys(violationReport).length == 0) {
                accounts.push(request);
                response.success();
            } else
                response.rejected(violationReport);
        };
        
        this.signin = function(request, response) {
            var credentialsFound = accounts.map(function(it) {
                return request.username == it.username && request.password == it.password
            }).reduce(function(p, c) {
                return p || c;
            }, false);

            if(credentialsFound)
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