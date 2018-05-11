function BinartaHumanResourcesjs(args) {
    var hr = this;
    var application = args.applicationjs;

    this.vacancies = new VacantPositionDictionary();

    function VacantPositionDictionary() {
        var self = this;
        var subsetSize = 100;
        var searching = false;
        var selecting = false;
        var from, selected;

        this.positions = [];

        this.list = function () {
            return self.positions;
        };

        this.selected = function () {
            return selected;
        };

        this.searching = function() {
            return searching;
        };

        this.search = function () {
            searching = true;
            from = 0;
            hr.db.search({locale: application.localeForPresentation(), from: from, to: subsetSize}, {
                success: function (it) {
                    self.positions = it;
                    from += subsetSize;
                    searching = false;
                }
            });
        };

        this.next = function () {
            searching = true;
            hr.db.search({locale: application.localeForPresentation(), from: from, to: from + subsetSize}, {
                success: function (it) {
                    self.positions = self.positions.concat(it);
                    from += subsetSize;
                    searching = false;
                }
            });
        };

        this.selecting = function() {
            return selecting;
        };

        this.select = function (id) {
            selecting = true;
            hr.db.get({id: id, locale: application.localeForPresentation()}, {
                success: function (it) {
                    selected = it;
                    selecting = false;
                }
            });
        }
    }
}