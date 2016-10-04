# Moodle2
node.js wrapper for interfacing with Moodle2 systems.

Only tested with UoG Moodle 2 (https://moodle2.gla.ac.uk/).

## Usage
```javascript
var Moodle2 = require('moodle2');
var session = new Moodle2('https://moodle2.gla.ac.uk/');
```

---

### Interfaces

###### session.login("username", "password", callback);

```javascript
var session = new Moodle2("base url", ["username", "password", callback]);
...
session.login("username", "password", callback);
```

Constructor provides an optional convenience method of logging in. If not provided, login can be done with `session.login()`.

`callback` has the signature `callback(err, success)` where `success` is a boolean indicating login success or failure.

###### session.getCourses(callback);

```javascript
session.getCourses((err, courses) => {
    console.log(courses);
});
//=> [{title: "title", url: "url"}]
```

###### session.getFoldersInCourse(courseUrl, callback);

###### session.getFilesInFolder(folderUrl, callback);

---

### Static methods

###### Moodle2.getFileEtag(fileUrl, callback);

Makes a `HEAD` request to fileUrl and returns the `Etag` if it exists.

###### Moodle2.streamFile(url);

Returns a response stream that can be piped.

```javascript
Moodle2.streamFile("url here").pipe(fs.createWriteStream("file name to save"));
```