/**

 Copyright 2023 University of Denver

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

const ingestModule = (function () {

    'use strict';

    let obj = {};
    const nginx_path = '/ingester';

    /**
     * Displays collection packages
     */
    async function display_packages() {

        try {

            // TODO: check if ingest is in progress
            window.localStorage.clear();
            const api_key = helperModule.getParameterByName('api_key');
            const job_uuid = helperModule.getParameterByName('job_uuid');
            const id = helperModule.getParameterByName('id');
            const name = helperModule.getParameterByName('name');
            let records;

            // gets single record by job uuid
            if (job_uuid !== null && job_uuid.length > 0) {
                window.localStorage.setItem('job_uuid', job_uuid);
                records = await jobsModule.get_active_job(job_uuid);
            } else { // gets all records in jobs that have been processed in MDO and metadata QA
                records = await jobsModule.get_ingest_jobs();
            }

            if (records.data.length === 0) {
                domModule.html('#message', '<div class="alert alert-info"><i class="fa fa-exclamation-circle"></i> No archival object folders are ready for <strong>Packaging and Ingesting</strong></div>');
                return false;
            }

            let html = '';

            for (let i = 0; i < records.data.length; i++) {

                let batch = records.data[i].result.batch;
                let key = batch + '_';

                if (batch.indexOf('new_') === -1 || batch.indexOf('-resources_') === -1) {
                    console.log('Removing ', batch);
                    continue;
                }

                window.localStorage.setItem(key, JSON.stringify(records.data[i].result));

                let package_list = '<ul>';

                for (let j = 0; j < records.data[i].result.packages.length; j++) {
                    package_list += '<li><small>' + records.data[i].result.packages[j].package + '</small></li>';
                }

                package_list += '</ul>';

                html += '<tr>';
                // workspace folder name
                html += '<td style="text-align: left;vertical-align: middle; width: 40%">';
                html += '<small>' + batch + '</small>';
                html += '</td>';
                // packages
                html += '<td style="text-align: left;vertical-align: middle; width: 25%">';
                html += package_list;
                html += '</td>';
                // package count
                html += '<td style="text-align: left;vertical-align: middle; width: 5%">';
                html += '<small>' + records.data[i].result.packages.length + '</small>';
                html += '</td>';
                // actions
                html += '<td style="text-align: center;vertical-align: middle; width: 20%">';
                html += '<a href="' + nginx_path + '/dashboard/ingest/status?batch=' + batch + '&api_key=' + api_key + '&id=' + id + '&name=' + name + '" type="button" class="btn btn-sm btn-default run-qa"><i class="fa fa-cogs"></i> <span>Start</span></a>';
                html += '</td>';
                html += '</tr>';
            }

            domModule.html('#packages', html);
            document.querySelector('#message').innerHTML = '';
            document.querySelector('.x_panel').style.visibility = 'visible';
            // document.querySelector('#digital-object-workspace-table').style.visibility = 'visible';

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    /**
     * Starts ingest process
     */
    obj.start_ingest = async function () {

        try {
            // TODO: confirm that archival objects are there
            const key = helperModule.getParameterByName('api_key');
            let batch = helperModule.getParameterByName('batch');
            let batch_ = batch + '_';
            let batch_i = JSON.parse(window.localStorage.getItem(batch_));
            let job_uuid = '000-000'

            if (batch_i !== null) {
                job_uuid = batch_i.job_uuid;
            }

            if (batch === null) {
                await status_checks();
                return false;
            }

            let message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; Starting Ingest...</strong></div>';
            domModule.html('#message', message);

            let url = nginx_path + '/api/v1/ingest?batch=' + batch + '&job_uuid=' + job_uuid + '&api_key=' + key;
            let response = await httpModule.req({
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {

                await jobsModule.update_job({
                    uuid: job_uuid,
                    job_run_by: JSON.parse(window.sessionStorage.getItem('ingest_user'))
                });

                await status_checks();
            }

        } catch(error) {
            let message = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; ' + error.message + '</strong></div>';
            domModule.html('#message', message);
        }
    };

    /**
     * Checks queue to determine ingest status
     */
    async function status_checks () {

        let message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; Checking ingest status...</strong></div>';
        domModule.html('#message', message);

        let status_timer = setInterval(async () => {

            let data = await get_ingest_status();
            let message = '';
            domModule.html('#message', '');

            if (data.length > 0) {

                for (let i=0;i<data.length;i++) {
                    if (data[i].error !== null && data[i].is_complete === 0) {
                        clearInterval(status_timer);
                        message = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; An ingest error occurred.</strong></div>';
                        break;
                    } else if (data[i].error === null && data[i].is_complete === 0) {
                        message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; An ingest is in progress.</strong></div>';
                    }
                }

                domModule.html('#message', message);
                display_status_records(data);
                return false;

            } else if (data.length === 0) {
                clearInterval(status_timer);
                document.querySelector('#ingest-status-table').style.visibility = 'hidden';
                let message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; No Ingests are currently in progress.</strong></div>';
                domModule.html('#message', message);
                domModule.html('#batch', '');
                return false;
            }

        }, 5000);
    }

    /**
     * Gets ingest status
     */
    async function get_ingest_status () {

        try {

            const key = helperModule.getParameterByName('api_key');
            let url = nginx_path + '/api/v1/ingest/status?api_key=' + key;

            let response = await httpModule.req({
                method: 'GET',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch(error) {
            let message = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; ' + error.message + '</strong></div>';
            domModule.html('#message', message);
        }
    }

    /**
     * Displays status records
     * @param data
     */
    function display_status_records(data) {

        try {

            document.querySelector('#ingest-status-table').style.visibility = 'visible';
            let html = '';

            for (let i=0;i<data.length;i++) {

                if (data[i].status !== 'PENDING') {
                    html += '<tr>';
                    html += '<td>' + data[i].batch + '</td>';
                    html += '<td>' + data[i].package + '</td>';
                    // html += '<td>' + data[i].batch_size + '</td>';
                    html += '<td>' + data[i].status + '</td>';
                    html += '<td>' + data[i].micro_service + '</td>';

                    if (data[i].error !== null) {
                        // TODO: loop through errors
                        html += '<td>' + data[i].error + '</td>';
                    } else {
                        html += '<td>NONE</td>';
                    }
                }

                html += '</tr>';
            }

            domModule.html('#batch', html);

        } catch(error) {
            let message = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; ' + error.message + '</strong></div>';
            domModule.html('#message', message);
        }
    }

    obj.update_job_run_by = async function () {

        const user_id = helperModule.getParameterByName('id');
        const name = helperModule.getParameterByName('name');

        if (user_id !== undefined && name !== undefined) {

            let user = JSON.parse(window.sessionStorage.getItem('ingest_user'));

            if (user === null) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Unable to get Ingest user information</div>');
                return false;
            }

            let profile = {
                uid: user_id,
                name: name,
                job_type: 'packaging_and_ingesting',
                run_date: new Date()
            };

            let exist = false;

            for (let i=0;i<user.length;i++) {
                if (user[i].job_type === 'packaging_and_ingesting') {
                    exist = true;
                }
            }

            if (exist === false) {
                user.push(profile);
                window.sessionStorage.setItem('ingest_user', JSON.stringify(user));
            }
        }
    };

    obj.init = async function () {
        // TODO: move to helper
        await ingestModule.update_job_run_by();
        await display_packages();
    };

    return obj;

}());

/**
 * Gets ingest packages
 */
/*
async function get_packages () {

    try {

        let data = await get_ingest_status();
        let ingest_status = false;

        for (let i=0;i<data.length;i++) {
            if (data[i].is_complete === 0) {
                ingest_status = true;
                break;
            }
        }

        if (ingest_status === true) {
            return false;
        }

        const key = helperModule.getParameterByName('api_key');
        let url = nginx_path + '/api/v1/ingest/packages?api_key=' + key;
        let response = await httpModule.req({
            method: 'GET',
            url: url,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            return response.data;
        }

    } catch(error) {
        let message = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; ' + error.message + '</strong></div>';
        domModule.html('#message', message);
    }
}
*/


/*
if (packages === false) {
    let message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; An ingest is in progress. Please try again later.</strong></div>';
    domModule.html('#message', message);
    document.querySelector('#import-table').style.visibility = 'hidden';
    return false;
}
*/

/*
if (packages === undefined) {
    html = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; Ingest service is not available.</strong></div>';
    domModule.html('#message', html);
    document.querySelector('#import-table').style.visibility = 'hidden';
    return false;
}
*/

/*
if (Object.keys(packages.result).length === 0) {
    html = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; There are no ingest packages ready for ingest.</strong></div>';
    domModule.html('#message', html);
    document.querySelector('#import-table').style.visibility = 'hidden';
    return false;
}

if (packages.errors.length > 0) {

    html = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; The collection folder contains errors.</strong></div>';

    // TODO
    console.log(packages.errors);

    for (let i=0;i<packages.errors.length;i++) {
        console.log(packages.errors[i]);
    }

    domModule.html('#packages', html);
    return false;
}

for (let prop in packages.result) {

    if (prop.indexOf('new_') === -1 || prop.indexOf('-resources_') === -1) {

        delete packages.result[prop];

        if (Object.keys(packages.result).length === 0) {
            html = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; There are no packages ready for ingest.</strong></div>';
            domModule.html('#message', html);
            document.querySelector('#import-table').style.visibility = 'hidden';
            return false;
        }

        continue;
    }

    html += '<tr>';
    // collection folder name
    html += '<td style="text-align: left;vertical-align: middle; width: 55%">';
    html += '<small>' + prop + '</small>';
    html += '</td>';
    // package count
    html += '<td style="text-align: left;vertical-align: middle; width: 15%">';
    html += '<small>' + packages.result[prop] + '</small>';
    html += '</td>';
    // Action button column
    html += '<td style="text-align: center;vertical-align: middle; width: 15%"><a href="' + nginx_path + '/dashboard/ingest/status?batch=' + prop + '&api_key=' + key + '" type="button" class="btn btn-sm btn-default run-qa"><i class="fa fa-cogs"></i> <span>Start</span></a></td>';
    html += '</tr>';
}

domModule.html('#packages', html);


};
*/