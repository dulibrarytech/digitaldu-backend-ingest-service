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

'use strict';

const HELPER = require("../libs/helper");
const HELPER_TASK = new HELPER();
const REPO = {
    repo_objects: process.env.REPO_OBJECTS,
};

const REPO_INGEST_QUEUE = {
    repo_ingest_queue: process.env.REPO_INGEST_QUEUE
};

const REPO_TABLES = HELPER_TASK.check_config(REPO);
const REPO_QUEUE_TABLES = HELPER_TASK.check_config(REPO_INGEST_QUEUE);
const DB_TABLES_CONFIG = {
    repo: REPO_TABLES,
    repo_queue: REPO_QUEUE_TABLES
};

module.exports = function () {
    return DB_TABLES_CONFIG;
};