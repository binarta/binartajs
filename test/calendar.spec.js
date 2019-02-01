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
            var response, observer, now;

            beforeEach(function () {
                now = new Date();
                response = jasmine.createSpyObj('response', ['events']);
                calendar.gateway = new ValidCalendarGateway();
                calendar.timeline = [now, now];
            });

            afterEach(function () {
                if (observer)
                    observer.disconnect();
            });

            describe('without filtering', function () {
                it('refresh to load upcoming events from server', function () {
                    calendar.gateway = new GatewaySpy();
                    calendar.upcoming.refresh();
                    expect(calendar.gateway.findUpcomingEventsRequest).toEqual({startDate: moment(now)});
                });

                it('installing an observer loads upcoming events from server', function () {
                    calendar.gateway = new GatewaySpy();
                    observer = calendar.upcoming.observe(response);
                    expect(calendar.gateway.findUpcomingEventsRequest).toEqual({startDate: moment(now)});
                });

                it('observers receive the list of upcoming events', function () {
                    observer = calendar.upcoming.observe(response);
                    expect(response.events).toHaveBeenCalledWith([
                        {id: 'a', start: moment('2017-02-01T16:00:00Z')},
                        {id: 'b', start: moment('2017-02-02T16:00:00Z')},
                        {id: 'c', start: moment('2017-02-03T16:00:00Z')}
                    ]);
                });

                it('disconnected observers are not notified of upcoming events', function () {
                    calendar.gateway = new GatewaySpy();
                    observer = calendar.upcoming.observe(response);
                    observer.disconnect();
                    calendar.gateway = new ValidCalendarGateway();
                    calendar.upcoming.refresh();
                    expect(response.events).not.toHaveBeenCalledWith([
                        {id: 'a', start: moment('2017-02-01T16:00:00Z')},
                        {id: 'b', start: moment('2017-02-02T16:00:00Z')},
                        {id: 'c', start: moment('2017-02-03T16:00:00Z')}
                    ]);
                });

                it('installing additional observers reuses previously loaded events', function () {
                    observer = calendar.upcoming.observe(response);
                    calendar.gateway = {};
                    response.events.calls.reset();
                    calendar.upcoming.observe(response).disconnect();
                    expect(response.events).toHaveBeenCalledWith([
                        {id: 'a', start: moment('2017-02-01T16:00:00Z')},
                        {id: 'b', start: moment('2017-02-02T16:00:00Z')},
                        {id: 'c', start: moment('2017-02-03T16:00:00Z')}
                    ]);
                });

                it('refreshing before events could be loaded from server does not trigger additional lookups', function () {
                    calendar.gateway = new GatewaySpy();
                    calendar.upcoming.refresh();
                    calendar.gateway = {};
                    calendar.upcoming.refresh();
                });

                it('refreshing after events could be loaded from performs lookup from server', function () {
                    calendar.upcoming.refresh();
                    calendar.gateway = new GatewaySpy();
                    calendar.upcoming.refresh();
                    expect(calendar.gateway.findUpcomingEventsRequest).toEqual({startDate: moment(now)});
                });
            });

            describe('with filtering', function () {
                var discriminator;

                beforeEach(function () {
                    discriminator = 'd';
                });

                it('refresh to load upcoming events from server', function () {
                    calendar.gateway = new GatewaySpy();
                    calendar.upcoming.refresh(discriminator);
                    expect(calendar.gateway.findUpcomingEventsRequest).toEqual({
                        startDate: moment(now),
                        metadata: 'd'
                    });
                });

                it('installing an observer loads upcoming events from server', function () {
                    calendar.gateway = new GatewaySpy();
                    observer = calendar.upcoming.observe(response, discriminator);
                    expect(calendar.gateway.findUpcomingEventsRequest).toEqual({
                        startDate: moment(now),
                        metadata: 'd'
                    });
                });

                it('observers receive the list of upcoming events', function () {
                    observer = calendar.upcoming.observe(response, discriminator);
                    expect(response.events).toHaveBeenCalledWith([
                        {id: 'a', start: moment('2017-02-01T16:00:00Z')},
                        {id: 'b', start: moment('2017-02-02T16:00:00Z')},
                        {id: 'c', start: moment('2017-02-03T16:00:00Z')}
                    ]);
                });

                it('disconnected observers are not notified of upcoming events', function () {
                    calendar.gateway = new GatewaySpy();
                    observer = calendar.upcoming.observe(response, discriminator);
                    observer.disconnect();
                    calendar.gateway = new ValidCalendarGateway();
                    calendar.upcoming.refresh(discriminator);
                    expect(response.events).not.toHaveBeenCalledWith([
                        {id: 'a', start: moment('2017-02-01T16:00:00Z')},
                        {id: 'b', start: moment('2017-02-02T16:00:00Z')},
                        {id: 'c', start: moment('2017-02-03T16:00:00Z')}
                    ]);
                });

                it('installing additional observers reuses previously loaded events', function () {
                    observer = calendar.upcoming.observe(response, discriminator);
                    calendar.gateway = {};
                    response.events.calls.reset();
                    calendar.upcoming.observe(response, discriminator).disconnect();
                    expect(response.events).toHaveBeenCalledWith([
                        {id: 'a', start: moment('2017-02-01T16:00:00Z')},
                        {id: 'b', start: moment('2017-02-02T16:00:00Z')},
                        {id: 'c', start: moment('2017-02-03T16:00:00Z')}
                    ]);
                });

                it('refreshing before events could be loaded from server does not trigger additional lookups', function () {
                    calendar.gateway = new GatewaySpy();
                    calendar.upcoming.refresh(discriminator);
                    calendar.gateway = {};
                    calendar.upcoming.refresh(discriminator);
                });

                it('refreshing after events could be loaded from performs lookup from server', function () {
                    calendar.upcoming.refresh(discriminator);
                    calendar.gateway = new GatewaySpy();
                    calendar.upcoming.refresh(discriminator);
                    expect(calendar.gateway.findUpcomingEventsRequest).toEqual({
                        startDate: moment(now),
                        metadata: 'd'
                    });
                });
            });
        });
    });

    function UI() {
        this.promptForPublicationTime = function (response) {
            response.success('t');
        }
    }
})();