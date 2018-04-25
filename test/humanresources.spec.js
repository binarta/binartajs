(function () {
    describe('binarta-humanresourcesjs', function () {
        var binarta, ui, hr;

        beforeEach(function () {
            var db = new BinartaInMemoryGatewaysjs();
            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            var applicationjs = new BinartaApplicationjs();
            applicationjs.gateway = db.application;
            var hrjs = new BinartaHumanResourcesjs({
                applicationjs: applicationjs
            });
            hrjs.db = db.hr;
            factory.addSubSystems({
                application: applicationjs,
                humanresources: hrjs
            });
            binarta = factory.create();
            hr = binarta.humanresources;
            applicationjs.setLocale('default');
            applicationjs.setLocaleForPresentation('en');
        });

        describe('vacancies', function () {
            var vacancies;

            beforeEach(function () {
                vacancies = hr.vacancies;
            });

            it('are initially empty', function() {
                expect(vacancies.list()).toEqual([]);
            });

            it('no position is initially selected', function() {
                expect(vacancies.selected()).toBeUndefined();
            });

            describe('search', function() {
                it('populates vacant positions', function() {
                    vacancies.search();
                    expect(vacancies.list().map(function(it) {return it.id;}).join('')).toEqual('123');
                });

                it('is done for the current locale', function() {
                    hr.db = {
                        search:function(request) {
                            expect(request.locale).toEqual('en');
                        }
                    };
                    vacancies.search();
                });
            });

            describe('select position by id', function() {
                it('selects a specific position', function() {
                    vacancies.select("1");
                    expect(vacancies.selected().name).toEqual('Financial Advisor');
                    vacancies.select("2");
                    expect(vacancies.selected().name).toEqual('Technical Writer');
                    vacancies.select("3");
                    expect(vacancies.selected().name).toEqual('Project Manager');
                });

                it('is done for the current locale', function() {
                    hr.db = {
                        get:function(request) {
                            expect(request.locale).toEqual('en');
                        }
                    };
                    vacancies.select();
                });
            });
        });
    });

    function UI() {
    }
})();