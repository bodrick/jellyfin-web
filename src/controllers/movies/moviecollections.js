define(['loading', 'events', 'libraryBrowser', 'imageLoader', 'listView', 'cardBuilder', 'userSettings', 'globalize', 'emby-itemscontainer'], function (loading, events, libraryBrowser, imageLoader, listView, cardBuilder, userSettings, globalize) {
    'use strict';

    libraryBrowser = libraryBrowser.default || libraryBrowser;

    return function (view, params, tabContent) {
        function getPageData(context) {
            var key = getSavedQueryKey(context);
            var pageData = data[key];

            if (!pageData) {
                pageData = data[key] = {
                    query: {
                        SortBy: 'SortName',
                        SortOrder: 'Ascending',
                        IncludeItemTypes: 'BoxSet',
                        Recursive: true,
                        Fields: 'PrimaryImageAspectRatio,SortName',
                        ImageTypeLimit: 1,
                        EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
                        StartIndex: 0
                    },
                    view: libraryBrowser.getSavedView(key) || 'Poster'
                };

                if (userSettings.libraryPageSize() > 0) {
                    pageData.query['Limit'] = userSettings.libraryPageSize();
                }

                pageData.query.ParentId = params.topParentId;
                libraryBrowser.loadSavedQueryValues(key, pageData.query);
            }

            return pageData;
        }

        function getQuery(context) {
            return getPageData(context).query;
        }

        function getSavedQueryKey(context) {
            if (!context.savedQueryKey) {
                context.savedQueryKey = libraryBrowser.getSavedQueryKey('moviecollections');
            }

            return context.savedQueryKey;
        }

        function onViewStyleChange() {
            var viewStyle = self.getCurrentViewStyle();
            var itemsContainer = tabContent.querySelector('.itemsContainer');

            if (viewStyle == 'List') {
                itemsContainer.classList.add('vertical-list');
                itemsContainer.classList.remove('vertical-wrap');
            } else {
                itemsContainer.classList.remove('vertical-list');
                itemsContainer.classList.add('vertical-wrap');
            }

            itemsContainer.innerHTML = '';
        }

        function reloadItems(page) {
            loading.show();
            isLoading = true;
            var query = getQuery(page);
            ApiClient.getItems(ApiClient.getCurrentUserId(), query).then(function (result) {
                function onNextPageClick() {
                    if (isLoading) {
                        return;
                    }

                    if (userSettings.libraryPageSize() > 0) {
                        query.StartIndex += query.Limit;
                    }
                    reloadItems(tabContent);
                }

                function onPreviousPageClick() {
                    if (isLoading) {
                        return;
                    }

                    if (userSettings.libraryPageSize() > 0) {
                        query.StartIndex = Math.max(0, query.StartIndex - query.Limit);
                    }
                    reloadItems(tabContent);
                }

                window.scrollTo(0, 0);
                var html;
                var pagingHtml = libraryBrowser.getQueryPagingHtml({
                    startIndex: query.StartIndex,
                    limit: query.Limit,
                    totalRecordCount: result.TotalRecordCount,
                    showLimit: false,
                    updatePageSizeSetting: false,
                    addLayoutButton: false,
                    sortButton: false,
                    filterButton: false
                });
                var viewStyle = self.getCurrentViewStyle();
                if (viewStyle == 'Thumb') {
                    html = cardBuilder.getCardsHtml({
                        items: result.Items,
                        shape: 'backdrop',
                        preferThumb: true,
                        context: 'movies',
                        overlayPlayButton: true,
                        centerText: true,
                        showTitle: true
                    });
                } else if (viewStyle == 'ThumbCard') {
                    html = cardBuilder.getCardsHtml({
                        items: result.Items,
                        shape: 'backdrop',
                        preferThumb: true,
                        context: 'movies',
                        lazy: true,
                        cardLayout: true,
                        showTitle: true
                    });
                } else if (viewStyle == 'Banner') {
                    html = cardBuilder.getCardsHtml({
                        items: result.Items,
                        shape: 'banner',
                        preferBanner: true,
                        context: 'movies',
                        lazy: true
                    });
                } else if (viewStyle == 'List') {
                    html = listView.getListViewHtml({
                        items: result.Items,
                        context: 'movies',
                        sortBy: query.SortBy
                    });
                } else if (viewStyle == 'PosterCard') {
                    html = cardBuilder.getCardsHtml({
                        items: result.Items,
                        shape: 'auto',
                        context: 'movies',
                        showTitle: true,
                        centerText: false,
                        cardLayout: true
                    });
                } else {
                    html = cardBuilder.getCardsHtml({
                        items: result.Items,
                        shape: 'auto',
                        context: 'movies',
                        centerText: true,
                        overlayPlayButton: true,
                        showTitle: true
                    });
                }
                var i;
                var length;
                var elems = tabContent.querySelectorAll('.paging');

                for (i = 0, length = elems.length; i < length; i++) {
                    elems[i].innerHTML = pagingHtml;
                }

                elems = tabContent.querySelectorAll('.btnNextPage');
                for (i = 0, length = elems.length; i < length; i++) {
                    elems[i].addEventListener('click', onNextPageClick);
                }

                elems = tabContent.querySelectorAll('.btnPreviousPage');
                for (i = 0, length = elems.length; i < length; i++) {
                    elems[i].addEventListener('click', onPreviousPageClick);
                }

                if (!result.Items.length) {
                    html = '';

                    html += '<div class="noItemsMessage centerMessage">';
                    html += '<h1>' + globalize.translate('MessageNothingHere') + '</h1>';
                    html += '<p>' + globalize.translate('MessageNoCollectionsAvailable') + '</p>';
                    html += '</div>';
                }

                var itemsContainer = tabContent.querySelector('.itemsContainer');
                itemsContainer.innerHTML = html;
                imageLoader.lazyChildren(itemsContainer);
                libraryBrowser.saveQueryValues(getSavedQueryKey(page), query);
                loading.hide();
                isLoading = false;

                require(['autoFocuser'], function (autoFocuser) {
                    autoFocuser.autoFocus(page);
                });
            });
        }

        var self = this;
        var data = {};
        var isLoading = false;

        self.getCurrentViewStyle = function () {
            return getPageData(tabContent).view;
        };

        function initPage(tabContent) {
            tabContent.querySelector('.btnSort').addEventListener('click', function (e) {
                libraryBrowser.showSortMenu({
                    items: [{
                        name: globalize.translate('OptionNameSort'),
                        id: 'SortName'
                    }, {
                        name: globalize.translate('OptionImdbRating'),
                        id: 'CommunityRating,SortName'
                    }, {
                        name: globalize.translate('OptionDateAdded'),
                        id: 'DateCreated,SortName'
                    }, {
                        name: globalize.translate('OptionParentalRating'),
                        id: 'OfficialRating,SortName'
                    }, {
                        name: globalize.translate('OptionReleaseDate'),
                        id: 'PremiereDate,SortName'
                    }],
                    callback: function () {
                        getQuery(tabContent).StartIndex = 0;
                        reloadItems(tabContent);
                    },
                    query: getQuery(tabContent),
                    button: e.target
                });
            });
            var btnSelectView = tabContent.querySelector('.btnSelectView');
            btnSelectView.addEventListener('click', function (e) {
                libraryBrowser.showLayoutMenu(e.target, self.getCurrentViewStyle(), 'List,Poster,PosterCard,Thumb,ThumbCard'.split(','));
            });
            btnSelectView.addEventListener('layoutchange', function (e) {
                var viewStyle = e.detail.viewStyle;
                getPageData(tabContent).view = viewStyle;
                libraryBrowser.saveViewSetting(getSavedQueryKey(tabContent), viewStyle);
                getQuery(tabContent).StartIndex = 0;
                onViewStyleChange();
                reloadItems(tabContent);
            });
            tabContent.querySelector('.btnNewCollection').addEventListener('click', function () {
                require(['collectionEditor'], function (collectionEditor) {
                    var serverId = ApiClient.serverInfo().Id;
                    new collectionEditor.showEditor({
                        items: [],
                        serverId: serverId
                    });
                });
            });
        }

        initPage(tabContent);
        onViewStyleChange();

        self.renderTab = function () {
            reloadItems(tabContent);
        };

        self.destroy = function () {};
    };
});
