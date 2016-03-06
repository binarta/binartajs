(function() {
    describe('binarta-checkpointjs', function() {
        var binarta, ui;

        beforeEach(function() {
            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            factory.addSubSystems({checkpoint: new BinartaCheckpointjs()});
            binarta = factory.create();
        });

        describe('active profile', function() {
            describe('billing details', function() {
                it('start out incomplete', function() {
                    expect(binarta.checkpoint.profile.billing.isComplete()).toBeFalsy();
                });

                it('profile refresh loads incomplete billing details', function() {
                    binarta.checkpoint.profile.gateway = new InCompleteBillingDetailsGateway();
                    binarta.checkpoint.profile.refresh();
                    expect(binarta.checkpoint.profile.billing.isComplete()).toBeFalsy();
                });

                it('profile refresh loads complete billing details', function() {
                    binarta.checkpoint.profile.gateway = new CompleteBillingDetailsGateway();
                    binarta.checkpoint.profile.refresh();
                    expect(binarta.checkpoint.profile.billing.isComplete()).toBeTruthy();
                });
            });
        });
    });

    function UI() {

    }

    function InCompleteBillingDetailsGateway() {
        this.fetchAccountMetadata = function(response) {
            response.activeAccountMetadata({billing:{complete:false}});
        }
    }

    function CompleteBillingDetailsGateway() {
        this.fetchAccountMetadata = function(response) {
            response.activeAccountMetadata({billing:{complete:true}});
        }
    }
})();