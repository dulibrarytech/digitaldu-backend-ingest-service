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

const parent_index_record_schema = {
    is_member_of_collection: {type: 'string'},
    uuid: {type: 'string'},
    handle: {type: 'string'},
    uri: {type: 'string'},
    // call_number: {type: 'string'},
    thumbnail: {type: 'string'},
    object_type: {type: 'string'},
    title: {type: 'string'},
    facets: {type: 'array'},
    abstract: {type: 'string'},
    is_published: {type: 'number'},
    is_compound: {type: 'number'},
    display_record: {type: 'object'}
};

const child_index_record_schema = {
    is_member_of_collection: {type: 'string'},
    uuid: {type: 'string'},
    handle: {type: 'string'},
    uri: {type: 'string'},
    // call_number: {type: 'string'},
    thumbnail: {type: 'string'},
    object: {type: 'string'},
    mime_type: {type: 'string'},
    object_type: {type: 'string'},
    title: {type: 'string'},
    facets: {type: 'array'},
    abstract: {type: 'string'},
    // resource_type: {type: 'string'},
    is_published: {type: 'number'},
    is_compound: {type: 'number'},
    display_record: {type: 'object'}
};

module.exports = function () {

    return {
        parent_index_record: parent_index_record_schema,
        child_index_record: child_index_record_schema,
    };
};