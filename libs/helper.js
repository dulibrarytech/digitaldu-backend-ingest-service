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

const {v4: uuidv4} = require('uuid');
const VALIDATOR = require('validator');
const XMLDOC = require('xmldoc');
const LOGGER = require('../libs/log4');

/**
 * Object contains helper tasks
 * @type {Helper}
 */
const Helper = class {

    constructor() {}

    /**
     * Generates uuid
     * @returns Promise string
     */
    create_uuid() {

        try {
            return uuidv4();
        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (create_uuid)] unable to generate uuid ' + error.message);
            return false;
        }
    }

    /**
     * Checks if required env config values are set
     * @param config
     */
    check_config(config) {

        let obj = {};
        let keys = Object.keys(config);

        keys.map((prop) => {

            if (config[prop].length === 0) {
                LOGGER.module().error('ERROR: [/config/app_config] ' + prop + ' env is missing config value');
                return false;
            }

            if (VALIDATOR.isURL(config[prop]) === true) {
                obj[prop] = encodeURI(config[prop]);
            }

            obj[prop] = VALIDATOR.trim(config[prop]);
        });

        return obj;
    }

    /**
     * Converts byte size to human readable format
     * @param bytes
     * @param decimals
     * @return {string|{batch_size: number, size_type: string}}
     */
    format_bytes(bytes, decimals = 2) {

        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return {
            size_type:sizes[i],
            batch_size: parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
        };
    };

    /**
     * Gets mime type by file extension
     * @param file
     */
    get_mime_type(file) {

        let mime_type;

        if (file.indexOf('tif') !== -1) {
            mime_type = 'image/tiff';
        }

        if (file.indexOf('pdf') !== -1) {
            mime_type = 'application/pdf';
        }

        if (file.indexOf('wav') !== -1) {
            mime_type = 'audio/x-wav';
        }

        if (file.indexOf('mp4') !== -1) {
            mime_type = 'video/mp4';
        }

        if (file.indexOf('mov') !== -1) {
            mime_type = 'video/quicktime';
        }

        return mime_type;
    }

    /**
     * Processes METS XML file
     * @param sip_uuid
     * @param dip_path
     * @param xml
     */
    process_mets_xml(sip_uuid, dip_path, xml) {

        let document = new XMLDOC.XmlDocument(xml),
            Obj = {},
            Arr = [],
            mime_type;

        document.eachChild(function (child, index, array) {

            // get mime type for wav, mp4 and tiff files
            if (array[index].name === 'mets:amdSec') {

                let techMD = array[index].childNamed('mets:techMD'),
                    mdWrap = techMD.childNamed('mets:mdWrap'),
                    xmlData = mdWrap.childNamed('mets:xmlData'),
                    premisObject = xmlData.childNamed('premis:object'),
                    premisObjectCharacteristics = premisObject.childNamed('premis:objectCharacteristics'),
                    premisObjectCharacteristicsExtension = premisObjectCharacteristics.childNamed('premis:objectCharacteristicsExtension');

                if (premisObjectCharacteristicsExtension !== undefined && premisObjectCharacteristicsExtension.childNamed('rdf:RDF') !== undefined) {

                    let rdfDescription = premisObjectCharacteristicsExtension.childNamed('rdf:RDF').childNamed('rdf:Description');
                    mime_type = rdfDescription.childNamed('File:MIMEType').val;
                }

                // get mime type for pdf files
                if (premisObjectCharacteristicsExtension !== undefined && premisObjectCharacteristicsExtension.childNamed('fits') !== undefined) {

                    let fits = premisObjectCharacteristicsExtension.childNamed('fits');
                    let toolOutput = fits.childNamed('toolOutput'),
                        tool = toolOutput.childNamed('tool'),
                        fileUtilityOutput = tool.childNamed('fileUtilityOutput'),
                        mimeType = fileUtilityOutput.childNamed('mimetype').val;

                    if (mimeType === 'application/pdf') {
                        mime_type = mimeType;
                    }
                }
            }

            // gets file information
            if (array[index].name === 'mets:fileSec') {

                if (array[index].children[1].name === 'mets:fileGrp') {

                    for (let i = 0; i < array[index].children[1].children.length; i++) {

                        if (array[index].children[1].children[i].name === 'mets:file') {

                            for (let k = 0; k < array[index].children[1].children[i].children.length; k++) {
                                // get file id and names
                                if (array[index].children[1].children[i].children[k].name === 'mets:FLocat') {

                                    let tmpArr = array[index].children[1].children[i].children[k].attr['xlink:href'].replace(/objects\//g, '').split('.'),
                                        file_id,
                                        ext = tmpArr.pop();

                                    file_id = tmpArr.join('.');

                                    Obj.uuid = array[index].children[1].children[i].attr.ID.replace(/file-/g, '');
                                    Obj.sip_uuid = sip_uuid;
                                    Obj.dip_path = dip_path;
                                    Obj.file = array[index].children[1].children[i].children[k].attr['xlink:href'].replace(/objects\//g, '');
                                    Obj.file_id = file_id;
                                    Obj.mime_type = mime_type;

                                    if (ext === 'txt') {
                                        Obj.type = 'txt';
                                    } else {
                                        Obj.type = 'object';
                                    }
                                }
                            }
                        }

                        if (Object.keys(Obj).length !== 0 && Obj.constructor === Object) {
                            Arr.push(Obj);
                            Obj = {};
                        }
                    }
                }
            }
        });

        return Arr;
    }

    /**
     * Processes object manifest xml file
     * @param xml
     */
    process_manifest(xml) {

        let document = new XMLDOC.XmlDocument(xml),
            chunks = document.childNamed('chunks'),
            arr = [],
            obj = {};

        let header = document.childNamed('header'),
            sourceContent = header.childNamed('sourceContent');

        obj.checksum = sourceContent.childNamed('md5').val;
        obj.file_size = sourceContent.childNamed('byteSize').val;

        for (let i=0;i<chunks.children.length;i++) {

            if (chunks.children[i].attr !== undefined) {

                let chunk_url = chunks.children[i].attr.chunkId,
                    tmp = chunk_url.split('.'),
                    prop = tmp[tmp.length - 1];

                obj[prop] = chunk_url;
                arr.push(obj);
                obj = {};
            }
        }

        return arr;
    }
};

module.exports = Helper;
