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

            it('adding draft delegates to db', function () {
                binarta.application.setLocaleForPresentation('en');
                publisher.db = jasmine.createSpyObj('db', ['add']);
                publisher.blog.add();
                expect(publisher.db.add).toHaveBeenCalled();
            });

            it('adding draft passes locale to db', function () {
                binarta.application.setLocaleForPresentation('en');
                publisher.db = {
                    add: function (request) {
                        expect(request.locale).toEqual('en');
                    }
                };
                publisher.blog.add();
            });

            it('adding draft takes a success listener which receives the newly created blog post id', function () {
                publisher.db = {
                    add: function (request, response) {
                        response.success('id');
                    }
                };
                var spy = jasmine.createSpyObj('listener', ['success']);
                publisher.blog.add(spy);
                expect(spy.success).toHaveBeenCalledWith('id');
            });

            it('adding draft takes an optional success listener', function () {
                publisher.db = {
                    add: function (request, response) {
                        response.success('-');
                    }
                };
                publisher.blog.add();
                publisher.blog.add({});
            });

            describe('with noop decorator', function () {
                beforeEach(function () {
                    publisher.blog.published.decorate = function (it) {
                        return it;
                    }
                });

                it('loading initial blog posts', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            response.success(['a', 'b', 'c']);
                        }
                    };
                    publisher.blog.published.init();
                    expect(publisher.blog.published.posts()).toEqual(['a', 'b', 'c']);
                });

                it('loading of initial published blog posts is throttled once some posts have been found', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            throw new Error();
                        }
                    };
                    publisher.blog.published.cache = ['-'];
                    publisher.blog.published.init();
                });

                it('loading more blog posts', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            response.success(['a', 'b', 'c']);
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
                            response.success(['d', 'e', 'f']);
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
                            response.success([]);
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

            it('initialising published blog posts decorates them with a uri based on the id', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.success([{id: 'x'}]);
                    }
                };
                publisher.blog.published.init();
                expect(publisher.blog.published.posts()[0].uri).toEqual('blog/post/x');
            });

            it('loading more published blog posts decorates them with a uri based on the id', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.success([{id: 'x'}]);
                    }
                };
                publisher.blog.published.more();
                expect(publisher.blog.published.posts()[0].uri).toEqual('blog/post/x');
            });

            it('decorating published blog posts with a uri strips leading slashes from the id', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.success([{id: '/x'}]);
                    }
                };
                publisher.blog.published.more();
                expect(publisher.blog.published.posts()[0].uri).toEqual('blog/post/x');
            });

            it('decorating published blog posts with a uri prefers the local id', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.success([{id: 'b', localId: 'p'}]);
                    }
                };
                publisher.blog.published.more();
                expect(publisher.blog.published.posts()[0].uri).toEqual('blog/post/p');
            });

            describe('given a specific blog', function () {
                var blog, display;

                beforeEach(function () {
                    binarta.application.setLocaleForPresentation('en');
                    display = jasmine.createSpyObj('display', ['post', 'notFound']);
                    blog = publisher.blog.get('b');
                });

                it('exposed status is idle', function () {
                    expect(blog.status).toEqual('idle');
                });

                it('while fetching the blog post to render the exposes status is loading', function () {
                    publisher.db = {
                        get: function (request, response) {
                        }
                    };
                    blog.render(display);
                    expect(blog.status).toEqual('loading');
                });

                describe('when the blog post could not be found', function () {
                    beforeEach(function () {
                        publisher.db = {
                            get: function (request, response) {
                                response.notFound();
                            }
                        };
                        blog.render(display);
                    });

                    it('then the display indicates not found for unknown blogs', function () {
                        expect(display.notFound).toHaveBeenCalled();
                    });

                    it('then the exposed status returns to idle', function () {
                        expect(blog.status).toEqual('idle');
                    });
                });

                it('rendering passes params to db', function () {
                    publisher.db = {
                        get: function (request, response) {
                            expect(request).toEqual({
                                id: 'b',
                                locale: 'en'
                            });
                        }
                    };
                    blog.render(display);
                });

                describe('when the blog post is found', function () {
                    beforeEach(function () {
                        publisher.db = {
                            get: function (request, response) {
                                response.success('p');
                            }
                        };
                        blog.render(display);
                    });

                    it('then the display renders the blog post', function () {
                        expect(display.post).toHaveBeenCalledWith('p');
                    });

                    it('then the exposed status returns to idle', function () {
                        expect(blog.status).toEqual('idle');
                    });
                });

                it('publishing prompts the UI for the publication time to use', function () {
                    ui.promptForPublicationTime = jasmine.createSpy();
                    blog.publish();
                    expect(ui.promptForPublicationTime).toHaveBeenCalled();
                });

                describe('when canceling the prompt for publication time', function () {
                    beforeEach(function () {
                        ui.promptForPublicationTime = function (response) {
                            response.cancel();
                        };
                        publisher.db = jasmine.createSpyObj('db', ['publish']);
                    });

                    it('then the publication request is not sent to the backend', function () {
                        blog.publish();
                        expect(publisher.db.publish).not.toHaveBeenCalled();
                    });

                    it('then the appropriate callback is executed', function () {
                        var spy = jasmine.createSpyObj('spy', ['canceled']);
                        blog.publish(spy);
                        expect(spy.canceled).toHaveBeenCalled();
                    });
                });

                it('while publishing the exposed status is publishing', function () {
                    publisher.db = {
                        publish: function (request, response) {
                        }
                    };
                    blog.publish();
                    expect(blog.status).toEqual('publishing');
                });

                describe('when publishing succeeds', function () {
                    var spy = jasmine.createSpyObj('response', ['published']);

                    beforeEach(function () {
                        publisher.db = {
                            publish: function (request, response) {
                                response.success();
                            }
                        };
                        blog.publish(spy);
                    });

                    it('then executes callback', function () {
                        expect(spy.published).toHaveBeenCalled();
                    });

                    it('then the exposed status returns to idle', function () {
                        expect(blog.status).toEqual('idle');
                    });
                });

                it('publishing passes params to db', function () {
                    publisher.db = {
                        publish: function (request, response) {
                            expect(request).toEqual({
                                timestamp: 't',
                                id: 'b',
                                locale: 'en'
                            });
                        }
                    };
                    blog.publish();
                });

                it('while withdrawing the exposed status is withdrawing', function () {
                    publisher.db = {
                        withdraw: function (request, response) {
                        }
                    };
                    blog.withdraw();
                    expect(blog.status).toEqual('withdrawing');
                });

                describe('when withdrawing succeeds', function () {
                    var spy = jasmine.createSpyObj('response', ['withdrawn']);

                    beforeEach(function () {
                        publisher.db = {
                            withdraw: function (request, response) {
                                response.success();
                            }
                        };
                        blog.withdraw(spy);
                    });

                    it('then executes callback', function () {
                        expect(spy.withdrawn).toHaveBeenCalled();
                    });

                    it('then the exposed status returns to idle', function () {
                        expect(blog.status).toEqual('idle');
                    });
                });

                it('withdrawing passes params to db', function () {
                    publisher.db = {
                        withdraw: function (request, response) {
                            expect(request).toEqual({
                                id: 'b',
                                locale: 'en'
                            });
                        }
                    };
                    blog.withdraw();
                });
            });
        });
    });

    function UI() {
        this.promptForPublicationTime = function (response) {
            response.success('t');
        }
    }
})();
