(function () {
    describe('binarta-calendarjs', function () {
        var binarta, ui, calendar;

        beforeEach(function () {
            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            factory.addSubSystems({
                calendar: new BinartaCalendarjs()
            });
            binarta = factory.create();
            calendar = binarta.calendar;
        });

        describe('upcoming events', function () {
            beforeEach(function () {
                calendar.gateway = new ValidCalendarGateway();
            });

            it('are initially empty', function () {
                expect(calendar.upcoming.events).toEqual([]);
            });

            it('refresh to load upcoming events from server', function () {
                calendar.gateway = new GatewaySpy();
                calendar.upcoming.refresh();
                expect(calendar.gateway.findUpcomingEventsRequest).toEqual({});
            });

            it('refresh updates the list of upcoming events', function () {
                calendar.upcoming.refresh();
                expect(calendar.upcoming.events).toEqual([
                    {id: 'a', start: moment('2017-02-01T16:00:00Z')},
                    {id: 'b', start: moment('2017-02-02T16:00:00Z')},
                    {id: 'c', start: moment('2017-02-03T16:00:00Z')}
                ]);
            });
        });
    });

    function UI() {
        this.promptForPublicationTime = function (response) {
            response.success('t');
        }
    }
})();