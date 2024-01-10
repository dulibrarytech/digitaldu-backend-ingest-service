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
    let nginx_path = '/ingester';
    set_api_key();

    /**
     * Starts ingest process
     */
    obj.start_ingest = async function () {

        try {

            let batch = helperModule.getParameterByName('batch');
            const key = helperModule.getParameterByName('api_key');

            if (batch === null) {
                await status_checks();
                return false;
            }

            let message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; Starting Ingest...</strong></div>';
            domModule.html('#message', message);

            let url = nginx_path + '/api/v1/ingest?batch=' + batch + '&api_key=' + key;
            let response = await httpModule.req({
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
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
                        message = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; An ingest error occurred.</strong></div>';
                        break;
                    } else if (data[i].error === null && data[i].is_complete === 0) {
                        message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; An ingest is in progress.</strong></div>';
                    } else if (data[i].error === null && data[i].is_complete === 1) {
                        message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; No Ingests are currently in progress.</strong></div>';
                    }
                }

                clearInterval(status_timer);
                domModule.html('#message', message);
                display_status_records(data);
                return false;

            } else {
                clearInterval(status_timer);
                document.querySelector('#ingest-status-table').style.visibility = 'hidden';
                let message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; No Ingests are currently in progress.</strong></div>';
                domModule.html('#message', message);
                domModule.html('#batch', '');
                return false;
            }

        }, 7000);
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
                html += '<tr>';
                html += '<td>' + data[i].batch + '</td>';
                html += '<td>' + data[i].package + '</td>';
                html += '<td>' + data[i].batch_size + '</td>';
                html += '<td>' + data[i].status + '</td>';
                html += '<td>' + data[i].micro_service + '</td>';

                if (data[i].error !== null) {
                    // TODO: loop through errors
                    html += '<td>' + data[i].error + '</td>';
                } else {
                    html += '<td>NONE</td>';
                }

                html += '</tr>';
            }

            domModule.html('#batch', html);

        } catch(error) {
            let message = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; ' + error.message + '</strong></div>';
            domModule.html('#message', message);
        }
    }

    /**
     * Gets ingest packages
     */
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

    /**
     * Displays collection packages
     */
    async function display_packages() {

        const key = helperModule.getParameterByName('api_key');
        const packages = await get_packages();
        let html = '';

        if (packages === false) {
            let message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; An ingest is in progress. Please try again later.</strong></div>';
            domModule.html('#message', message);
            document.querySelector('#import-table').style.visibility = 'hidden';
            return false;
        }

        if (packages.length === 0) {
            html = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; Ingest service is not available.</strong></div>';
            domModule.html('#message', html);
            document.querySelector('#import-table').style.visibility = 'hidden';
            return false;
        }

        if (packages.errors.length > 0) {
            html = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; The collection folder contains errors.</strong></div>';

            console.log(packages.errors);

            for (let i=0;i<packages.errors.length;i++) {
                console.log(packages.errors[i]);
            }

            domModule.html('#packages', html);
            return false;
        }

        for (let prop in packages.result) {

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
    }

    /**
     * Sets api key in menu item links
     */
    function set_api_key() {
        const key = helperModule.getParameterByName('api_key');
        document.querySelector('#ingest').href = nginx_path + '/dashboard/ingest?api_key=' + key;
        document.querySelector('#ingest-status').href = nginx_path + '/dashboard/ingest/status?api_key=' + key;
    }

    obj.init = async function () {
        await display_packages();
    };

    return obj;

}());
