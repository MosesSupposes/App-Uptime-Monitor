/**
 * Library for storing and editing data
 */

 // Dependencies
const fs = require('fs');
const path = require('path');
const helpers = require('./helpers');
 

const lib = {
    // Base directory of the data folder
    baseDir: path.join(__dirname, '/../.data'),

    // Write data to a file
    create(dir, file, data, cb) {
    // check if a directory exists, and create it if it doesn't
    let checkDirectory = () => {
        fs.stat(`${this.baseDir}/${dir}`, (err, stats) => {
            // Check if error occured and the error code was "doesn't exist".
            err && err.errno == -2 
                // Create the directory, call the cb.
                ? fs.mkdir(`${this.baseDir}/${dir}`, cb)
                // Just in case there was a different error.
                : cb(err);
        });
    }

    let createFile = () => {
        // Open the file for writing
        fs.open(`${this.baseDir}/${dir}/${file}.json`, 'wx', (err, fileDescriptor) => {
            if (!err && fileDescriptor) {
                // Convert data to string
                const stringData = JSON.stringify(data);
                // Write to file and close it 
                fs.writeFile(fileDescriptor, stringData, err => {
                    if (!err) {
                        fs.close(fileDescriptor, err => {
                            if (!err) {
                                cb(false);
                            } else {
                                cb('Error closing new file');
                            }
                        });
                    } else {
                        cb('Error writing to new file');
                    }
                });
            } else {
                cb('Could not create new file, it may already exist');
            }
        });
    }

    checkDirectory();
    createFile();
    },

    // Read data from a file
    read(dir, file, cb) {
        fs.readFile(`${this.baseDir}/${dir}/${file}.json`, 'utf-8', (err, data) => {
            if (!err && data) {
                const parsedData = helpers.parseJsonToObject(data);
                cb(false, parsedData);
            } else {
                cb(err, data);
            }
        });
    },

    // Update data inside a file
    update(dir, file, data, cb) {
        // Open the file for writing
        fs.open(`${lib.baseDir}/${dir}/${file}.json`, 'r+', (err, fileDescriptor) => {
            if (!err && fileDescriptor) {
                const stringData = JSON.stringify(data);
                // Truncate the file
                fs.ftruncate(fileDescriptor, err => {
                    if (!err) {
                        // Write to the file and close it
                        fs.writeFile(fileDescriptor, stringData, err => {
                            if (!err) {
                                fs.close(fileDescriptor, err => {
                                    !err ? cb(false) : cb('Error closing existing file');
                                })
                            } else {
                                cb('Error writing to existing file');
                            }
                        });
                    } else {
                        cb('Error truncating file');
                    }
                });
            } else {
                cb('Could not open the file for updating, it may not exist yet');
            }
        });
    },

    // Delete a file
    delete(dir, file, cb) {
        // Unlink the file
        fs.unlink(`${this.baseDir}/${dir}/${file}.json`, err => {
            !err ? cb(false) : cb('Error deleting the file');
        });
    }
 };

 module.exports = lib;