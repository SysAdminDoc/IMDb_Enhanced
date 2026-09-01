    // #########################################################################
    //
    //  CLEANUP FEATURES
    //
    // #########################################################################

    reg({
        key: 'removeAds', name: t('feature_removeAds_name'), group: 'Cleanup',
        init() { injectEarlyAdShell(); },
        destroy() {
            if (get('removeAds')) return;
            removeCSS('enh-early-ad-shell');
            setAdRequestBlocking(false);
        }
    });

    reg({
        key: 'removeProUpsell', name: t('feature_removeProUpsell_name'), group: 'Cleanup',
        css: `[data-testid="hero-subnav-bar-imdb-pro-link"],[data-testid="hero-proupsell"],
            a[href*="pro.imdb.com"],[class*="ProUpsell"],[class*="proupsell"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-proUpsell'); },
        destroy() { removeCSS('enh-proUpsell'); }
    });

    reg({ key: 'removeNewsSection', name: t('feature_removeNewsSection_name'), group: 'Cleanup',
        css: `section[data-testid="News"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-news'); }, destroy() { removeCSS('enh-news'); } });

    reg({ key: 'removeRelatedInterests', name: t('feature_removeRelatedInterests_name'), group: 'Cleanup',
        css: `section[data-testid="RelatedInterests"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-relInt'); }, destroy() { removeCSS('enh-relInt'); } });

    reg({ key: 'removeContribution', name: t('feature_removeContribution_name'), group: 'Cleanup',
        css: `section[data-testid="contribution"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-contrib'); }, destroy() { removeCSS('enh-contrib'); } });

    reg({ key: 'removeSponsoredRecs', name: t('feature_removeSponsoredRecs_name'), group: 'Cleanup',
        css: `[cel_widget_id*="Sponsored"],[class*="Sponsored"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-sponsRecs'); }, destroy() { removeCSS('enh-sponsRecs'); } });

    /* IE-115: the featured review slot puts one stranger's opinion above the fold, and
       which one is not a choice anybody made — IMDb has a help article about it because
       people write in when it is a bad one. This hides the review cards and nothing else:
       the "User reviews" heading, the count and the link through to all of them stay
       exactly where they were, so the section is still a way into the reviews rather than
       a hole where one used to be.

       The cards are matched as review cards, by the element reviews are marked up with
       and by IMDb's own testid for them. Neither is text matching, and either alone is
       enough. */
    reg({ key: 'removeFeaturedReview', name: t('feature_removeFeaturedReview_name'), group: 'Cleanup',
        css: `section[data-testid="UserReviews"] article,`
            + `section[data-testid="UserReviews"] [data-testid*="review-card"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-featuredReview'); }, destroy() { removeCSS('enh-featuredReview'); } });

    reg({ key: 'removeAppBanner', name: t('feature_removeAppBanner_name'), group: 'Cleanup',
        css: `.footer__app,.imdb-footer__open-in-app-button,[class*="AppBanner"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-appBanner'); }, destroy() { removeCSS('enh-appBanner'); } });

    // #########################################################################
    //
    //  THEME SYSTEM
    //
    // #########################################################################

