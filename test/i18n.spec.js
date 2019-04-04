(function () {
    describe('binarta-i18njs', function () {
        var binarta, ui, i18n;

        beforeEach(function () {
            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            factory.addSubSystems({i18n: new BinartaI18njs()});
            binarta = factory.create();
            i18n = binarta.i18n;
        });

        describe('with observer', function () {
            var observer, spy;

            beforeEach(function () {
                spy = jasmine.createSpyObj('observer', ['translation']);
                observer = binarta.i18n.observe(spy);
            });

            afterEach(function () {
                observer.disconnect();
            });

            it('raise translation notifies observers', function () {
                binarta.i18n.raiseTranslation('t');
                expect(spy.translation).toHaveBeenCalledWith('t');
            });
        });
    });


    function UI() {
    }
})();