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
                    expect(ui.isWiredToGateway).toBeTruthy();
                });

                it('cancel billing agreement delegates to ui', function() {
                    binarta.checkpoint.profile.billing.cancel();
                    expect(ui.receivedCanceledBillingAgreementRequest).toBeTruthy();
                });

                it('confirm billing agreement delegates to gateway', function() {
                    binarta.checkpoint.gateway = new GatewaySpy();
                    binarta.checkpoint.profile.billing.confirm('tokens');
                    expect(binarta.checkpoint.gateway.confirmBillingAgreementRequest).toEqual('tokens');
                });

                it('confirm billing agreement delegates passes ui to gateway', function() {
                    binarta.checkpoint.gateway = new InterfacesWithUIGateway();
                    binarta.checkpoint.profile.billing.confirm('irrelevant');
                    expect(ui.isWiredToGateway).toBeTruthy();
                });
            });
        });
    });

    function UI() {
        this.wiredToGateway = function() {
            this.isWiredToGateway = true;
        };

        this.canceledBillingAgreement = function() {
            this.receivedCanceledBillingAgreementRequest = true;
        }
    }

    function GatewaySpy() {
        this.initiateBillingAgreement = spy('initiateBillingAgreementRequest');
        this.confirmBillingAgreement = spy('confirmBillingAgreementRequest');

        function spy(requestAttribute) {
            return function(ctx) {
                this[requestAttribute] = ctx;
            }
        }
    }

    function InterfacesWithUIGateway() {
        this.initiateBillingAgreement = wire;
        this.confirmBillingAgreement = wire;

        function wire(ignored, ui) {
            ui.wiredToGateway();
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