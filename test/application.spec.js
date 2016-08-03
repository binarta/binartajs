(function () {
    describe('binarta-applicationjs', function () {
        var binarta, ui;

        beforeEach(function () {
            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            factory.addSubSystems({application: new BinartaApplicationjs()});
            binarta = factory.create();
        });

        it('exposes an empty profile', function () {
            expect(binarta.application.profile()).toEqual({});
        });

        it('on refresh request profile data', function () {
            binarta.application.gateway = new GatewaySpy();
            binarta.application.refresh();
            expect(binarta.application.gateway.fetchApplicationProfileRequest).toEqual({});
        });

        it('when refresh success then profile cache is updated', function () {
            binarta.application.gateway = new ValidApplicationGateway();
            binarta.application.refresh();
            expect(binarta.application.profile().name).toEqual('test-application');
        });

        describe('when passing an optional success listener to refresh', function() {
            var spy;

            beforeEach(function() {
                spy = jasmine.createSpy('spy');
            });

            it('and refresh does not complete then listener is not triggered', function () {
                binarta.application.gateway = new GatewaySpy();
                binarta.application.refresh(spy);
                expect(spy).not.toHaveBeenCalled();
            });

            it('and refresh completes then listener is not triggered', function () {
                binarta.application.gateway = new ValidApplicationGateway();
                binarta.application.refresh(spy);
                expect(spy).toHaveBeenCalled();
            });
        });
    });

    function UI() {
    }
})();