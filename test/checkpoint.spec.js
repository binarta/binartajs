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
                    binarta.checkpoint.gateway = new InCompleteBillingDetailsGateway();
                    binarta.checkpoint.profile.refresh();
                    expect(binarta.checkpoint.profile.billing.isComplete()).toBeFalsy();
                });

                it('profile refresh loads complete billing details', function() {
                    binarta.checkpoint.gateway = new CompleteBillingDetailsGateway();
                    binarta.checkpoint.profile.refresh();
                    expect(binarta.checkpoint.profile.billing.isComplete()).toBeTruthy();
                });

                it('initiate billing agreement delegates to gateway', function() {
                    binarta.checkpoint.gateway = new GatewaySpy();
                    binarta.checkpoint.profile.billing.initiate('payment-provider');
                    expect(binarta.checkpoint.gateway.initiateBillingAgreementRequest).toEqual('payment-provider');
                });

                it('initiate billing agreement passes ui to gateway', function() {
                    binarta.checkpoint.gateway = new InterfacesWithUIGateway();
                    binarta.checkpoint.profile.billing.initiate('irrelevant');
                    expect(ui.wiredToGateway).toBeTruthy();
                });

                it('cancel billing agreement delegates to local ui', function() {
                    var localUi = jasmine.createSpyObj('ui', ['canceledBillingAgreement']);
                    binarta.checkpoint.profile.billing.cancel('token', localUi);
                    expect(localUi.canceledBillingAgreement).toHaveBeenCalled();
                });
            });
        });
    });

    function UI() {
        this.wiredToGateway = function() {
            this.wiredToGateway = true;
        }
    }

    function GatewaySpy() {
        this.initiateBillingAgreement = function(id, response) {
            this.initiateBillingAgreementRequest = id;
        }
    }

    function InterfacesWithUIGateway() {
        this.initiateBillingAgreement = function(id, response) {
            response.wiredToGateway();
        }
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