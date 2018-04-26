function BinartaHumanResourcesjs(args) {
    var hr = this;
    var application = args.applicationjs;

    this.vacancies = new VacantPositionDictionary();

    function VacantPositionDictionary() {
        var self = this;
        var subsetSize = 100;
        var from, selected;

        this.positions = [];

        this.list = function () {
            return self.positions;
        };

        this.selected = function () {
            return selected;
        };

        this.search = function () {
            from = 0;
            hr.db.search({locale: application.localeForPresentation(), from: from, to: subsetSize}, {
                success: function (it) {
                    self.positions = it;
                    from += subsetSize;
                }
            });
        };

        this.next = function () {
            hr.db.search({locale: application.localeForPresentation(), from: from, to: from + subsetSize}, {
                success: function (it) {
                    self.positions = self.positions.concat(it);
                    from += subsetSize;
                }
            });
        };

        this.select = function (id) {
            hr.db.get({id: id, locale: application.localeForPresentation()}, {
                success: function (it) {
                    selected = it;
                }
            });
        }
    }
}