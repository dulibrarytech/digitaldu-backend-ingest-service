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
                console.log(response.data.data);
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
                    return {
                        data: []
                    };
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

    obj.get_ingest_jobs = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '/ingest?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                if (response.data.data.length === 0) {
                    return {
                        data: []
                    };
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

    obj.get_jobs_history = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '/history?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                if (response.data.data.length === 0) {
                    return {
                        data: []
                    };
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
                                job_type: response.data.data[i].job_type,
                                batch: response.data.data[i].batch_name,
                                packages: JSON.parse(response.data.data[i].packages),
                                error: response.data.data[i].error,
                                log: response.data.data[i].log,
                                job_run_by: response.data.data[i].job_run_by,
                                job_date: response.data.data[i].job_date,
                                is_make_digital_objects_complete: response.data.data[i].is_make_digital_objects_complete,
                                is_metadata_checks_complete: response.data.data[i].is_metadata_checks_complete,
                                is_ingested: response.data.data[i].is_ingested,
                                is_complete: response.data.data[i].is_complete,
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

    obj.display_jobs_history = async function () {

        try {

            let records = await jobsModule.get_jobs_history();

            if (records.data.length === 0) {
                document.querySelector('.x_panel').style.display = 'none';
                domModule.html('#message', '<div class="alert alert-info"><i class="fa fa-exclamation-circle"></i> No jobs found</div>');
                return false;
            }

            let html = '';
            console.log(records);

            for (let i = 0; i < records.data.length; i++) {

                let status;

                /*
                let package_list = '<ul>';

                for (let j = 0; j < records.data[i].result.packages.length; j++) {
                    package_list += '<li><small>' + records.data[i].result.packages[j].package + '</small></li>';
                }

                package_list += '</ul>';
                */

                if (records.data[i].result.is_complete === 1) {
                    status = 'SUCCESSFUL';
                } else if (records.data[i].result.is_complete === 0) {
                    status = 'PENDING';
                } else if (records.data[i].result.is_complete === 2) {
                    status = 'FAILED';
                }

                html += '<tr>';

                // job uuid
                html += '<td style="vertical-align: middle;">';
                html += '<small>' + records.data[i].result.job_uuid + '</small>';
                html += '</td>';

                // job type
                html += '<td style="vertical-align: middle;">';
                html += '<small>' + records.data[i].result.job_type + '</small>';
                html += '</td>';

                // is complete
                html += '<td style="vertical-align: middle;">';
                html += '<small>' + status + '</small>';
                html += '</td>';

                // collection folder
                html += '<td style="vertical-align: middle;">';
                html += '<small>' + records.data[i].result.batch + '</small>';
                html += '</td>';

                // packages
                /*
                html += '<td style="text-align: left;vertical-align: middle; width: 20%">';
                html += package_list;
                html += '</td>';
                 */

                // jobs run by
                html += '<td style="vertical-align: middle;">';
                html += records.data[i].result.job_run_by;
                html += '</td>';
                html += '</tr>';
            }

            domModule.html('#jobs-history', html);

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.check_make_digital_objects_ks_queue = async function (batch) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + '/api/v1/kaltura/queue?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.get_ks_entry_ids = async function (batch) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + '/api/v1/kaltura/queue/entry_ids?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.clear_ks_queue = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/kaltura/queue/clear?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 204) {
                return response.data;
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
