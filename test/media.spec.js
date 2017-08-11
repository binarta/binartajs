(function () {
    describe('binarta-mediajs', function () {
        var binarta, ui, media, timeline, now;

        beforeEach(function () {
            ui = new UI();
            now = new Date();
            timeline = [];
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            var checkpointjs = new BinartaCheckpointjs();
            var mediajs = new BinartaMediajs({checkpointjs: checkpointjs, timeline: timeline});
            factory.addSubSystems({
                checkpoint: checkpointjs,
                media: mediajs
            });
            binarta = factory.create();
            media = binarta.media;
        });

        afterEach(function () {
            binarta.sessionStorage.removeItem('binartaImageTimestamp');
        });

        describe('images', function () {
            var images;

            beforeEach(function () {
                images = media.images;
            });

            describe('toURL', function () {
                it('for the base image', function () {
                    expect(images.toURL({path: 'x.img'})).toEqual('x.img');
                });

                it('for a specific width', function () {
                    expect(images.toURL({path: 'x.img', width: 200})).toEqual('x.img?width=200');
                    expect(images.toURL({path: 'x.img', width: 12.3})).toEqual('x.img?width=12');
                });

                it('for a specific height', function () {
                    expect(images.toURL({path: 'x.img', height: 100})).toEqual('x.img?height=100');
                    expect(images.toURL({path: 'x.img', height: 12.3})).toEqual('x.img?height=12');
                });

                it('for a specific width and height', function () {
                    expect(images.toURL({
                        path: 'x.img',
                        width: 200,
                        height: 100
                    })).toEqual('x.img?width=200&height=100');
                });

                it('with an existing query string', function () {
                    expect(images.toURL({
                        path: 'x.img?x=y&a=b',
                        width: 200,
                        height: 100
                    })).toEqual('x.img?x=y&a=b&width=200&height=100');
                });

                it('after signing but without image upload permission behavior remains the same', function() {
                    binarta.checkpoint.gateway = new WithPermissionsGateway([]);
                    binarta.checkpoint.signinForm.submit('-');
                    expect(images.toURL({path: 'x.img'})).toEqual('x.img');
                });

                describe('with image upload permission', function () {
                    beforeEach(function () {
                        timeline.push(now);
                        binarta.checkpoint.gateway = new WithPermissionsGateway([
                            'image.upload'
                        ]);
                        binarta.checkpoint.signinForm.submit('-');
                    });

                    it('a timestamp is appended', function () {
                        expect(images.toURL({path: 'x.img'})).toEqual('x.img?timestamp=' + now.getTime());
                    });

                    it('a timestamp reset can be requested', function() {
                        var later = new Date();
                        timeline.push(later);
                        images.resetTimestamp();
                        expect(images.toURL({path: 'x.img'})).toEqual('x.img?timestamp=' + later.getTime());
                    });

                    describe('and after signout', function() {
                        beforeEach(function() {
                            binarta.checkpoint.profile.signout();
                        });

                        it('then the timestamp is still appended', function () {
                            expect(images.toURL({path: 'x.img'})).toEqual('x.img?timestamp=' + now.getTime());
                        });

                        it('and session is closed then the timestamp is no longer appended', function() {
                            binarta.sessionStorage.removeItem('binartaImageTimestamp');
                            expect(images.toURL({path: 'x.img'})).toEqual('x.img');
                        });
                    });
                });

                it('a timestamp reset can only be done with sufficient permissions', function() {
                    timeline.push(new Date());
                    images.resetTimestamp();
                    expect(images.toURL({path: 'x.img'})).toEqual('x.img');
                });
            });
        });
    });

    function UI() {
    }
})();