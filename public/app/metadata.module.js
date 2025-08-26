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

const metadataModule = (function () {

    'use strict';

    let obj = {};
    const nginx_path = '/ingester';

    // TODO: deprecate
    obj.get_metadata_check_batches = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + '/api/v1/astools/processed?api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {

                // get records that have not had metadata QA
                let jobs = await jobsModule.get_metadata_jobs();

                if (jobs === undefined || jobs.length === 0) {
                    jobs = {
                        data: []
                    }
                }

                return jobs;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.display_metadata_check_batches = async function () {

        try {

            window.localStorage.clear();
            const job_uuid = helperModule.getParameterByName('job_uuid');
            let records;
            // let collection_folders = [];

            // gets single record by job uuid
            if (job_uuid !== null && job_uuid.length > 0) {
                window.localStorage.setItem('job_uuid', job_uuid);
                records = await jobsModule.get_active_job(job_uuid);
            } else { // gets all records in jobs that have not had QA run on packages
                records = await jobsModule.get_metadata_jobs();
            }

            /*
            console.log(records);
            for (let i = 0; i < records.data.length; i++) {

                if (records.data[i].result.batch.indexOf('new_') === -1 || records.data[i].result.batch.indexOf('-resources_') === -1) {
                    console.log('Removing ', records.data[i].result.batch);
                } else {
                    collection_folders.push(records.data[i]);
                }
            }

             */

            if (records.data.length === 0) {
                domModule.html('#message', '<div class="alert alert-info"><i class="fa fa-exclamation-circle"></i> No archival object folders are ready for <strong>ArchivesSpace Descriptive QA</strong></div>');
                return false;
            }

            let html = '';

            for (let i = 0; i < records.data.length; i++) {

                let batch = records.data[i].result.batch;
                let key = batch + '_';

                window.localStorage.setItem(key, JSON.stringify(records.data[i].result));

                let package_list = '<ul>';

                for (let j = 0; j < records.data[i].result.packages.length; j++) {
                    package_list += '<li><small>' + records.data[i].result.packages[j].package + '</small></li>';
                }

                package_list += '</ul>';

                html += '<tr>';
                // workspace folder name
                html += '<td style="text-align: left;vertical-align: middle; width: 50%">';
                html += '<small>' + batch + '</small>';
                html += '</td>';
                // packages
                html += '<td style="text-align: left;vertical-align: middle; width: 25%">';
                html += package_list;
                html += '</td>';
                // actions
                html += '<td style="text-align: center;vertical-align: middle; width: 25%">';
                html += '<a href="#" onclick="metadataModule.get_packages(\'' + batch + '\');" type="button" class="btn btn-sm btn-default run-qa"><i class="fa fa-cogs"></i> <span>Start</span></a>';
                html += '</td>';
                html += '</tr>';
            }

            domModule.html('#packages', html);
            document.querySelector('#message').innerHTML = '';
            document.querySelector('.x_panel').style.visibility = 'visible';
            document.querySelector('#digital-object-workspace-table').style.visibility = 'visible';

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.get_packages = async function (batch) {

        try {

            if (batch === null || batch === undefined) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Unable to get packages</div>');
                return false;
            }

            const batch_ = JSON.parse(window.localStorage.getItem(batch + '_'));

            if (batch_ !== null) {

                let job_uuid = window.localStorage.getItem('job_uuid');

                if (job_uuid === null) {
                    job_uuid = batch_.job_uuid;
                    window.localStorage.setItem('job_uuid', job_uuid);
                }

                let packages = [];

                for (let i = 0; i < batch_.packages.length; i++) {
                    packages.push(batch_.packages[i].package);
                }

                domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Packages retrieved for "${batch}" batch</div>`);

                setTimeout(async () => {

                    document.querySelector('#digital-object-workspace-table').innerHTML = '';
                    await process_packages(batch, packages);
                }, 1000);

                return false;
            }

            /*
            const api_key = helperModule.getParameterByName('api_key');
            document.querySelector('#digital-object-workspace-table').innerHTML = '';
            // document.querySelector('#batch').innerHTML = `<em>Processing packages in ${batch}</em>`;

            if (api_key === null) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Permission Denied</div>');
                return false;
            }

            const data = {
                'batch': batch
            };

            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> Retrieving packages...</div>');

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/astools/packages?api_key=' + api_key,
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {
                console.log('packages response ', response);
                if (response.data.data.errors.length > 0) {
                    // TODO
                    console.log(response.data.data.errors);
                    return false;
                }

                const packages = response.data.data.result;
                domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Packages retrieved for "${batch}" batch</div>`);

                setTimeout(async () => {
                    await process_packages(batch, packages);
                }, 1000);
            }

             */

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }

        return false;
    };

    const process_packages = async function (batch, packages) {

        try {

            domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Starting metadata checks...</div>`);

            const timer = setInterval(async () => {

                if (packages.length === 0) {

                    clearInterval(timer);

                    let errors = window.localStorage.getItem(batch + '_m_errors');

                    if (errors !== null) {
                        domModule.html('#message', `<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ArchivesSpace description errors detected</div>`);
                        return false;
                    }

                    let job_uuid = window.localStorage.getItem('job_uuid');

                    if (job_uuid === null) {
                        domModule.html('#message', `<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> Unable to update QA job</div>`);
                        return false;
                    }

                    await jobsModule.update_job({
                        uuid: job_uuid,
                        is_metadata_checks_complete: 1
                    });

                    setTimeout(async () => {

                        domModule.html('#message', `<div class="alert alert-info"><i class=""></i> ArchivesSpace Description QA checks complete</div>`);

                        setTimeout(async () => {
                            const api_key = helperModule.getParameterByName('api_key');
                            window.location.href = nginx_path + '/dashboard/ingest?job_uuid=' + job_uuid + '&api_key=' + api_key;
                        }, 3000);

                    }, 2000);

                    return false;
                }

                let ingest_package = packages.pop();
                await check_metadata(batch, ingest_package);

            }, 4000);

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    const check_metadata = async function (batch, ingest_package) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const job_uuid = window.localStorage.getItem('job_uuid');
            const data = {
                'uuid': job_uuid,
                'batch': batch,
                'ingest_package': ingest_package
            };

            domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Checking metadata for "${ingest_package}"...</div>`);

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/astools/metadata?api_key=' + api_key,
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                document.querySelector('#metadata-workspace-table').style.visibility = 'visible';
                const metadata = response.data.data;
                const key = batch + '_m';
                let records;
                let list_exist = window.localStorage.getItem(key);
                let html = '';

                if (list_exist === null) {

                    records = await create_list(key, batch, ingest_package, metadata);
                    window.localStorage.setItem(key, JSON.stringify(records));

                    html += await create_table(records);
                    document.querySelector('#metadata-results').innerHTML = html;

                } else {

                    console.log('updating list');
                    records = await update_list(key, batch, ingest_package, metadata);
                    window.localStorage.setItem(key, JSON.stringify(records));

                    html += await create_table(records);
                    document.querySelector('#metadata-results').innerHTML = html;
                }
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }

    const create_list = async function (key, batch, ingest_package, data) {

        try {

            let records = [];
            let record = {}

            record.batch = batch;
            record.ingest_package = ingest_package;

            if (data.title !== undefined && data.title.length > 0) {
                record.title = data.title;
            }

            if (data.uri !== undefined && data.uri.length > 0) {
                record.uri = data.uri;
            }

            let errors = JSON.parse(data.errors);

            if (errors.length > 0) {

                let obj = {
                    package: ingest_package,
                    error: errors.toString()
                };

                let m_errors = key + '_errors';
                let metadata_errors = [];
                metadata_errors.push(obj);
                window.localStorage.setItem(m_errors, JSON.stringify(metadata_errors));
                record.errors = JSON.stringify(metadata_errors);

            } else {
                record.errors = false;
            }

            records.push(record);
            return records;

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    const update_list = async function (key, batch, ingest_package, data) {

        try {

            let records = JSON.parse(window.localStorage.getItem(key));
            let record = {};

            record.batch = batch;
            record.ingest_package = ingest_package;

            if (data.title !== undefined && data.title.length > 0) {
                record.title = data.title;
            } else {
                record.title = '-----';
            }

            if (data.uri !== undefined && data.uri.length > 0) {
                record.uri = data.uri;
            } else {
                record.uri = '-----';
            }

            let errors = JSON.parse(data.errors);

            if (errors.length > 0) {

                let obj = {
                    package: ingest_package,
                    error: errors.toString()
                };

                let m_errors = key + '_errors';
                let metadata_errors = [];
                metadata_errors.push(obj);
                window.localStorage.setItem(m_errors, JSON.stringify(metadata_errors));
                record.errors = JSON.stringify(metadata_errors);

            } else {
                record.errors = false;
            }

            records.unshift(record);
            return records;

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class="fa fa-exclamation"></i> ' + error.message + '</div>');
        }
    }

    const create_table = async function (records) {

        try {

            let html = '';

            for (let i = 0; i < records.length; i++) {

                html += '<tr>';
                // package
                html += '<td style="text-align: left;vertical-align: middle;">';
                html += '<small>' + records[i].ingest_package + '</small>';
                html += '</td>';

                // title
                html += '<td style="text-align: left;vertical-align: middle;">';

                if (records[i].title !== undefined && records[i].title.length > 0) {
                    html += '<small>' + records[i].title + '</small>';
                } else {
                    html += '<small>-----</small>';
                }

                html += '</td>';

                // uri
                html += '<td style="text-align: center;vertical-align: middle;">';

                if (records[i].uri !== undefined && records[i].uri.length > 0) {
                    html += '<small>' + records[i].uri + '</small>';
                } else {
                    html += '<small>-----</small>';
                }

                html += '</td>';

                // status
                html += '<td style="text-align: center;vertical-align: middle;">';

                if (records[i].errors !== false) {

                    let message = '';

                    if (records[i].errors.toString().indexOf('Record not found.') !== -1) {
                        message = 'Please check if record is cataloged in ArchivesSpace and/or the package has a uri.txt file.';
                    }

                    let metadata_errors = JSON.parse(records[i].errors);
                    html += '<small><i class="fa fa-exclamation-circle"></i> ' + metadata_errors[0].error + ' ' + message + '</small>';

                } else {
                    html += '<small><i class="fa fa-check"></i></small>';
                }

                html += '</td>';
                html += '</tr>';
            }

            return html;

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    obj.init = async function () {

        try {

            document.querySelector('#message').innerHTML = '<div class="alert alert-info"><i class=""></i> Loading...</div>';
            await metadataModule.display_metadata_check_batches();

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    return obj;

}());
