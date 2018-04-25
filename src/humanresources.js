function BinartaHumanResourcesjs(args) {
    var hr = this;
    var application = args.applicationjs;

    this.vacancies = new VacantPositionDictionary();

    function VacantPositionDictionary() {
        var positions = [];
        var selected;

        this.list = function () {
            return positions;
        };

        this.selected = function () {
            return selected;
        };

        this.search = function () {
            hr.db.search({locale: application.localeForPresentation()}, {
                success: function (it) {
                    positions = it;
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