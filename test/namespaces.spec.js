describe('binarta-namespacesjs', function () {
    var binarta, ui, observer;

    beforeEach(function () {
        ui = new UI();
        var factory = new BinartajsFactory();
        factory.addUI(ui);
        var checkpoint = new BinartaCheckpointjs();
        checkpoint.gateway = new BinartaInMemoryGatewaysjs().checkpoint;
        var application = new BinartaApplicationjs();
        var namespaces = new BinartaNamespacesjs();
        factory.addSubSystems({
            checkpoint: checkpoint,
            application: application,
            namespaces: namespaces
        });
        binarta = factory.create();
    });

    describe('add widget', function () {
        beforeEach(function () {
            ui = jasmine.createSpyObj('ui', ['status', 'reseller']);
            observer = binarta.namespaces.add.observe(ui);
        });

        afterEach(function () {
            observer.disconnect();
        });

        it('observers are notified of idle status', function () {
            expect(ui.status).toHaveBeenCalledWith('idle');
        });

        it('with go live permission observers are notified we are operating in reseller mode', function () {
            binarta.checkpoint.gateway.addPermission('application.license.go.live');
            binarta.checkpoint.registrationForm.submit({username: 'u', password: 'p'});
            expect(ui.reseller).toHaveBeenCalled();
        });
    });

    function UI() {
        var self = this;
    }
});