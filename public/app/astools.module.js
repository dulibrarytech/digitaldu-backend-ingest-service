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
            let html = '';
            let collection_folders = [];

            for (let i = 0; i < records.data.length; i++) {

                if (records.data[i].result.batch.indexOf('new_') === -1 || records.data[i].result.batch.indexOf('-resources_') === -1) {
                    console.log('Removing ', records.data[i].result.batch);
                } else {
                    collection_folders.push(records.data[i]);
                }
            }

            if (collection_folders.length === 0) {
                domModule.html('#message', '<div class="alert alert-info"><i class="fa fa-exclamation-circle"></i> No collection folders are ready</div>');
                return false;
            }

            records.data = collection_folders;

            for (let i = 0; i < records.data.length; i++) {

                let batch = records.data[i].result.batch;
                let is_kaltura = records.data[i].result.is_kaltura;

                window.localStorage.setItem(batch, JSON.stringify(records.data[i].result));

                let package_list = '<ul>';

                for (let j = 0; j < records.data[i].result.packages.length; j++) {
                    package_list += '<li><small>' + records.data[i].result.packages[j].package + '</small></li>';
                }

                package_list += '</ul>';

                html += '<tr>';
                // workspace folder name
                html += '<td style="text-align: left;vertical-align: middle; width: 55%">';
                html += '<small>' + batch + '</small>';
                html += '</td>';

                // archival object folders
                html += '<td style="text-align: left;vertical-align: middle; width: 35%">';
                html += package_list;
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

            document.querySelector('#message').innerHTML = '';
            document.querySelector('#digital-object-workspace-table').style.visibility = 'visible';

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
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

    obj.make_digital_objects = async function (batch) {

        try {

            document.querySelector('#digital-object-workspace-table').style.visibility = 'hidden';
            const batch_data = window.localStorage.getItem(batch);

            if (batch_data === null || batch_data === undefined) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Unable to get batch data</div>');
                return false;
            }

            const job_uuid = self.crypto.randomUUID();
            const json = JSON.parse(batch_data);
            const api_key = helperModule.getParameterByName('api_key');
            let is_kaltura = document.querySelector('#' + batch).value;
            let files = [];

            if (api_key === null) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Permission Denied</div>');
                return false;
            }

            let ingest_user = JSON.parse(window.sessionStorage.getItem('ingest_user'));

            if (is_kaltura === 'true') {
                is_kaltura = 1;
            } else {
                is_kaltura = 0;
            }

            const job = {
                uuid: job_uuid,
                job_type: 'make_digital_objects',
                batch_name: batch,
                packages: json.packages,
                is_kaltura: is_kaltura,
                log: '---',
                error: '---',
                job_run_by: ingest_user[0].name
            };

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/astools/jobs?api_key=' + api_key,
                data: job,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {
                console.log('RESPONSE ', response);
            }

            if (is_kaltura === 1) {

                domModule.html('#message', '<div class="alert alert-info"><i class=""></i> (' + batch + ') Retrieving Entry IDs from Kaltura...</div>');
                await get_entry_ids(json);
                let timer = setInterval(async () => {

                    let response = await jobsModule.check_make_digital_objects_ks_queue();

                    if (response.data.length === 0) {

                        clearInterval(timer);
                        console.log('done');

                        setTimeout(async () => {

                            // get ks pairs
                            let ids = await jobsModule.get_ks_entry_ids();
                            let files = [];
                            let errors = [];
                            for (let i = 0; i < ids.data.length; i++) {

                                if (ids.data[i].status !== 1) {
                                    errors.push({
                                        status: ids.data[i].status,
                                        file: ids.data[i].file,
                                        message: ids.data[i].message,
                                        entry_id: ids.data[i].entry_id
                                    });
                                } else {
                                    files.push({
                                        status: ids.data[i].status,
                                        file: ids.data[i].file,
                                        message: ids.data[i].message,
                                        entry_id: ids.data[i].entry_id
                                    });
                                }
                            }

                            if (errors.length > 0) {
                                let error = '';
                                for (let i = 0; i < errors.length; i++) {
                                    error += `${errors[i].file} ${errors[i].message}`;
                                    if (errors[i].status === 2) {
                                        let id_errors = JSON.parse(errors[i].entry_id);
                                        error += ` EntryIDs ${id_errors.toString()}`;
                                    }
                                }

                                await jobsModule.update_job({
                                    uuid: job_uuid,
                                    is_complete: 2
                                });

                                domModule.html('#message', `<div class="alert alert-danger"><i class=""></i>${error}</div>`);

                            } else {
                                await make_digital_objects_init(job_uuid, batch, json, files, is_kaltura);
                            }

                            await jobsModule.clear_ks_queue();

                        }, 5000);

                        return false;
                    }

                }, 2500);

                return false;

            } else {

                for (let i = 0; i < json.packages.length; i++) {
                    files.push(json.packages[i].files);
                }

                await make_digital_objects_init(job_uuid, batch, json, files, is_kaltura);
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }

        return false;
    };

    async function make_digital_objects_init(job_uuid, batch, json, files, is_kaltura) {

        // data used to create job record
        const data = {
            'batch': batch,
            'packages': json.packages,
            'files': files,
            'is_kaltura': is_kaltura
        };

        domModule.html('#message', '<div class="alert alert-info"><i class=""></i> Making digital objects...</div>');
        const api_key = helperModule.getParameterByName('api_key');
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

            domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Digital objects created for "${batch}" batch</div>`);

            let log = response.data.data;
            let error = response.data.data.search('Error:');

            if (error !== -1) {
                error = log;
            } else {
                error = '-----'
            }

            await jobsModule.update_job({
                uuid: job_uuid,
                log: response.data.data,
                error: error
            });

            setTimeout(async () => {
                domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Checking package updates for "${batch}" batch</div>`);
                await check_uri_txt(batch, job_uuid);
            }, 3000);
        }
    }

    // confirms that a uri.txt file was created in the packages
    async function check_uri_txt(batch, job_uuid) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Checking uri txt files for "${batch}" batch</div>`);

            const data = {
                'batch': batch
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

                    await jobsModule.update_job({
                        uuid: job_uuid,
                        is_complete: 2
                    });

                    return false;

                } else {

                    await jobsModule.update_job({
                        uuid: job_uuid,
                        is_complete: 1
                    });

                    domModule.html('#message', `<div class="alert alert-info"><i class=""></i> ${batch} <strong>successful</strong></div>`);

                    const batch_ = JSON.parse(window.localStorage.getItem(batch));
                    const job_uuid_m = self.crypto.randomUUID();
                    window.localStorage.setItem('job_uuid', job_uuid_m);

                    let packages = [];

                    for (let i = 0; i < batch_.packages.length; i++) {
                        packages.push(batch_.packages[i].package);
                    }

                    domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Packages retrieved for "${batch}" batch</div>`);

                    let ingest_user = JSON.parse(window.sessionStorage.getItem('ingest_user'));

                    const job = {
                        uuid: job_uuid_m,
                        job_type: 'archivesspace_description_qa',
                        batch_name: batch,
                        packages: batch_.packages,
                        is_kaltura: batch_.is_kaltura,
                        log: '---',
                        error: '---',
                        job_run_by: ingest_user[0].name
                    }

                    const response = await httpModule.req({
                        method: 'POST',
                        url: nginx_path + '/api/v1/astools/jobs?api_key=' + api_key,
                        data: job,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        timeout: 600000
                    });

                    if (response.status === 200) {
                        console.log('RESPONSE ', response);
                    }

                    setTimeout(() => {
                        window.location.reload();
                    }, 5000);
                }
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.init = async function () {

        try {

            window.localStorage.clear();
            window.sessionStorage.clear();
            document.querySelector('#message').innerHTML = '<div class="alert alert-info"><i class=""></i> Loading...</div>';
            await astoolsModule.display_workspace_packages();

            const user_id = helperModule.getParameterByName('id');
            const name = helperModule.getParameterByName('name');

            if (user_id !== undefined && name !== undefined) {

                let profile = [];

                profile.push({
                    uid: user_id,
                    name: name,
                    job_type: 'make_digital_objects',
                    run_date: new Date()
                });

                window.sessionStorage.setItem('ingest_user', JSON.stringify(profile));

            } else {
                console.log(window.sessionStorage.getItem('ingest_user'));
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    return obj;

}());
