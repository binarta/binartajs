(function () {
    describe('binarta-publisherjs', function () {
        var binarta, ui, publisher;

        beforeEach(function () {
            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            var checkpoint = new BinartaCheckpointjs();
            var application = new BinartaApplicationjs();
            factory.addSubSystems({
                checkpoint: checkpoint,
                application: application,
                publisher: new BinartaPublisherjs()
            });
            binarta = factory.create();
            publisher = binarta.publisher;
        });

        describe('blogs', function () {
            it('sits in idle status', function () {
                expect(publisher.blog.published.status).toEqual('idle');
            });

            it('published posts start out empty', function () {
                expect(publisher.blog.published.posts()).toEqual([]);
            });

            it('loading more blog posts', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.ok(['a', 'b', 'c']);
                    }
                };
                publisher.blog.published.more();
                expect(publisher.blog.published.posts()).toEqual(['a', 'b', 'c']);
            });

            it('take the first few published blog posts when more are available', function () {
                publisher.blog.published.cache = ['a', 'b', 'c'];
                expect(publisher.blog.published.posts({max: 2})).toEqual(['a', 'b']);
            });

            it('take the first few published blog posts when less are available', function () {
                publisher.blog.published.cache = ['a', 'b', 'c'];
                expect(publisher.blog.published.posts({max: 5})).toEqual(['a', 'b', 'c']);
            });

            it('loading more blog posts appends to already loaded blog posts', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.ok(['d', 'e', 'f']);
                    }
                };
                publisher.blog.published.cache = ['a', 'b', 'c'];
                publisher.blog.published.more();
                expect(publisher.blog.published.posts()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
            });

            it('updates status while loading more blog posts', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                    }
                };
                publisher.blog.published.more();
                expect(publisher.blog.published.status).toEqual('loading');
            });

            it('returns to idle status after loading more blog posts', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.ok([]);
                    }
                };
                publisher.blog.published.more();
                expect(publisher.blog.published.status).toEqual('idle');
            });

            it('loading more published blog posts is throttled when already loading', function () {
                publisher.blog.published.status = 'loading';
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        throw new Error();
                    }
                };
                publisher.blog.published.more();
            });

            it('loads more blog posts using the currently active locale for presentation', function () {
                binarta.application.setLocaleForPresentation('en');
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        expect(request.locale).toEqual('en');
                    }
                };
                publisher.blog.published.more();
            });

            it('load first set of published blog post', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        expect(request.subset).toEqual({offset: 0, max: 10});
                    }
                };
                publisher.blog.published.more();
            });

            it('load next set of published blog post', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        expect(request.subset).toEqual({offset: 3, max: 10});
                    }
                };
                publisher.blog.published.cache = ['a', 'b', 'c'];
                publisher.blog.published.more();
            });
        });
    });

    function UI() {
    }
})();
