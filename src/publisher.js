function BinartaPublisherjs() {
    var publisher = this;

    publisher.blog = new Blog();

    function Blog() {
        var blog = this;

        blog.published = new Posts();

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

        function Posts() {
            var posts = this;

            posts.cache = [];
            posts.status = 'idle';

            posts.posts = function (args) {
                if (!args)
                    args = {};
                if (!args.max)
                    args.max = posts.cache.length;
                return posts.cache.slice(0, args.max);
            };

            posts.init = function () {
                if (posts.cache.length == 0)
                    posts.more();
            };

            posts.more = function () {
                if (posts.status == 'loading')
                    return;
                posts.status = 'loading';
                var request = {
                    locale: publisher.binarta.application.localeForPresentation(),
                    subset: {offset: posts.cache.length, max: 10}
                };
                publisher.db.findAllPublishedBlogsForLocale(request, {
                    success: function (it) {
                        posts.cache = posts.cache.concat(posts.decorate(it));
                        posts.status = 'idle';
                    }
                })
            };

            posts.decorate = function (it) {
                return it.map(function (it) {
                    var id = it.localId || it.id;
                    it.uri = 'blog/post/' + (id.substring(0, 1) == '/' ? id.substring(1) : id);
                    return it;
                })
            }
        }

        function BlogPostHandle(id) {
            var handle = this;

            handle.render = function (display) {
                publisher.db.get({id: id, locale: publisher.binarta.application.localeForPresentation()}, {
                    success: display.post,
                    notFound: display.notFound
                })
            };

            handle.publish = function (timestamp, response) {
                publisher.db.publish({
                    timestamp: timestamp,
                    id: id,
                    locale: publisher.binarta.application.localeForPresentation()
                }, {
                    success: function () {
                        if (response && response.published)
                            response.published();
                    }
                })
            }
        }
    }
}