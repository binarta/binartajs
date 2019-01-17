function BinartaCalendarjs() {
    var calendar = this;

    calendar.timeline = new BinartaTL();
    calendar.upcoming = new Upcoming();

    function Upcoming() {
        var rx = new BinartaRX();
        var upcoming = this;
        var events = [];
        var loading = false, initialised = false;

        upcoming.observe = function (l) {
            var o = rx.observe(l);
            if (!initialised)
                upcoming.refresh();
            raiseEvents();
            return o;
        };

        upcoming.refresh = function () {
            if (!loading) {
                loading = true;
                calendar.gateway.findUpcomingEvents({
                    startDate: moment(calendar.timeline.shift())
                }, {
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
}