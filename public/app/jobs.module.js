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

const jobsModule = (function () {

    'use strict';

    let obj = {};
    const nginx_path = '/ingester';
    const endpoint = '/api/v1/astools/jobs';

    obj.get_active_job = async function (job_uuid) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '?uuid=' + job_uuid + '&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                let record = [];
                let is_kalture = false;

                if (response.data.data[0].is_kaltura === 1) {
                    is_kalture = true;
                }

                let data = {
                    result: {
                        batch: response.data.data[0].batch_name,
                        packages: JSON.parse(response.data.data[0].packages),
                        is_kaltura: is_kalture
                    }
                };

                record.push(data);

                return {
                    data: record
                };
            }

        } catch (error) {
            console.log(error);
        }
    };

    obj.get_metadata_jobs = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '/metadata?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                if (response.data.data.length === 0) {
                    return response.data.data;
                }

                let record = [];
                let is_kaltura = false;

                if (response.data.data.length > 0) {

                    for (let i = 0; i < response.data.data.length; i++) {

                        if (response.data.data[i].is_kaltura === 1) {
                            is_kaltura = true;
                        }

                        record.push({
                            result: {
                                job_uuid: response.data.data[i].uuid,
                                batch: response.data.data[i].batch_name,
                                packages: JSON.parse(response.data.data[i].packages),
                                is_kaltura: is_kaltura
                            }
                        });
                    }

                    return {
                        data: record
                    };
                }
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    obj.update_job = async function (job) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'PUT',
                url: nginx_path + '/api/v1/astools/jobs?api_key=' + api_key,
                data: job,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                console.log('job updated');
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.init = async function () {

        try {

            window.localStorage.clear();
            document.querySelector('#message').innerHTML = '<div class="alert alert-info"><i class=""></i> Loading...</div>';
            await astoolsModule.display_workspace_packages();

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    return obj;

}());
