/**

 Copyright 2019 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

const helperModule = (function () {

    'use strict';

    const nginx_path = '/ingester';
    let obj = {};

    /**
     * Renders error message
     * @param message
     */
    obj.renderError = function (message) {
        domModule.html('#message', '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ' + DOMPurify.sanitize(message) + '</div>');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return false;
    };

    /**
     * Renders progress bar and spinner when pages load
     */
    const npProgress = function () {

        if (typeof NProgress != 'undefined') {
            $(document).ready(function () {
                NProgress.start();
            });

            $(window).load(function () {
                NProgress.done();
            });
        }
    };

    /**
     * Gets url parameter
     * @param name
     * @param url
     * @returns {*}
     */
    obj.getParameterByName = function (name, url) {

        if (!url) {
            url = window.location.href;
        }

        name = name.replace(/[\[\]]/g, "\\$&");

        let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);

        if (!results) {
            return null;
        }

        if (!results[2]) {
            return '';
        }

        return decodeURIComponent(DOMPurify.sanitize(results[2].replace(/\+/g, " ")));
    };

    /** TODO move to nav module
     * Sets api key in menu item links
     */
    function set_api_key() {
        const key = helperModule.getParameterByName('api_key');
        const id = helperModule.getParameterByName('id');
        const name = helperModule.getParameterByName('name');
        document.querySelector('#workspace').href = nginx_path + '/dashboard/workspace?api_key=' + key + '&id=' + id + '&name=' + name;
        document.querySelector('#metadata').href = nginx_path + '/dashboard/metadata?api_key=' + key + '&id=' + id + '&name=' + name;
        document.querySelector('#ingest').href = nginx_path + '/dashboard/ingest?api_key=' + key + '&id=' + id + '&name=' + name;
        document.querySelector('#workspace').href = nginx_path + '/dashboard/workspace?api_key=' + key + '&id=' + id + '&name=' + name;
        document.querySelector('#ingest-status').href = nginx_path + '/dashboard/ingest/status?api_key=' + key + '&id=' + id + '&name=' + name;
        // document.querySelector('#add-collections').href = nginx_path + '/dashboard/collections?api_key=' + key;
    }

    obj.alert_user = function (event) {
        event.preventDefault();
        return false;
    };

    /**
     * Makes content visible only after it is fully rendered on page
     * @param selector
     * @param timeout
     */
    obj.onLoadVisibility = function (selector, timeout) {

        document.addEventListener("DOMContentLoaded", function() {

            setTimeout(function() {

                if (document.querySelector(selector) !== null) {
                    document.querySelector(selector).style.visibility = 'visible';
                }

            }, timeout);
        });
    };

    obj.init = function () {
        npProgress();
        set_api_key();
    };

    return obj;

}());

helperModule.init();