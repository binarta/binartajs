(function () {
    describe('binarta-catalogjs', function () {
        var binarta, ui, catalog;

        beforeEach(function () {
            var factory = new BinartajsFactory();
            factory.addUI(new UI());
            var catalogjs = new BinartaCatalogjs();
            factory.addSubSystems({catalog: catalogjs});
            binarta = factory.create();
            catalog = binarta.catalog;
        });

        describe('browser', function () {
            var browser;

            beforeEach(function () {
                browser = catalog.browser;
                ui = jasmine.createSpyObj('ui', ['type', 'path', 'parentPath']);
            });

            describe('with observer', function () {
                var observer;

                beforeEach(function () {
                    observer = browser.observe(ui);
                });

                afterEach(function () {
                    observer.disconnect();
                });

                it('type is initially unknown', function () {
                    expect(ui.type).not.toHaveBeenCalled();
                });

                it('path is initially unknown', function () {
                    expect(ui.path).not.toHaveBeenCalled();
                });

                it('parent path is initially unknown', function () {
                    expect(ui.parentPath).not.toHaveBeenCalled();
                });

                describe('when setting a type programatically', function() {
                    beforeEach(function() {
                        browser.type('t');
                    });

                    it('existing observers are notified', function () {
                        expect(ui.type).toHaveBeenCalledWith('t');
                    });

                    it('new observers are notified', function () {
                        ui.type.calls.reset();
                        browser.observe(ui).disconnect();
                        expect(ui.type).toHaveBeenCalledWith('t');
                    });
                });

                describe('when setting a path programatically', function() {
                    beforeEach(function() {
                        browser.path('p');
                    });

                    it('existing observers are notified', function () {
                        expect(ui.path).toHaveBeenCalledWith('p');
                    });

                    it('new observers are notified', function () {
                        ui.path.calls.reset();
                        browser.observe(ui).disconnect();
                        expect(ui.path).toHaveBeenCalledWith('p');
                    });
                });

                describe('when setting a parent path programatically', function() {
                    beforeEach(function() {
                        browser.parentPath('p');
                    });

                    it('existing observers are notified', function () {
                        expect(ui.parentPath).toHaveBeenCalledWith('p');
                    });

                    it('new observers are notified', function () {
                        ui.parentPath.calls.reset();
                        browser.observe(ui).disconnect();
                        expect(ui.parentPath).toHaveBeenCalledWith('p');
                    });
                });
            });
        });
    });

    function UI() {
    }
})();