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

    /**
     * Starts ingest process
     */
    obj.start_ingest = async function () {

        try {

            let batch = helperModule.getParameterByName('batch');

            if (batch === null) {
                await status_checks();
                return false;
            }

            let message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; Starting Ingest...</strong></div>';
            domModule.html('#message', message);

            let url = '/api/v1/ingest?batch=' + batch;
            let response = await httpModule.req({
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                    // 'x-access-token': token
                }
            });

            if (response.status === 200) {
                await status_checks();
            }

        } catch(error) {
            console.log(error);
        }
    };

    async function status_checks () {

        let message = '<div class="alert alert-info"><strong><i class="fa fa-info-circle"></i>&nbsp; Checking ingest status...</strong></div>';
        domModule.html('#message', message);

        let status_timer = setInterval(async () => {

            let data = await get_ingest_status();
            domModule.html('#message', '');
            console.log('data ', data);
            if (data.length === 0 && data[0].error === '[]') {
                clearInterval(status_timer);
                document.querySelector('#ingest-status-table').style.visibility = 'hidden';
                let message = '<div class="alert alert-success"><strong><i class="fa fa-info-circle"></i>&nbsp; No Ingests in progress.</strong></div>';
                domModule.html('#message', message);
                domModule.html('#batch', '');
                return false;
            } else {
                // error
                clearInterval(status_timer);
            }

            domModule.html('#message', '');
            display_status_records(data);

        }, 5000);
    }

    /**
     * Gets ingest status
     */
    async function get_ingest_status () {

        try {

            let url = '/api/v1/ingest/status';
            let response = await httpModule.req({
                method: 'GET',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                    // 'x-access-token': token
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch(error) {
            console.log(error);
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
                if (data[i].error !== '[]') {
                    html += '<td>' + data[i].error + '</td>';
                } else {
                    html += '<td>None</td>';
                }

                html += '</tr>';
            }

            domModule.html('#batch', html);

        } catch(error) {
            console.log(error);
        }
    }

    /**
     * Gets ingest packages
     */
    async function get_packages () {

        try {

            let url = '/api/v1/ingest/packages';
            let response = await httpModule.req({
                method: 'GET',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                    // 'x-access-token': token
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch(error) {
            console.log(error);
        }
    }

    /**
     * Displays collection packages
     */
    async function display_packages() {

        const packages = await get_packages();
        let html = '';

        if (packages.length === 0) {
            html = '<div class="alert alert-danger"><strong><i class="fa fa-exclamation-circle"></i>&nbsp; Ingest service is not available.</strong></div>';
            domModule.html('#message', html);
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
            html += '<td style="text-align: center;vertical-align: middle; width: 15%"><a href="/dashboard/ingest/status?batch=' + prop + '" type="button" class="btn btn-sm btn-default run-qa"><i class="fa fa-cogs"></i> <span>Start</span></a></td>';
            html += '</tr>';
        }

        domModule.html('#packages', html);
    }

    obj.init = async function () {
        await display_packages();
    };

    return obj;

}());
