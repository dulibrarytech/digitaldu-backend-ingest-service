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
    obj.add_collection = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            let data = {};

            if (api_key === null) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Permission Denied</div>');
                return false;
            }

            if (document.querySelector('#sub_collection_uri').value.length > 0) {

                if (document.querySelector('#collections').value === '0') {
                    domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Select a top level collection</div>');
                    return false;
                }

                data.is_member_of_collection = document.querySelector('#parent').value;
                data.collection_uri = document.querySelector('#sub_collection_uri').value;
            } else {
                data.is_member_of_collection = document.querySelector('#parent').value;
                data.collection_uri = document.querySelector('#collection_uri').value;
            }

            if (data.collection_uri.length === 0) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Please enter a ArchivesSpace URI</div>');
                return false;
            }

            domModule.hide('#collection-forms');
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> Creating Repository Collection...</div>');

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/collections?api_key=' + api_key,
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 201) {
                domModule.html('#message', '<div class="alert alert-info"><i class=""></i> Collection created. (' + response.data.uuid + ')</div>');
                setTimeout(() => {
                    location.reload();
                }, 3000);
            }

            if (response.status === 200) {
                domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + response.data.message + '</div>');
                setTimeout(() => {
                    location.reload();
                }, 3000);
            }

        } catch(error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }

        return false;
    };

    /**
     * Sets collection pid in collection form (hidden field)
     */
    obj.getIsMemberOfCollection = function () {
        let is_member_of_collection = helperModule.getParameterByName('is_member_of_collection');
        domModule.val('#is-member-of-collection', is_member_of_collection);
        collectionsModule.getCollectionName(is_member_of_collection);
    };

    /**
     * Sets is member of collection uuid
     */
    function set_is_member_of_collection() {
        document.getElementById('parent').value = document.querySelector('#collections').value;
    }

    obj.init = async function () {
        await display_collections();
        document.querySelector('#add-collection-button').addEventListener('click', await collectionsModule.add_collection);
        document.querySelector('#collections').addEventListener('change', set_is_member_of_collection);
        document.querySelector('#add-sub-collection-button').addEventListener('click', await collectionsModule.add_collection);
    };

    return obj;

}());

(async function() {
    await collectionsModule.init();
})();
