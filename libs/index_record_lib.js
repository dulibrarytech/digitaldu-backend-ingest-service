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

// const VALIDATOR = require('../libs/validate_lib');
const LOGGER = require('../libs/log4');

/**
 * Object contains index record methods
 * @param DB
 * @param TABLE
 * @type {Index_record_lib}
 */
const Index_record_lib = class {

    constructor(VALIDATOR_CONFIG) {
        this.VALIDATOR_CONFIG = VALIDATOR_CONFIG;
    }

    /**
     * Constructs index record from DB data
     * @param data (data object from get_index_record_data)
     * @return object <index record> / returns false if an error occurs
     */
    create_index_record(data) {

        let metadata;
        let index_record = {};
        let config;

        if (data.object_type === 'collection') {
            // config = this.VALIDATOR_CONFIG.parent_index_record;
        } else if (data.object_type === 'object') {
            // config = this.VALIDATOR_CONFIG.child_index_record;
        } else {
            LOGGER.module().error('ERROR: [/libs/index_record_lib (create_index_record)] Unable to get index record schema validation');
            return false;
        }

        try {
            metadata = JSON.parse(data.mods);
        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/index_record_lib (create_index_record)] Unable to create index record ' + error.message);
            return false;
        }

        index_record.pid = data.pid;
        index_record.object_type = data.object_type;

        if (metadata.title !== undefined && typeof metadata.title === 'string') {
            index_record.title = metadata.title;
        }

        index_record.is_member_of_collection = data.is_member_of_collection;
        index_record.handle = data.handle;
        index_record.uri = data.uri;

        let identifiers = metadata.identifiers;
        for (let i=0;i<identifiers.length;i++) {
            if (identifiers[i].type === 'local') {
                index_record.call_number = identifiers[i].identifier;
                break;
            }
        }

        if (data.thumbnail !== null) {
            index_record.thumbnail = data.thumbnail;
        } else {
            index_record.thumbnail = '';
        }

        if (data.object_type === 'object') {

            if (data.file_name !== null) {
                index_record.object = data.file_name;
            }

            if (data.mime_type !== null) {
                index_record.mime_type = data.mime_type;
            }

            if (metadata.resource_type !== undefined && metadata.resource_type.length > 0) {
                index_record.resource_type = metadata.resource_type;
            }

            if (data.transcript !== null && data.transcript.length > 0) {

                let transcript_arr = JSON.parse(data.transcript);

                for (let i = 0; i < metadata.parts.length; i++) {
                    for (let j = 0; j < transcript_arr.length; j++) {
                        if (transcript_arr[j].call_number === metadata.parts[i].title.replace('.tif', '')) {
                            metadata.parts[i].transcript = transcript_arr[j].transcript_text;
                        }
                    }
                }
            }

            if (data.transcript_search !== null && data.transcript_search.length > 0) {
                index_record.transcript_search = data.transcript_search;
            }
            // TODO: processed in ingest_service create repo record function
            /*
            if (metadata.parts !== undefined && metadata.parts.length > 0) {

                if (data.is_compound === 1 && data.compound_parts !== null) {
                    metadata.parts = JSON.parse(data.compound_parts);
                }

                for (let i = 0; i < metadata.parts.length; i++) {

                    if (metadata.parts[i].kaltura_id !== undefined && typeof metadata.parts[i].kaltura_id === 'string') {
                        index_record.kaltura_id = metadata.parts[i].kaltura_id;
                    }
                }
            }

             */
            /*
            if (metadata.parts !== undefined && metadata.parts.length > 0) {
                for (let i=0;i<metadata.parts.length;i++) {
                    if (metadata.parts[i].kaltura_id !== undefined) {
                        index_record.entry_id = metadata.parts[i].kaltura_id;
                    }
                }
            }

            index_record.parts = metadata.parts;

             */
        }

        if (metadata.names !== undefined) {

            let names = metadata.names;

            for (let i = 0; i < names.length; i++) {
                if (names[i].role !== undefined && names[i].role === 'creator') {
                    index_record.creator = names[i].title;
                }
            }
        }

        if (metadata.subjects !== undefined) {
            let subjectsArr = [];
            for (let i = 0; i < metadata.subjects.length; i++) {
                if (metadata.subjects[i].title !== null) {
                    subjectsArr.push(metadata.subjects[i].title);
                }
            }

            if (subjectsArr.length > 0) {
                index_record.f_subjects = subjectsArr;
            }
        }

        if (metadata.notes !== undefined && metadata.notes.length > 0) {

            let notes = metadata.notes;

            for (let i = 0; i < notes.length; i++) {
                if (notes[i].type !== undefined && notes[i].type === 'abstract') {
                    index_record.abstract = notes[i].content;
                }
            }
        }

        index_record.is_published = parseInt(data.is_published);

        if (metadata.is_compound !== undefined && metadata.is_compound === true) {
            index_record.is_compound = 1;
        } else {
            index_record.is_compound = 0;
        }

        index_record.display_record = metadata;

        /*
        const VALIDATOR = new VALIDATE(config);
        let is_valid = VALIDATOR.validate(index_record);

        if (is_valid !== true) {
            console.log('record not valid ', is_valid);
            // this.flag_record(index_record.uuid, is_valid);
        }
        */

        return index_record;
    };
};

module.exports = Index_record_lib;
