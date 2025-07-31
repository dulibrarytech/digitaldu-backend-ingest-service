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

        const session = req.query.session;
        const data = req.body

        if (session === undefined || session.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

       process_metadata(data, session, (data) => {

           if (data.length === 0) {

               res.status(404).send({
                   data: data
               });

               return false;
           }

           res.status(200).send({
               data: data
           });
       });

        return false;

    } catch (error) {
        res.status(500).send({message: `Unable to get metadata. ${error.message}`});
    }
};

function process_metadata(data, session, callback) {

    let pairs = [];
    let files = data.files;

    let timer = setInterval(() => {

        if (files.length === 0) {
            clearInterval(timer);
            data.files = pairs;
            console.log('complete');
            callback(data);
            return false;
        }

        let file = files.pop();

        SERVICE.get_ks_metadata(file, session, (metadata) => {

            if (metadata.totalCount > 1) {

                let entry_ids = [];

                for (let i = 0; i < metadata.objects.length; i++) {
                    entry_ids.push(metadata.objects[i].object.id);
                }

                pairs.push({
                    file: file,
                    entry_id: entry_ids,
                    message: '- file has more than 1 Entry ID - Please check Kaltura record(s)'
                });

            } else if (metadata.totalCount === 1) {

                pairs.push({
                    file: file,
                    entry_id: metadata.objects[0].object.id,
                    message: 'success'
                });

            } else if (metadata.totalCount === 0) {

                pairs.push({
                    file: file,
                    entry_id: [],
                    message: 'Entry ID not found for this file - Please check Kaltura record'
                });
            }

            return false;
        });

    }, 1000);
}
