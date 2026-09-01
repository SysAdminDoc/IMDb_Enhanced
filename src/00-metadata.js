// ==UserScript==
// @name         IMDb Enhanced
// @namespace    https://github.com/SysAdminDoc
// @version      2.17.0
// @updateURL    https://raw.githubusercontent.com/SysAdminDoc/IMDb_Enhanced/main/IMDb_Enhanced.user.js
// @downloadURL  https://raw.githubusercontent.com/SysAdminDoc/IMDb_Enhanced/main/IMDb_Enhanced.user.js
// @description  Premium IMDb overhaul: cleaner pages, modern themes, refined score widgets, media library indicators, quick navigation, richer external links, TV tools, search shortcuts, and polished settings import/export
// @author       SysAdminDoc
// @match        https://www.imdb.com/title/*
// @match        https://www.imdb.com/name/*
// @match        https://www.imdb.com/*/title/*
// @match        https://www.imdb.com/*/name/*
// @match        https://www.imdb.com/user/*/watchlist*
// @match        https://www.imdb.com/list/*
// @match        https://www.imdb.com/chart/*
// @match        https://www.imdb.com/*/user/*/watchlist*
// @match        https://www.imdb.com/*/list/*
// @match        https://www.imdb.com/*/chart/*
// @match        https://www.imdb.com/find*
// @match        https://www.imdb.com/search/*
// @match        https://www.imdb.com/*/find*
// @match        https://www.imdb.com/*/search/*
// @match        https://www.imdb.com/
// @match        https://www.imdb.com/?*
// IMDb's own mobile host. Nothing here runs on it: the one thing this does there
// is send a desktop browser to the page it was actually looking for.
// @match        https://m.imdb.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_webRequest
// @grant        GM_registerMenuCommand
// @connect      www.rottentomatoes.com
// @connect      backend.metacritic.com
// @connect      letterboxd.com
// @connect      www.justwatch.com
// @connect      www.youtube.com
// @connect      query.wikidata.org
// @connect      api.themoviedb.org
// @connect      www.omdbapi.com
// @connect      graphql.anilist.co
// @connect      api.tvmaze.com
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-start
// @noframes
// @license      MIT
// ==/UserScript==

