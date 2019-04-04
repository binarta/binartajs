function BinartaI18njs() {
    var rx = new BinartaRX();
    var i18n = this;

    i18n.rx = rx;
    i18n.observe = rx.observe;

    i18n.raiseTranslation = function (it) {
        rx.notify('translation', it);
    }
}