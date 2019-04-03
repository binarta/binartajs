function BinartaCalendarjs() {
    var calendar = this;

    calendar.timeline = new BinartaTL();
    calendar.upcoming = new Upcoming();

    function Upcoming() {
        var upcoming = this;
        var map = {};

        function Events() {
            var self = this;
            var rx = new BinartaRX();
            var loading = false, initialised = false;
            var events = [];

            self.observe = function (l, d) {
                var o = rx.observe(l);
                if (!initialised)
                    upcoming.refresh(d);
                raiseEvents();
                return o;
            };

            self.refresh = function (discriminator) {
                if (!loading) {
                    loading = true;
                    var request = {startDate: moment(calendar.timeline.shift())};
                    if (discriminator)
                        request.metadata = discriminator;
                    calendar.gateway.findUpcomingEvents(request, {
                        success: function (it) {
                            events = it.map(function (it) {
                                it.start = moment(it.start);
                                return it;
                            });
                            raiseEvents();
                            initialised = true;
                            loading = false;
                        }
                    });
                }
            };

            function raiseEvents() {
                rx.notify('events', events);
            }
        }

        map.all = new Events();

        upcoming.observe = function (l, d) {
            return events(d).observe(l, d);
        };

        upcoming.refresh = function (d) {
            events(d).refresh(d);
        };

        function events(it) {
            if(!it)
                return events('all');
            if (!map[it])
                map[it] = new Events();
            return map[it];
        }
    }
}