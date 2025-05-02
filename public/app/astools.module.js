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
                return response;
            }

        } catch (error) {
            console.log(error);
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    obj.display_workspace_packages = async function () {

        const records = await astoolsModule.get_workspace_packages();

        if (records.data.data.errors.length > 0) {
            console.log(records.data.data.errors);
            return false;
        }

        let html = '';

        for (let prop in records.data.data.result) {

            if (records.data.data.result[prop] > 0) {
                html += '<tr>';
                // workspace folder name
                html += '<td style="text-align: left;vertical-align: middle; width: 55%">';
                html += '<small>' + prop + '</small>';
                html += '</td>';
                // actions
                html += '<td style="text-align: center;vertical-align: middle; width: 35%">';
                html += '<div class="custom-control custom-checkbox">';
                html += `<label class="custom-control-label" for="${prop}">Are these files in Kaltura?</label>`;
                html += `&nbsp;&nbsp;<input type="checkbox" class="custom-control-input" id="${prop}" onclick="astoolsModule.set_is_kaltura('${prop}');">`;
                html += '</div>';
                html += '<a href="#" onclick="astoolsModule.make_digital_objects(\'' + prop + '\');" type="button" class="btn btn-sm btn-default run-qa"><i class="fa fa-cogs"></i> <span>Start</span></a>';
                html += '</td>';
                html += '</tr>';
            }
        }

        domModule.html('#packages', html);
    }

    obj.make_digital_objects = async function (folder) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const username = document.querySelector('#username').value;
            const password = document.querySelector('#password').value;
            const is_kaltura = document.querySelector('#is_kaltura').value;

            if (api_key === null) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Permission Denied</div>');
                return false;
            }

            if (username.length === 0 || password.length === 0) {
                document.getElementById('aspace-message').innerHTML = '<div class="alert alert-danger"><i class="fa fa-exclamation"></i> Credentials are not set</div>';
                return false;
            }

            const data = {
                'username': username,
                'password': password,
                'folder': folder,
                'is_kaltura': is_kaltura,
                'is_test': 'false'
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
                document.querySelector('#astools-response').style.visibility = 'visible';
                document.querySelector('#astools-response').innerText = response.data.data;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }

        return false;
    };

    function save_credentials() {

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
    }

    obj.set_is_kaltura = async function (id) {

        if (document.querySelector('#is_kaltura').value === 'true') {
            alert('Please make only one selection!');
        } else {
            document.querySelector('#is_kaltura').value = 'true';
        }

        return false;
    };

    obj.init = async function () {

        document.querySelector('#digital-object-workspace-button').addEventListener('click', function () {
            save_credentials();
        });

        await astoolsModule.display_workspace_packages();
        $('.aspace-login-modal').modal({
            backdrop: 'static',
            keyboard: false
        });
    };

    return obj;

}());
