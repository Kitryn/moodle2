"use strict";

// Import modules
const request = require("request");
const cheerio = require("cheerio");
const url = require("url");


class Moodle2 {
    constructor(baseUrl, username, password, callback) {
        if (typeof baseUrl !== "string") {
            throw new Error("baseUrl must be provided as a string!");
        }

        let parsedUrl = url.parse(baseUrl);
        let strippedUrl = parsedUrl.protocol + "//" + parsedUrl.host;  // is it possible to use url.format instead?

        this.baseUrl = strippedUrl;
        this.session = request.defaults({
            jar: true,
            followRedirect: false
        });
        this.isAuthed = false;

        this.loginPath = null;
        this.homePath = null;

        if (username && password) {
            this.login(username, password, callback);
        }
    }

    // callback(err, success) where success is a bool indicating if login was a success
    // TODO: Currently success always returns true and does not do error checking.
    login(username, password, callback) {
        if (this.isAuthed) {
            console.error("Already logged in!");
            let err = new Error("Already logged in.");
            return callback(err);
        }

        let self = this;

        if (!this.loginPath) {
            return this._getRedirectLocation(this.baseUrl, (err, href) => {
                if (err) {
                    console.error("Could not get login path!")
                    callback(err);
                }

                self.loginPath = href;
                return _doLogin();
            });
        } else {
            return _doLogin();
        }

        function _doLogin() {
            console.log("Logging in user " + username + "...");

            let formData = {
                username: username,
                password: password
            };

            self.session.post({ url: self.loginPath, formData: formData }, (err, httpResponse, body) => {
                if (err) {
                    console.error("Error on login: ", err);
                    return callback(err);
                }

                console.log("Login successful?");  // TODO: check if login was actually successful
                self.isAuthed = true;

                return callback(null, self.isAuthed);  // returns true if logged in
            });
        }
    }

    // callback(err, courses) where courses is a list of course objects
    getCourses(callback) {
        if (!this.isAuthed) {
            console.error("Do login first!");
            let err = new Error("Not logged in.");
            return callback(err);
        }

        let self = this;

        if (!this.homePath) {
            return this._getRedirectLocation(this.baseUrl, (err, href) => {
                if (err) {
                    console.error("Could not get path to home page!");
                    callback(err)
                }

                self.homePath = href;
                return _doGetCourses();
            });
        } else {
            return _doGetCourses();
        }

        function _doGetCourses() {
            self.session.get({ url: self.homePath }, (err, httpResponse, body) => {
                if (err) {
                    console.error("Error in getCourses: " + err);
                    return callback(err);
                }

                let $ = cheerio.load(body);
                let courseElements = $("div .course_title a");
                let courses = [];

                courseElements.each((i, elem) => {
                    let courseElement = $(elem);
                    courses[i] = {
                        title: courseElement.text(),
                        url: courseElement.attr("href")
                    };
                });

                console.log("Course list obtained!");
                callback(null, courses);
            });
        }
    }

    // Returns object of {section: [<folder list>]}
    getFoldersInCourse(courseUrl, callback) {
        if (!this.isAuthed) {
            console.error("Do login first!");
            let err = new Error("Not logged in.");
            return callback(err);
        }

        this.session.get({ url: courseUrl }, (err, httpResponse, body) => {
            if (err) {
                console.error("Error in getFoldersInCourse: " + err);
                return callback(err);
            }

            let $ = cheerio.load(body);
            let sections = {};
            let sectionElements = $("li.section.main.clearfix");  // sections e.g. Week 1 Lectures

            sectionElements.each((i, elem) => {
                let sectionElement = $(elem);
                let sectionTitle = sectionElement.attr("aria-label");
                let folderElements = sectionElement.find("li.folder a");
                let folders = [];

                folderElements.find("span").find("span").remove();  // remove unnecessary formatting

                folderElements.each((i, elem) => {
                    let folderElement = $(elem);

                    folders[i] = {
                        title: folderElement.find("span").text(),
                        url: folderElement.attr("href")
                    };
                });

                sections[sectionTitle] = folders;
            });

            console.log("Folder list for " + courseUrl + " obtained!");
            callback(null, sections);
        });
    }

    // Returns an array of all files found: [<file object>]
    // File object: { url: url, name: name, path: [array, of, folder, names]}
    getFilesInFolder(folderUrl, callback) {
        if (!this.isAuthed) {
            console.error("Do login first!");
            let err = new Error("Not logged in.");
            return callback(err);
        }

        let $;

        this.session.get({ url: folderUrl }, (err, httpResponse, body) => {
            if (err) {
                console.error("Error in getFoldersInCourse: " + err);
                return callback(err);
            }

            $ = cheerio.load(body);

            let rootElement = $("div.filemanager > ul");
            callback(null, recursiveSearch(rootElement));
        });

        function recursiveSearch(elem, path = []) {
            let listItems = elem.children();
            let files = []

            listItems.each((i, elem) => {
                let listItem = $(elem);

                // base case: children contains a span
                if (listItem.children("span").length > 0) {
                    // This is a file link
                    let file = {};

                    file.url = listItem.find("a").attr("href");
                    file.name = listItem.find("img.smallicon").attr("alt");
                    file.path = path;

                    files.push(file);
                    return;
                }

                // Case: first child is a div; therefore this li is a folder
                if (listItem.children().first().is("div")) {
                    let folderName = listItem.children().first().find("img").attr("title") || "";
                    // Case: a ul exists in children, therefore files may exist
                    if (listItem.children("ul").length > 0) {
                        let childPath = path.concat([folderName]);
                        listItem.children("ul").each((i, elem) => {
                            files = files.concat(recursiveSearch($(elem), childPath));
                        })
                    } else {
                        // Case: a ul does not exist in children, therefore this folder is empty
                        // do nothing
                    }
                }
                return;
            });

            return files;
        }
    }

    // Takes a URL, checkes for status code > 300, then callbacks the location header if it finds it.
    _getRedirectLocation(url, callback) {
        return this.session.get({ url: url }, (err, httpResponse) => {
            if (err) {
                console.error("Error getting redirect location for url: " + url);
                callback(err)
            }
            
            let href;

            if (httpResponse.statusCode > 300) {
                href = httpResponse.headers["location"];
            }

            // If a location header is not found, return the original url it was called with
            href = href || url;
            return callback(null, href);
        });
    }

    static getFileEtag(fileUrl, callback) {
        this.session.head({ url: fileUrl }, (err, httpResponse) => {
            let headers = httpResponse.headers;
            return callback(headers["Etag"]);
        });
    }

    // Returns a file stream???
    static streamFile(url) {
        return this.session(url);
    }
}


module.exports = Moodle2;
