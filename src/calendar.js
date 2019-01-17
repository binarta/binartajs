function BinartaCalendarjs() {
    var calendar = this;

    calendar.upcoming = new Upcoming();

    function Upcoming() {
        var upcoming = this;

        upcoming.events = [];

        upcoming.refresh = function () {
            calendar.gateway.findUpcomingEvents({}, {
                success: function (it) {
                    upcoming.events = it.map(function (it) {
                        it.start = moment(it.start);
                        return it;
                    });
                }
            })
        }
    }
}