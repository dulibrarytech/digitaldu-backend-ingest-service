/**

 Copyright 2025 University of Denver

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

const astoolsModule = (function () {

    'use strict';

    let obj = {};
    const nginx_path = '/ingester';

    obj.get_workspace_packages = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + '/api/v1/astools/workspace?api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.display_workspace_packages = async function () {

        try {

            const records = await astoolsModule.get_workspace_packages();
            console.log(records.data);
            let html = '';

            for (let i = 0; i < records.data.length; i++) {

                let batch = records.data[i].result.batch;
                let is_kaltura = records.data[i].result.is_kaltura;

                if (batch.indexOf('new_') === -1 || batch.indexOf('-resources_') === -1) {
                    console.log('Removing ', batch);
                    continue;
                }

                window.localStorage.setItem(batch, JSON.stringify(records.data[i].result));

                html += '<tr>';
                // workspace folder name
                html += '<td style="text-align: left;vertical-align: middle; width: 55%">';
                html += '<small>' + batch + '</small>';
                html += '</td>';
                // type
                html += '<td style="text-align: left;vertical-align: middle; width: 20%">';

                if (is_kaltura === true) {
                    html += '<small>Kaltura Items</small>';
                    html += `<input type="hidden" id="${batch}" value="true">`;
                } else {
                    html += '<small>Non Kaltura Items</small>';
                    html += `<input type="hidden" id="${batch}" value="false">`;
                }

                html += '</td>';
                // actions
                html += '<td style="text-align: center;vertical-align: middle; width: 35%">';
                html += '<a href="#" onclick="astoolsModule.make_digital_objects(\'' + batch + '\');" type="button" class="btn btn-sm btn-default run-qa"><i class="fa fa-cogs"></i> <span>Start</span></a>';
                html += '</td>';
                html += '</tr>';
            }

            domModule.html('#packages', html);
            const ks = await get_ks();
            window.localStorage.setItem('ks', ks);

            // TODO: check if items already have kaltura id?
            document.querySelector('#message').innerHTML = '';
            document.querySelector('.x_panel').style.visibility = 'visible';

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    async function get_ks() {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/kaltura/session?api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data.ks;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    async function get_entry_ids(data) {

        try {

            const ks = localStorage.getItem('ks');

            if (ks === null) {
                domModule.html('#message', '<div class="alert alert-info"><i class=""></i> Unable to get Kaltura session token.</div>');
                return false;
            }

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/kaltura/metadata?&session=' + ks,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: data
            });

            if (response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.make_digital_objects = async function (folder) {

        try {

            document.querySelector('.x_panel').style.visibility = 'hidden';
            const batch_data = window.localStorage.getItem(folder);

            if (batch_data === null || batch_data === undefined) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Unable to get batch data</div>');
                return false;
            }

            const json = JSON.parse(batch_data);
            const api_key = helperModule.getParameterByName('api_key');
            let is_kaltura = document.querySelector('#' + folder).value;
            let packages = [];
            let files = [];

            if (api_key === null) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Permission Denied</div>');
                return false;
            }

            // TODO
            if (is_kaltura === 'true') {

                domModule.html('#message', '<div class="alert alert-info"><i class=""></i> (' + folder + ') Retrieving Entry IDs from Kaltura...</div>');

                let  result = await get_entry_ids(json);
                let errors = [];

                for (let i=0; i < result.files.length; i++) {

                    if (result.files[i].message !== 'success') {
                        console.log(result.files[i]);
                        errors.push(i);
                    }
                }

                if (errors.length > 0) {

                    let message;

                    for (let j = 0; j < errors.length; j++) {

                        message = result.files[errors[j]].file + ' ' + result.files[errors[j]].message;

                        if (result.files[errors[j]].entry_id.length > 1) {
                            for (let k = 0; k < result.files[errors[j]].entry_id.length; k++) {
                                message += ' "' + result.files[errors[j]].entry_id[k] + '"';
                            }
                        }

                        domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + message + '</div>');
                    }

                    return false;
                }

                files = result.files;

            } else {
                // TODO
                for (let i=0; i < json.packages.length; i++) {
                    files.push(json.packages[i].files);
                }
            }

            const data = {
                'folder': folder,
                'packages': json.packages,
                'files': files,
                'is_kaltura': is_kaltura
            };

            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> Making digital objects...</div>');

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/astools/make-digital-objects?api_key=' + api_key,
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Digital objects created for "${folder}" batch</div>`);

                setTimeout(async () => {
                    domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Checking package updates for "${folder}" batch</div>`);
                    await check_uri_txt(folder);
                }, 3000);
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }

        return false;
    };

    async function check_uri_txt(folder) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Checking uri txt files for "${folder}" batch</div>`);

            const data = {
                'batch': folder
            };

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/astools/check-uri-txt?api_key=' + api_key,
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                if (response.data.data.errors.length > 0) {
                    domModule.html('#message', `<div class="alert alert-danger"><i class=""></i> "${response.data.data.errors.toString()}"</div>`);
                    return false;
                } else {
                    domModule.html('#message', `<div class="alert alert-info"><i class=""></i> ${folder} complete - Please proceed to Metadata QA page</div>`);
                }
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.init = async function () {

        try {

            document.querySelector('#message').innerHTML = '<div class="alert alert-info"><i class=""></i> Loading...</div>';
            await astoolsModule.display_workspace_packages();

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    return obj;

}());


/*
            document.querySelector('#digital-object-workspace-button').addEventListener('click', function () {
                save_credentials();
            });


            $('.aspace-login-modal').modal({
                backdrop: 'static',
                keyboard: false
            });

             */

