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

    obj.get_workspace_batches = async function () {

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

    obj.display_workspace_batches = async function () {

        try {

            window.localStorage.clear();
            const records = await metadataModule.get_workspace_batches();
            let html = '';

            for (let i = 0; i < records.data.length; i++) {

                let batch = records.data[i].result.batch;
                window.localStorage.setItem(batch, JSON.stringify(records.data[i].result));

                html += '<tr>';
                // workspace folder name
                html += '<td style="text-align: left;vertical-align: middle; width: 75%">';
                html += '<small>' + batch + '</small>';
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

            document.querySelector('#digital-object-workspace-table').innerHTML = '';
            document.querySelector('#batch').innerHTML = `<em>Processing packages in ${batch}</em>`;

            if (batch === null || batch === undefined) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Unable to get packages</div>');
                return false;
            }

            const api_key = helperModule.getParameterByName('api_key');

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

                if (response.data.data.errors.length > 0) {
                    console.log(response.data.data.errors);
                    return false;
                }

                const packages = response.data.data.result;
                domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Packages retrieved for "${batch}" batch</div>`);

                setTimeout(async () => {
                    await process_packages(batch, packages);
                }, 1000);
            }

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
                    // TODO: override message if no file is found // - Please proceed to Ingest Packages
                    domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Metadata checks complete </div>`);
                    return false;
                }

                let ingest_package = packages.pop();
                await check_metadata(batch, ingest_package);

            }, 5000);

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    const check_metadata = async function (batch, ingest_package) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const data = {
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
                const data = response.data.data;
                const key = batch + '_m';
                let list_exist = window.localStorage.getItem(key);

                if (list_exist === null || list_exist === undefined) {
                    await create_list(key, batch, ingest_package, data);
                } else {
                    await update_list(key, batch, ingest_package, data);
                }

                let records = JSON.parse(window.localStorage.getItem(key));
                let html = '';
                html += await create_table(records);

                document.querySelector('#metadata-results').innerHTML = html;
                document.querySelector('#batch').innerHTML = batch;
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
            } else {
                // record.title = '-----';
            }

            if (data.uri !== undefined && data.uri.length > 0) {
                record.uri = data.uri;
            } else {
                // record.uri = '-----';
            }

            if (data.errors !== undefined && data.errors.length > 0) {
                record.errors = data.errors;
            } else {
                record.errors = false;
            }

            records.push(record);
            window.localStorage.setItem(key, JSON.stringify(records));

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

            if (data.errors !== undefined && data.errors.length > 0) {
                record.errors = data.errors;
            } else {
                record.errors = false;
            }

            records.unshift(record);
            window.localStorage.setItem(key, JSON.stringify(records));

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

                    html += '<small><i class="fa fa-exclamation-circle"></i> ' + records[i].errors.toString() + ' ' + message +'</small>';

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
            await metadataModule.display_workspace_batches();

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    return obj;

}());
