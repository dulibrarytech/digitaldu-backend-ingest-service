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

'use strict';

const SERVICE = require('../astools/service');

exports.workspace = function (req, res) {

    try {

        SERVICE.get_workspace_packages((response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};

exports.make_digital_objects = function (req, res) {

    try {

        if (Object.keys(req.body).length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const args = {
            username: req.body.username,
            password: req.body.password,
            folder: req.body.folder,
            is_kaltura: req.body.is_kaltura,
            is_test: req.body.is_test
        }

        SERVICE.make_digital_objects(args, (response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};
