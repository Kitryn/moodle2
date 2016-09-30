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
        this.homePage = null;
        this.homePage$ = null;
        this.courses = {};
        this.courseTitles = [];
        
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
    
    // Populates this.courses with the course list on the home page
    // this.courses: {"<coursename>": {title: title, url: url}}
    // this.courseTitles = [<list of course names>]
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
            this.homePage = httpResponse;
            this.homePage$ = $;
            this.courses = {};
            this.courseTitles = [];
            
            let self = this;
            
            $("div .course_title a").each(function(i, elem) {
                let courseElement = $(this);
                let courseTitle = courseElement.text();
                
                self.courseTitles[i] = courseTitle;
                self.courses[courseTitle] = {
                    title: courseTitle,
                    url: courseElement.attr("href")
                };
            }); 
            
            console.log("Course list obtained!");
            callback(null, this.courseTitles, this.courses);
        });
    }
    
    // Takes a course object from this.courses
    // Modifies course object
    // course.folders: {"<section name>": [<list of folders>]}
    getFoldersInCourse(courseTitle, callback) {
        if (!this.isAuthed) {
            console.error("Do login first!");
            let err = new Error("Not logged in.");
            return callback(err);
        }
        
        if (!this.courseTitles.includes(courseTitle)) {
            console.error("getFoldersInCourse: course not present in Moodle2 object!")
            let err = new Error("Invalid course passed to getFoldersInCourse.")
            return callback(err)
        }
        
        let course = this.courses[courseTitle];
        
        let title = course.title;
        let url = course.url;
        
        this.session.get({url: url}, (err, httpResponse, body) => {
            if (err) {
                console.error("Error in getFoldersInCourse: " + err);
                return callback(err);
            }
            
            let $ = cheerio.load(body);
            course.response = httpResponse;
            course.response$ = $;
            course.folders = {};
            
            let sectionElements = $("li.section.main.clearfix")  // sections e.g. Week 1 Lectures
            
            sectionElements.each(function(i, elem) {
                let sectionElement = $(this);
                let folderElements = sectionElement.find("li.folder a");
                let sectionTitle = sectionElement.attr("aria-label");
                let sectionFolders = [];
                
                folderElements.find("span").find("span").remove();  // remove unnecessary formatting
                
                folderElements.each(function(i, elem) {
                    let folderElement = $(this);
                    
                    sectionFolders[i] = {
                        title: folderElement.find("span").text(),
                        url: folderElement.attr("href")
                    };
                });
                
                course.folders[sectionTitle] = sectionFolders;
            });
            
            console.log("Folder list obtained!");
            callback(null, course.folders);
        })
    }
    
    getFilesToDownload(url, callback) {
        // what
    }
}


module.exports = Moodle2;
