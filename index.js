"use strict";

// Import modules
const request = require("request");
const url = require("url");
const cheerio = require("cheerio");
// const crypto = require("crypto");

// Constants
const BASE_URI = "https://moodle2.gla.ac.uk/";
const LOGIN_PATH = "login/index.php";
const HOME_PATH = "my/";


/*
function md5Hash(str) {
    return crypto.createHash("md5").update(str).digest("hex");
}
*/


class Moodle2 {
    constructor(username, password, callback) {        
        this.session = request.defaults({jar: true});
        this.isAuthed = false;
        
        if (username && password) {
            this.login(username, password, callback);
        }
    }
    
    login(username, password, callback) {
        let login_page = url.resolve(BASE_URI, LOGIN_PATH);
        console.log("Logging in user " + username + "...");
        
        let formData = {
            username: username,
            password: password
        };
        
        this.session.post({url: login_page, formData: formData}, (err, httpResponse, body) => {
            if (err) {
                console.error("Error on login: ", err);
                return callback(err);
            }
            
            console.log("Login successful?");  // TODO: check if login was actually successful
            this.isAuthed = true;
            
            return callback(null, this.isAuthed);  // returns true if logged in
        });
    }
    
    // Returns list of courses
    getCourses(callback) {
        if (!this.isAuthed) {
            console.error("Do login first!");
            let err = new Error("Not logged in.");
            return callback(err);
        }
        
        let homeURL = url.resolve(BASE_URI, HOME_PATH);
        
        this.session.get({url: homeURL}, (err, httpResponse, body) => {
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
    
    // Returns object of {section: [<folder list>]}
    getFoldersInCourse(courseUrl, callback) {
        if (!this.isAuthed) {
            console.error("Do login first!");
            let err = new Error("Not logged in.");
            return callback(err);
        }
        
        this.session.get({url: courseUrl}, (err, httpResponse, body) => {
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
    
    getFilesToDownload(url, callback) {
        // what
    }
}


module.exports = Moodle2;
