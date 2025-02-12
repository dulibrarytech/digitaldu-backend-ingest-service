/**

 Copyright 2019 University of Denver

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

const MODEL = require('../migration/model');

exports.migrate_aips = function (req, res) {
    MODEL.migrate_aips(function (data) {
        res.status(data.status).send(data.message);
    });
};

exports.migrate_aip_store = function (req, res) {
    MODEL.migrate_aip_store(function (data) {
        res.status(data.status).send(data.message);
    });
};

exports.move_to_aip_store = function (req, res) {
    MODEL.move_to_aip_store(function (data) {
        res.status(data.status).send(data.message);
    });
};
