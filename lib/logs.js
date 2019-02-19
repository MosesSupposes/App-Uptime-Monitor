/**
 * Library for storing and rotating logs
 */

// Dependencies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const helpers = require('./helpers');
const _data = require('./data');

// Container for the module
const lib = {
    // Base directory for the logs folder
    baseDir: path.join(__dirname, '/../.data/.logs'),

    // List all the logs, and optionally include the compressed logs
    list(includeCompressedLogs, cb) {
        // Create a new empty directory if the base directory is empty
       _data.create('.logs', null, null, err => {
            !err ? 
                fs.readdir(this.baseDir, (err, data) => {
                    const trimmedFileNames = includeCompressedLogs ? 
                        helpers.trimFileExtensions(data, ['.log', '.gz.b64'])   
                    : helpers.trimFileExtensions(data, ['.log']);

                    (!err && helpers.auditParam(data)) ? 
                        cb(false, trimmedFileNames)
                    : cb(err, data);
                })
            : cb('Error: failed to create a non-existent directory or file within that directory\n'+err)
        });
    },

    // Append a string to a file. Create the file if it does not exist.
    append(file, str, cb) {
        // Open the file for appending 
        fs.open(`${this.baseDir}/${file}.log`, 'a', (err, fileDescriptor) => {
            (!err && fileDescriptor) ?
                // Append to the file and close it
                fs.appendFile(fileDescriptor, str+'\n', err => {
                    (!err) ? 
                        fs.close(fileDescriptor, err => {
                            (!err) ?
                                cb(false) 
                            : cb('Error closing file that was being appended');
                        })
                    : cb('Error appending to file');
                })
            : cb('Could not open the file for appending');
        });
    },

    // Compress the contents of one .log file int a .gz.b64 file within the same directory
    compress(logId, newFileId, cb) {
        const sourceFile = logId+'.log';
        const destinationFile = newFileId+'.gz.b64';

        // Read the source file
        fs.readFile(`${this.baseDir}/${sourceFile}`, 'utf8', (err, fileContents) => {
            (!err && fileContents) ?
                // Compress the data using gzip
                zlib.gzip(fileContents, (err, buffer) => {
                    (!err && buffer) ? 
                        // Send the data to the destination file
                        fs.open(`${this.baseDir}/${destinationFile}`, 'wx', (err, fileDescriptor) => {
                            (!err && fileDescriptor) ?
                                // Write to the destination file
                                fs.writeFile(fileDescriptor, buffer.toString('base64'), err => {
                                    (!err) ?
                                        // Close the destination file
                                        fs.close(fileDescriptor, err => {
                                            (!err) ? cb(false) : cb(err);
                                        })
                                    : cb(err);
                                })
                            : cb(err);
                        })
                    : cb(err);
                })
            : cb(err);
        });
    },

    // Decompress the contents of a .gz.b64 file into a string varialbe
    decompress(fileId, cb) {
        const fileName = fileId+'.gz.b64';
        fs.readFile(`${this.baseDir}/${fileName}`, 'utf8', (err, str) => {
            if (!err && str) {
                // Decompress the data and call back
                const inputBuffer = Buffer.from(str, 'base64');
                zlib.unzip(inputBuffer, (err, outputBuffer) => {
                    (!err && outputBuffer) ? cb(false, outputBuffer.toString()) : cb(err);
                });
            } else {
                cb(err);
            }
        });
    },

    // Truncate a log file
    truncate(logId, cb) {
        fs.open(`${this.baseDir}/${logId}.log`, 'r+', (err, fd) => {
            (!err && fd) ? 
                fs.ftruncate(fd, 0, err => (!err) ? cb(false) : cb(err))
            : cb(err);
        });
    }
};

module.exports = lib;