/**
 * Library for storing and rotating logs
 */

// Dependencies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Container for the module
const lib = {
    // Base directory for the logs folder
    baseDir: path.join(__dirname, '/../.logs'),

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
    }
};

module.exports = lib;