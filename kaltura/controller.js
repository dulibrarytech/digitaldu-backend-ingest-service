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

const SERVICE = require('../kaltura/service');

exports.get_ks_session = function (req, res) {

    try {

        const api_key = req.query.api_key;

        if (api_key === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        SERVICE.get_ks_session((session) => {
            console.log('session: ', session)
            res.status(200).send({
                ks: session
            });
        });

    } catch (error) {
        res.status(500).send({message: `Unable to get session token. ${error.message}`});
    }
};

exports.get_ks_metadata = function (req, res) {

    try {

        // const api_key = req.query.api_key;
        const session = req.query.session;
        const call_number = req.query.call_number;

        /*
        if (api_key === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

         */

        SERVICE.get_ks_metadata(call_number, session,(metadata) => {
            console.log('metadata: ', metadata)
            res.status(200).send({
                ks: metadata
            });
        });

    } catch (error) {
        res.status(500).send({message: `Unable to get metadata. ${error.message}`});
    }
};
