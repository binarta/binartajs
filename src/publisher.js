function BinartaPublisherjs() {
    var publisher = this;

    publisher.blog = new Blog();

    publisher.newRoutingByApplicationLockDB = function (visitorDB, clerkDB) {
        return new RoutingByApplicationLockDecorator(visitorDB, clerkDB)
    };

    publisher.newCachingDB = function (sourceDB) {
        return new CachingDecorator(sourceDB)
    };

    function Blog() {
        var blog = this;

        blog.published = function (display) {
            return new Posts('findAllPublishedBlogsForLocale', display);
        };

        blog.drafts = function (display) {
            return new Posts('findAllBlogsInDraftForLocale', display);
        };

        blog.add = function (response) {
            publisher.db.add(
                {locale: publisher.binarta.application.localeForPresentation()},
                {
                    success: function (id) {
                        if (response && response.success)
                            response.success(id)
                    }
                }
            );
        };

        blog.get = function (id) {
            return new BlogPostHandle(id);
        };

        function Posts(query, display) {
            var posts = this;

            posts.subset = {offset: 0, max: 10};
            posts.status = 'has-more';

            posts.more = function () {
                if (posts.status == 'loading')
                    return;
                posts.status = 'loading';
                display.status(posts.status);
                var request = {
                    locale: publisher.binarta.application.localeForPresentation(),
                    subset: posts.subset
                };
                publisher.db[query](request, {
                    success: function (it) {
                        var decorated = posts.decorate(it);
                        display.more(decorated);
                        posts.status = decorated.length < request.subset.max ? 'no-more' : 'has-more';
                        display.status(posts.status);
                        posts.subset.offset += decorated.length;
                    }
                })
            };

            posts.decorate = function (it) {
                return it.map(function (it) {
                    var id = it.localId || it.id;
                    it.uri = '/blog/post/' + (id.substring(0, 1) == '/' ? id.substring(1) : id);
                    return it;
                })
            }
        }

        function BlogPostHandle(id) {
            var handle = this;
            var display, post;

            var closeables = [
                publisher.binarta.checkpoint.profile.eventRegistry.observe({
                    signedin: testForManipulationStatus,
                    signedout: becomeIdle
                }),
                publisher.binarta.application.eventRegistry.observe({
                    editing: testForManipulationStatus,
                    viewing: becomeIdle
                })
            ];

            function testForManipulationStatus() {
                if (publisher.binarta.application.lock.status == 'closed') {
                    if (post.status == 'draft' && publisher.binarta.checkpoint.profile.hasPermission('publish.blog.post'))
                        display.status('publishable');
                    if (post.status == 'published' && publisher.binarta.checkpoint.profile.hasPermission('withdraw.blog.post'))
                        display.status('withdrawable');
                    if (post.status == 'translatable')
                        display.status('translatable');
                }
            }

            function becomeIdle() {
                display.status('idle');
            }

            handle.connect = function (it) {
                display = it;
                becomeIdle();
                return handle;
            };

            handle.disconnect = function () {
                closeables.forEach(function (it) {
                    it.disconnect();
                });
            };

            handle.render = function () {
                get(publisher.binarta.application.localeForPresentation());
            };

            function isTranslatable() {
                return publisher.binarta.checkpoint.profile.hasPermission('draft.blog.post.in.another.language');
            }

            function get(locale, decorator) {
                display.status('loading');
                publisher.db.get({id: id, locale: locale}, {
                    success: function (it) {
                        post = decorator ? decorator(it) : it;
                        becomeIdle();
                        testForManipulationStatus();
                        display.post(post)
                    },
                    notFound: function () {
                        becomeIdle();
                        if (isTranslatable() && locale != publisher.binarta.application.primaryLanguage()) {
                            get(publisher.binarta.application.primaryLanguage(), function (it) {
                                it.status = 'translatable';
                                return it;
                            });
                        } else
                            display.notFound();
                    }
                });
            }

            handle.publish = function () {
                publisher.ui.promptForPublicationTime({
                    success: function (timestamp) {
                        display.status('publishing');
                        publisher.db.publish({
                            timestamp: timestamp,
                            id: post.id,
                            locale: publisher.binarta.application.localeForPresentation()
                        }, {
                            success: function () {
                                handle.render();
                                display.published();
                            }
                        });
                    },
                    cancel: display.canceled
                });
            };

            handle.withdraw = function () {
                display.status('withdrawing');
                publisher.db.withdraw({id: post.id, locale: publisher.binarta.application.localeForPresentation()}, {
                    success: function () {
                        handle.render();
                        display.withdrawn();
                    }
                });
            };

            handle.draft = function () {
                display.status('drafting');
                publisher.db.draftInAnotherLanguage({
                    id: post.id,
                    locale: publisher.binarta.application.localeForPresentation()
                }, {
                    success: function () {
                        handle.render();
                        display.drafted();
                    }
                })
            }
        }
    }

    function RoutingByApplicationLockDecorator(visitorDB, clerkDB) {
        var db = this;
        var routedDB = visitorDB;

        publisher.binarta.application.eventRegistry.add(db);

        db.editing = function () {
            routedDB = clerkDB;
        };

        db.add = function () {
            routedDB.add.apply(undefined, arguments);
        };

        db.get = function () {
            routedDB.get.apply(undefined, arguments);
        };

        db.findAllPublishedBlogsForLocale = function () {
            routedDB.findAllPublishedBlogsForLocale.apply(undefined, arguments);
        };

        db.publish = function () {
            routedDB.publish.apply(undefined, arguments);
        };

        db.withdraw = function () {
            routedDB.withdraw.apply(undefined, arguments);
        }
    }

    function CachingDecorator(db) {
        var cache = this;
        var posts = {};

        cache.sourceDB = db;
        cache.add = readOnly;
        cache.publish = readOnly;
        cache.withdraw = readOnly;

        function readOnly() {
            throw 'CachingDecorator is a read-only proxy!';
        }

        cache.get = function () {
            var params = arguments;
            var cacheKey = arguments[0].id + '-' + arguments[0].locale;
            resolve(cache.sourceDB.get, arguments, cacheKey, function (it) {
                if (it.id != params[0].id)
                    cacheItem(it.id + '-' + params[0].locale)(it);
            });
        };

        cache.findAllPublishedBlogsForLocale = function () {
            resolve(cache.sourceDB.findAllPublishedBlogsForLocale, arguments, arguments[0].locale + ':' + arguments[0].subset.offset + ':' + arguments[0].subset.max);
        };

        function resolve(query, params, cacheKey, onCache) {
            var args = [].slice.call(params);
            if (posts[cacheKey]) {
                if (args[1])
                    if (posts[cacheKey] == 'not-found') {
                        if (args[1].notFound)
                            args[1].notFound();
                    } else if (args[1].success)
                        args[1].success(posts[cacheKey]);
            } else {
                var doCache = function (it) {
                    cacheItem(cacheKey)(it);
                    if (onCache)
                        onCache(it);
                };
                if (!args[1])
                    args = args.concat([{success: doCache}]);
                if (!args[1].success)
                    args[1].success = cacheItem(cacheKey);
                if (!args[1].notFound)
                    args[1].notFound = cacheNotFound(cacheKey);
                query.apply(undefined, args);
            }
        }

        function cacheItem(id) {
            return function (it) {
                posts[id] = it;
            }
        }

        function cacheNotFound(id) {
            return function () {
                cacheItem(id)('not-found');
            }
        }
    }
}