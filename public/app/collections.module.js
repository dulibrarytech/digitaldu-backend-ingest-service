/**

 Copyright 2024 University of Denver

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

const collectionsModule = (function () {

    'use strict';

    let obj = {};
    const nginx_path = '/ingester';

    /**
     * Gets collections
     */
    async function get_collections() {

        try {

            const key = helperModule.getParameterByName('api_key');
            const url = nginx_path + '/api/v1/collections?api_key=' + key;
            const response = await httpModule.req({
                method: 'GET',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data;
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
        }
    }

    /**
     * Displays collections
     */
    async function display_collections() {

        try {

            const collections = await get_collections();
            let html = `<option value="0">Select a top level collection</option>`;

            for (let i=0;i<collections.length;i++) {

                const json = JSON.parse(collections[i].mods);

                if (collections[i].is_member_of_collection === 'codu:root') {
                    html += `<option value="${collections[i].pid}">${json.title}</option>`;
                } else {
                    html += `<option value="${collections[i].pid}">${json.title} <small>(sub-collection)</small></option>`;
                }
            }

            document.querySelector('#collections').innerHTML = html;

        } catch (error) {
            console.log(error.message);
        }
    }

    /**
     * Adds collection
     */
    obj.add_collection = function () {

        domModule.hide('#collection-form');
        domModule.html('#message', '<div class="alert alert-info"><i class=""></i> Creating Repository Collection...</div>');

        return false;


        let collection_uri = document.querySelector('#uri').value; // getCollectionFormData();
        let obj = {};

        /*
        // let arr = collection.split('&');

        for (let i=0;i<arr.length;i++) {
            let propsVal = decodeURIComponent(arr[i]).split('=');
            obj[propsVal[0]] = propsVal[1];
        }

         */

        let token = window.sessionStorage.getItem('repo_token'); // userModule.getUserToken();
        let url = api + endpoints.repo_object;

        /* TODO: axiosjs
            request = new Request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify(obj),
                mode: 'cors'
            });

        const callback = function (response) {

            if (response.status === 201) {

                response.json().then(function (data) {
                    domModule.html('#message', '<div class="alert alert-success">Collection created ( <a href="' + configModule.getApi() + '/dashboard/objects/?pid=' + DOMPurify.sanitize(data[0].pid) + '">' + DOMPurify.sanitize(data[0].pid) + '</a> )');
                    domModule.hide('#collection-form');
                });

                return false;

            } else if (response.status === 401) {

                response.json().then(function (response) {

                    helperModule.renderError('Error: (HTTP status ' + response.status + '). Your session has expired.  You will be redirected to the login page momentarily.');

                    setTimeout(function () {
                        window.location.replace('/repo');
                    }, 4000);
                });

            } else if (response.status === 200) {

                domModule.html('#message', '<div class="alert alert-warning">This collection object is already in the repository.</div>');
                domModule.show('#collection-form');

                setTimeout(function () {
                    domModule.html('#message', null);
                }, 5000);

            } else if (response.status === 403) {
                authModule.refresh_token();
            } else {
                helperModule.renderError('Error: (HTTP status ' + response.status + ').  Unable to add collection.');
            }
        };

        httpModule.req(request, callback);

         */
    };

    /**
     * Gets collection form data
     */
    /*
    const get_collection_form_data = function () {
        return domModule.serialize('#collection-form');
    };

     */

    /**
     * Enable validation on add collection form
     */
    /*
    obj.collectionFormValidation = function () {

        document.addEventListener('DOMContentLoaded', function() {
            $('#collection-form').validate({
                submitHandler: function () {
                    addCollection();
                }
            });
        });
    };

     */

    /**
     * Gets collection name
     * @param pid
     */
    obj.getCollectionName = function (pid) {

        if (pid === null) {
            return false;
        }

        if (pid === undefined) {
            let pid = helperModule.getParameterByName('pid');
        }

        // used add collection form
        if (helperModule.getParameterByName('is_member_of_collection') !== null && helperModule.getParameterByName('is_member_of_collection') === configModule.getRootPid()) {
            domModule.html('#collection-type', 'Add top-level collection');
            return false;
        } else if (helperModule.getParameterByName('is_member_of_collection') !== null && helperModule.getParameterByName('is_member_of_collection') !== configModule.getRootPid()) {
            domModule.html('#collection-type', 'Add sub-level collection');
        }

        let token = userModule.getUserToken();
        let url = api + endpoints.repo_object + '?pid=' + pid,
            request = new Request(url, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

        const callback = function (response) {

            if (response.status === 200) {

                response.json().then(function (data) {

                    if (data.length === 0) {
                        return domModule.html('#message', '<div class="alert alert-info"><i class="fa fa-info-circle"></i> Collection name not found.</div>');
                    }

                    let record = JSON.parse(data[0].display_record);
                    let title = 'No title.';

                    if (record.title !== undefined) {
                        title = record.title;
                    }

                    domModule.html('#collection-name', DOMPurify.sanitize(title));
                });

            } else if (response.status === 401) {

                helperModule.renderError('Error: (HTTP status ' + response.status + '). Your session has expired.  You will be redirected to the login page momentarily.');

                setTimeout(function () {
                    window.location.replace('/repo');
                }, 4000);

            } else {
                helperModule.renderError('Error: (HTTP status ' + response.status + '). Unable to retrieve collection name.');
            }
        };

        httpModule.req(request, callback);
    };

    /**
     * Sets collection pid in collection form (hidden field)
     */
    obj.getIsMemberOfCollection = function () {
        let is_member_of_collection = helperModule.getParameterByName('is_member_of_collection');
        domModule.val('#is-member-of-collection', is_member_of_collection);
        collectionsModule.getCollectionName(is_member_of_collection);
    };

    obj.init = async function () {
        await display_collections();
        document.querySelector('#add-collection-button').addEventListener('click', collectionsModule.add_collection)
    };

    return obj;

}());

(async function() {
    await collectionsModule.init();
})();