/*
    function save_credentials() {

        try {

            const username = document.querySelector('#aspace-username').value;
            const password = document.querySelector('#aspace-password').value;

            if (username.length === 0 || password.length === 0) {
                document.getElementById('aspace-message').innerHTML = '<div class="alert alert-danger"><i class="fa fa-exclamation"></i> Please enter your credentials</div>';
            } else {
                $('.aspace-login-modal').modal('hide');
                document.getElementById('aspace-message').innerHTML = '';
                document.querySelector('#username').value = username;
                document.querySelector('#password').value = password;
            }

            return false;

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

     */

// TODO: deprecate - move to server side
/*
async function extract_entry_ids(json) {

    try {

        const package_name = json.package;
        const entry_ids = [];
        let pairs = [];

        if (json.files.length > 1) {

            let files = json.files;
            let timer = setInterval(async () => {

                if (files.length === 0) {

                    clearInterval(timer);

                    if (typeof entry_ids === 'object') {

                        let message = '';

                        for (let i=0; i<entry_ids.length; i++) {
                            message += 'Kaltura entry ID not found for ' + entry_ids[i].identifier + '<br>';
                        }

                        domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + message + '</div>');

                        setTimeout(() => {
                            document.querySelector('.x_panel').style.visibility = 'visible';
                        }, 3000);

                        return false;
                    }

                    return entry_ids;
                }

                let file_id_pair = {};
                let file = files.pop();
                let metadata = await get_ks_metadata(file);

                if (metadata.message === '0_0') {
                    entry_ids.push(metadata);
                } else {
                    entry_ids.push(metadata);
                    file_id_pair.package = package_name;
                    file_id_pair.file = file;
                    file_id_pair.entry_id = entry_ids.toString();
                    pairs.push(file_id_pair);
                    file_id_pair = {};
                }

            }, 1000);

        } else if (json.files.length === 1) {

            let file_id_pair = {};
            let file = json.files.pop();
            let metadata = await get_ks_metadata(package_name);
            let message;

            if (metadata.message === '0_0') {
                message = 'Kaltura entry ID not found for ' + metadata.identifier;
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + message + '</div>');
                setTimeout(() => {
                    document.querySelector('.x_panel').style.visibility = 'visible';
                }, 3000);
                return false;
            } else {
                entry_ids.push(await get_ks_metadata(package_name));
                file_id_pair.package = package_name;
                file_id_pair.file = file;
                file_id_pair.entry_id = entry_ids.toString();
                pairs.push(file_id_pair);
            }

            return pairs;
        }

    } catch (error) {
        domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
    }
}
*/

/*
    async function move_to_ready(folder) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Moving "${folder}" batch to ready folder...</div>`);

            const data = {
                'batch': folder
            };

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/astools/move-to-ready?api_key=' + api_key,
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                if (response.data.data.errors.length > 0) {
                    domModule.html('#message', `<div class="alert alert-danger"><i class=""></i> "${response.data.data.errors.toString()}"</div>`);
                    return false;
                } else {

                    domModule.html('#message', `<div class="alert alert-info"><i class=""></i> ${folder} complete </div>`);

                    setTimeout(async () => {
                        // const api_key = helperModule.getParameterByName('api_key');
                        // window.location.href = '/ingester/dashboard/ingest?api_key=' + api_key;
                    }, 1000)
                }
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }

     */

// TODO: deprecate
/*
async function get_ks_metadata_(identifier) {

    try {

        const ks = localStorage.getItem('ks');

        if (ks === null) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> Unable to get Kaltura session token.</div>');
            return false;
        }

        const response = await httpModule.req({
            method: 'GET',
            url: nginx_path + '/api/v1/kaltura/metadata?identifier=' + identifier + '&session=' + ks,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('response ', response);
        if (response.status === 200) {

            if (response.data.ks.objects.length === 0) {

                return {
                    identifier: identifier,
                    message: '0_0'
                };

            }

            // TODO
            const total_count = response.data.ks.objects[0].itemsData[0].totalCount;

            if (total_count === 1) {
                return response.data.ks.objects[0].object.id;
            } else {
                // TODO: handle multiple records
                console.log('test compound objects')
                console.log('compound', response.data.ks.objects);
            }
        }

    } catch (error) {
        domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
    }
}
*/