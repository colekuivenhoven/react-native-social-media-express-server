console.log('');
const fs = require('fs');
var ffmpeg = require('ffmpeg');
const http = require('http').createServer();
var express = require("express");
const app = express();
const bodyParser = require("body-parser");
const multer = require('multer');
const {GridFsStorage} = require('multer-gridfs-storage');
const util = require("util");
var MongoClient = require("mongodb").MongoClient;
var siofu = require("socketio-file-upload");
const { ObjectID } = require("bson");
var bcrypt = require('bcrypt');

const io = require('socket.io')(http, {
    cors: { origin: "*" }
});
var MongoClient = require("mongodb").MongoClient;

// Port Assignments
const socketPort = 3030;
const expressPort = 3040;

app.use(bodyParser.json());
// app.use("/images", express.static(__dirname+"/images"));

// const Storage = new GridFsStorage({
//     url: "mongodb://localhost:27017/HeadlessDB",
//     options: { useNewUrlParser: true, useUnifiedTopology: true },
//     file: (req, file) => {
//         const match = ["image/png", "image/jpeg"];

//         if (match.indexOf(file.mimetype) === -1) {
//             const filename = `${file.fieldname}_${Date.now()}_${file.originalname}`;
//             return filename;
//         }

//         return {
//             bucketName: "uploads",
//             filename: `${file.fieldname}_${Date.now()}_${file.originalname}`
//         };
//     }
// });

const StorageImage = multer.diskStorage({
    destination(req, file, callback) {
      callback(null, './images')
    },
    filename(req, file, callback) {
      callback(null, `${file.fieldname}_${Date.now()}_${file.originalname}`)
    },
});

const StorageGroup = multer.diskStorage({
    destination(req, file, callback) {
      callback(null, './group_images')
    },
    filename(req, file, callback) {
      callback(null, `${file.fieldname}_${Date.now()}_${file.originalname}`)
    },
});

const uploadImage = multer({ storage: StorageImage });
const uploadGroupImage = multer({ storage: StorageGroup });

MongoClient.connect("mongodb://localhost:27017",{useNewUrlParser: true, useUnifiedTopology: true},
function(error, client) {
    const hdb = client.db("HeadlessDB");
    console.log("<! Database connection successful !>");

    // Express
    app.get('/', (req, res) => {
        res.status(200).send('Express landing page');
    });

    // Comment Handling
    app.post("/addComment", function(req, res) {
        req.body.pointsGood = [];
        req.body.pointsBad = [];
        req.body.comments = [];
        hdb.collection("comments").insertOne(req.body, function(error, comment) {
            if (error) {
                console.log(error);
            } else {
                if(comment.ops[0].commentid != -1) {
                    console.log(comment.ops[0].commentid);
                    hdb.collection("comments").updateOne({"_id": ObjectID(comment.ops[0].commentid)}, {$push: { "comments": comment.ops[0]._id }}, function(error, com){
                        if (error) {
                            console.log(error);
                        }
                        else {
                            console.log("Added reply successfully!");
                        }
                    });
                }
                console.log('<- Comment added ->');
                res.status(200).json({
                    message: '<- Comment Upload: Successful ->',
                });
            }
        });
    });

    app.get('/commentAddGoodPoint/:comid/:userid', (req, res) => {
        hdb.collection("comments").findOne({"_id": ObjectID(req.params.comid)}, function(error, com){
            if (com.pointsGood.includes(req.params.userid)) {
                // console.log("User already upvoted comment!");
                // res.send("User already upvoted comment!");
                hdb.collection("comments").updateOne({"_id": ObjectID(req.params.comid)}, {$pull: { "pointsGood": req.params.userid }}, function(error, com) {
                    if(error) {
                        console.log("Error removing good point from comment!"+error);
                        res.send("Error removing good point from comment!"+error);
                    }
                    else {
                        console.log("Successfully removed good point from comment!");
                        res.send("Successfully removed good point from comment!");
                    }
                });
            }
            else {
                hdb.collection("comments").updateOne({"_id": ObjectID(req.params.comid)}, {$push: { "pointsGood": req.params.userid }}, function(error, com) {
                    if(error) {
                        console.log("Error adding good point to comment!");
                        res.send("Error adding good point to comment!");
                    }
                    else {
                        hdb.collection("comments").updateOne({"_id": ObjectID(req.params.comid)}, {$pull: { "pointsBad": req.params.userid }}, function(error, com) {
                            if(error) {
                                console.log("Error removing bad point from comment!"+error);
                                res.send("Error removing bad point from comment!"+error);
                            }
                            else {
                                console.log("Successfully removed bad point from comment!");
                            }
                        });
                        console.log("Succesfully added good point to comment!");
                        res.send("Succesfully added good point to comment!");
                    }
                });
            }
        });
    });

    app.get('/commentAddBadPoint/:comid/:userid', (req, res) => {
        hdb.collection("comments").findOne({"_id": ObjectID(req.params.comid)}, function(error, com){
            if (com.pointsBad.includes(req.params.userid)) {
                // console.log("User already downvoted comment!");
                // res.send("User already downvoted comment!");
                hdb.collection("comments").updateOne({"_id": ObjectID(req.params.comid)}, {$pull: { "pointsBad": req.params.userid }}, function(error, com) {
                    if(error) {
                        console.log("Error removing bad point from comment!"+error);
                        res.send("Error removing bad point from comment!"+error);
                    }
                    else {
                        console.log("Successfully removed bad point from comment!");
                        res.send("Successfully removed bad point from comment!");
                    }
                });
            }
            else {
                hdb.collection("comments").updateOne({"_id": ObjectID(req.params.comid)}, {$push: { "pointsBad": req.params.userid }}, function(error, com) {
                    if(error) {
                        console.log("Error adding bad point to comment!");
                        res.send("Error adding bad point to comment!");
                    }
                    else {
                        hdb.collection("comments").updateOne({"_id": ObjectID(req.params.comid)}, {$pull: { "pointsGood": req.params.userid }}, function(error, com) {
                            if(error) {
                                console.log("Error removing good point from comment!"+error);
                                res.send("Error removing good point from comment!"+error);
                            }
                            else {
                                console.log("Successfully removed good point from comment!");
                            }
                        });
                        console.log("Succesfully added bad point to comment!");
                        res.send("Succesfully added bad point to comment!");
                    }
                });
            }
        });
    });

    // Post Handling
    app.post("/addPost", uploadImage.single('pic'), function(req, res) {
        req.body.picName = req.file.filename;
        req.body.pointsGood = [];
        req.body.pointsBad = [];
        req.body.comments = 0;
        hdb.collection("posts").insertOne(req.body, function(error, post) {
            if (error) {
                console.log(error);
            } else {
                console.log('<- Post added ->');
                res.status(200).json({
                    message: '<- Server Upload: Successful ->',
                });
            }
        });
    });

    app.post("/addPost/text", function(req, res) {
        console.log(req.body)
        req.body.pointsGood = [];
        req.body.pointsBad = [];
        req.body.comments = 0;
        hdb.collection("posts").insertOne(req.body, function(error, post) {
            if (error) {
                console.log(error);
            } else {
                console.log('<- Text Post added ->');
                res.status(200).json({
                    message: '<- Text Post Upload: Successful ->',
                });
            }
        });
    });

    app.post("/addPost/video", uploadImage.single('vid'), function(req, res) {
        console.log(req.file);
        req.body.vidName = req.file.filename;
        req.body.pointsGood = [];
        req.body.pointsBad = [];
        req.body.comments = 0;
        hdb.collection("posts").insertOne(req.body, function(error, post) {
            if (error) {
                console.log(error);
            } else {
                console.log('<- Video post added ->');
                res.status(200).json({
                    message: '<- Server Video Upload: Successful ->',
                });
            }
        });
    });

    app.get('/postAddGoodPoint/:postid/:userid', (req, res) => {
        hdb.collection("posts").findOne({"_id": ObjectID(req.params.postid)}, function(error, post){
            if (post.pointsGood.includes(req.params.userid)) {
                // console.log("User already upvoted!");
                // res.send("User already upvoted!");
                hdb.collection("posts").updateOne({"_id": ObjectID(req.params.postid)}, {$pull: { "pointsGood": req.params.userid }}, function(error, post) {
                    if(error) {
                        console.log("Error removing good point from post!"+error);
                        res.send("Error removing good point from post!"+error);
                    }
                    else {
                        console.log("Successfully removed good point from post!");
                        res.send("Successfully removed good point from post!");
                    }
                });
            }
            else {
                hdb.collection("posts").updateOne({"_id": ObjectID(req.params.postid)}, {$push: { "pointsGood": req.params.userid }}, function(error, post) {
                    if(error) {
                        console.log("Error adding good point to post!");
                        res.send("Error adding good point to post!");
                    }
                    else {
                        hdb.collection("posts").updateOne({"_id": ObjectID(req.params.postid)}, {$pull: { "pointsBad": req.params.userid }}, function(error, post) {
                            if(error) {
                                console.log("Error removing bad point from post!"+error);
                                res.send("Error removing bad point from post!"+error);
                            }
                            else {
                                console.log("Successfully removed bad point from post!");
                            }
                        });
                        console.log("Succesfully added good point to post!");
                        res.send("Succesfully added good point to post!");
                    }
                });
            }
        });
    });

    app.get('/postAddBadPoint/:postid/:userid', (req, res) => {
        hdb.collection("posts").findOne({"_id": ObjectID(req.params.postid)}, function(error, post){
            if (post.pointsBad.includes(req.params.userid)) {
                // console.log("User already downvoted!");
                // res.send("User already downvoted!");
                hdb.collection("posts").updateOne({"_id": ObjectID(req.params.postid)}, {$pull: { "pointsBad": req.params.userid }}, function(error, post) {
                    if(error) {
                        console.log("Error removing bad point from post!"+error);
                        res.send("Error removing bad point from post!"+error);
                    }
                    else {
                        console.log("Successfully removed bad point from post!");
                        res.send("Successfully removed bad point from post!");
                    }
                });
            }
            else {
                hdb.collection("posts").updateOne({"_id": ObjectID(req.params.postid)}, {$push: { "pointsBad": req.params.userid }}, function(error, post) {
                    if(error) {
                        console.log("Error adding bad point to post!");
                        res.send("Error adding bad point to post!");
                    }
                    else {
                        hdb.collection("posts").updateOne({"_id": ObjectID(req.params.postid)}, {$pull: { "pointsGood": req.params.userid }}, function(error, post) {
                            if(error) {
                                console.log("Error removing good point from post!"+error);
                                res.send("Error removing good point from post!"+error);
                            }
                            else {
                                console.log("Successfully removed good point from post!");
                            }
                        });
                        console.log("Succesfully added bad point to post!");
                        res.send("Succesfully added bad point to post!");
                    }
                });
            }
        });
    });

    app.get('/getComments/:id', (req, res) => {
        hdb.collection("comments").find({"postid": req.params.id}).sort({"_id": -1}).toArray(function(error, comments){
            if(error) {
                res.send("Error getting comments");
            } else {
                hdb.collection("posts").updateOne({"_id": ObjectID(req.params.id)}, {$set: { "comments": comments.length }}, function(error, post) {
                    if(error) {
                        console.log("Error getting post comment number");
                    }
                    else {
                        console.log("Updated comment number successfully!");
                    }
                });
                res.json({comments: comments});
            }
        });
    });

    app.get('/getReplies/:id', (req, res) => {
        hdb.collection("comments").find({"commentid": req.params.id}).sort({"_id": -1}).toArray(function(error, replies){
            if(error) {
                res.send("Error getting replies");
            } else {
                res.json({replies: replies});
            }
        });
    });

    app.get("/getPost/:id", function(req, res) {
        console.log("< Get all posts requested >");
        hdb.collection("posts").findOne({"_id": ObjectID(req.params.id)}, function(error, post){
            if(error) {
                res.send("Error getting post");
            } else {
                res.json({post: post});
            }
            
        });
    });

    app.get('/getPic/:id', function (req, res) {
        // console.log(req.params.id);
        res.sendFile(__dirname + '/images/'+req.params.id);
    });

    app.get('/getPicGroup/:id', function (req, res) {
        // console.log(req.params.id);
        res.sendFile(__dirname + '/group_images/'+req.params.id);
    });

    app.get('/getPicUser/:id', function (req, res) {
        // console.log(req.params.id);
        // res.sendFile(__dirname + '/group_images/'+req.params.id);
    });

    app.get('/getVid/:id', function (req, res) {
        // console.log(req.params.id);
        res.sendFile(__dirname + '/images/'+req.params.id);
    });

    // Group Handling
    app.post("/addGroup", uploadGroupImage.single('pic'), function(req, res) {
        req.body.picName = req.file.filename;
        req.body.admins = [req.body.authorid];
        req.body.members = [req.body.authorid];
        req.body.pointsGood = [];
        req.body.pointsBad = [];
        req.body.posts = [];

        hdb.collection("groups").insertOne(req.body, function(error, group) {
            if (error) {
                console.log(error);
            } else {
                hdb.collection("users").findOne({"_id": ObjectID(req.body.authorid)}, function(error, user){
                    if(error) {
                        console.log("Error joining created group 1")
                        res.send("Error joining created group 1");
                    }
                    else {
                        // console.log(group)
                        if (user.groups.includes(group.ops[0]._id)) {
                            console.log("Already in created group 1!")
                            res.send("Already in created group 1!");
                        } else {
                            hdb.collection("users").updateOne({"_id": ObjectID(req.body.authorid)}, {$push: { "groups": String(group.ops[0]._id) }}, function(error, user2){
                                if(error) {
                                    console.log("Error joining created group 2")
                                    res.send("Error joining created group 2");
                                } else {
                                    console.log('<- Group added ->');
                                    res.status(200).json({
                                        message: '<- Group Creation: Successful ->',
                                    });
                                }
                            });
                        }
                    }
                });
            }
        });
    });

    app.get("/getAllGroups", function(req, res) {
        hdb.collection("groups").find().sort({"_id": -1}).toArray(function(error, groups){
            if(error) {
                res.send("Error getting group");
            } else {
                res.json({groups: groups});
            }
        });
    });

    app.get('/getGroup/:id', (req, res) => {
        hdb.collection("groups").findOne({"_id": ObjectID(req.params.id)}, function(error, group){
            if(error) {
                res.send("Error getting group");
            } else {
                res.json({group: group});
            }
        });
    });

    app.get('/addUserToGroup/:groupid/:userid', (req, res) => {
        hdb.collection("users").findOne({"_id": ObjectID(req.params.userid)}, function(error, user){
            if(error) {
                console.log("Error joining group 1")
                res.send("Error joining group 1");
            }
            else {
                if (user.groups.includes(req.params.groupid)) {
                    console.log("Already in group 1!")
                    res.send("Already in group 1!");
                } else {
                    hdb.collection("users").updateOne({"_id": ObjectID(req.params.userid)}, {$push: { "groups": req.params.groupid }}, function(error, user2){
                        if(error) {
                            console.log("Error joining group 2")
                            res.send("Error joining group 2");
                        } else {
                            hdb.collection("groups").findOne({"_id": ObjectID(req.params.groupid)}, function(error, group){
                                if (group.members.includes(req.params.userid)) {
                                    console.log("Already in group 2!")
                                    res.send("Already in group 2!");
                                } else {
                                    hdb.collection("groups").updateOne({"_id": ObjectID(req.params.groupid)}, {$push: { "members": req.params.userid }}, function(error, group2){
                                        console.log("Joined group!")
                                        res.send("Joined group!");
                                    });
                                }
                            });
                        }
                    });
                }
            }
        });
    });

    app.get('/removeUserFromGroup/:groupid/:userid', (req, res) => {
        hdb.collection("users").findOne({"_id": ObjectID(req.params.userid)}, function(error, user){
            if(error) {
                console.log("Error leaving group 1")
                res.send("Error leaving group 1");
            }
            else {
                if (user.groups.includes(req.params.groupid)) {
                    hdb.collection("users").updateOne({"_id": ObjectID(req.params.userid)}, {$pull: { "groups": req.params.groupid }}, function(error, user2){
                        if(error) {
                            console.log("Error leaving group 2")
                            res.send("Error leaving group 2");
                        } else {
                            hdb.collection("groups").findOne({"_id": ObjectID(req.params.groupid)}, function(error, group){
                                if (group.members.includes(req.params.userid)) {
                                    hdb.collection("groups").updateOne({"_id": ObjectID(req.params.groupid)}, {$pull: { "members": req.params.userid }}, function(error, group2){
                                        console.log("Left group!")
                                        res.send("Left group!");
                                    });
                                } else {
                                    console.log("Already left group 2!")
                                    res.send("Already left group 2!");
                                }
                            });
                        }
                    });
                } else {
                    console.log("Already left group 1!")
                    res.send("Already left group 1!");
                }
            }
        });
    });

    app.get('/getAllPosts', (req, res) => {
        console.log("< Get all posts requested >");
        hdb.collection("posts").find().sort({"_id": -1}).toArray(function(error, posts){
            if(error) {
                console.log(error);
                res.send(error);
            } else {
                // hdb.collection("posts").updateMany({}, {$set: { "group": -1 }}, function(error, post) {
                //     console.log("done");
                // });
                res.json({posts: posts});
            }
        });
    });

    app.get('/getAllPosts/group/:id', (req, res) => {
        console.log("< Get all posts requested >");
        hdb.collection("posts").find({"group": req.params.id}).sort({"_id": -1}).toArray(function(error, posts){
            if(error) {
                console.log(error);
                res.send(error);
            } else {
                // hdb.collection("posts").updateMany({}, {$set: { "group": -1 }}, function(error, post) {
                //     console.log("done");
                // });
                res.json({posts: posts});
            }
        });
    });

    app.get('/getAllPosts/user/:id', (req, res) => {
        console.log("< Get all posts requested >");
        hdb.collection("posts").find().sort({"author": req.params.id}).toArray(function(error, posts){
            if(error) {
                console.log(error);
                res.send(error);
            } else {
                // hdb.collection("posts").updateMany({}, {$set: { "group": -1 }}, function(error, post) {
                //     console.log("done");
                // });
                res.json({posts: posts});
            }
        });
    });

    app.delete('/deletePost/:id', (req, res) => {
        console.log("< Delete post requested >");
        hdb.collection("posts").findOne({"_id": ObjectID(req.params.id)}, function(error, post){
            if(error) {
                res.send("Error finding post to delete");
                console.log("Error finding post to delete")
            } else {
                if (post.type == "image") {
                    var imageName = post.picName;
                    hdb.collection("posts").deleteOne({"_id": ObjectID(req.params.id)}, function(error, post2){
                        if(error) {
                            res.send("Error deleting post");
                            console.log("Error deleting post")
                        } else {
                            fs.unlink(__dirname + '/images/'+imageName, (err) => {
                                if (err) {
                                    console.log("Failed to delete local image:"+err);
                                } else {
                                    console.log('Successfully deleted local image');                                
                                }
                            });
                            res.send("Successfully deleted post");
                            console.log("Successfully deleted post");
                        }
                    });
                } else if (post.type == "video") {
                    var videoName = post.vidName;
                    hdb.collection("posts").deleteOne({"_id": ObjectID(req.params.id)}, function(error, post2){
                        if(error) {
                            res.send("Error deleting post");
                            console.log("Error deleting post")
                        } else {
                            fs.unlink(__dirname + '/images/'+videoName, (err) => {
                                if (err) {
                                    console.log("Failed to delete local video:"+err);
                                } else {
                                    console.log('Successfully deleted local video');                                
                                }
                            });
                            res.send("Successfully deleted post");
                            console.log("Successfully deleted post");
                        }
                    });
                } else {
                    hdb.collection("posts").deleteOne({"_id": ObjectID(req.params.id)}, function(error, post2){
                        if(error) {
                            res.send("Error deleting post");
                            console.log("Error deleting post")
                        } else {
                            res.send("Successfully deleted post");
                            console.log("Successfully deleted post");
                        }
                    });
                }
            }
        });
    });

    // Socket
    io.on('connection', (socket) => {
        console.log("Connection Detected: "+socket.request.connection.remoteAddress);

        socket.on('message', (data) => {
            var jsonMessage = JSON.parse('{"content": "'+data.message+'", "name": "'+data.name.username+'"}');
            hdb.collection("messages").insertOne(jsonMessage, function(error, msg) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('<- Message sent from '+msg.ops[0].name+': '+msg.ops[0].content+' ->');
                    io.emit('message', `${msg.ops[0].name}: ${msg.ops[0].content}`);
                }
            });
        });

        socket.on('addPost', () => {
            io.emit('post');
        });

        socket.on('getAllMessages', () => {
            hdb.collection("messages").find().sort({"_id": -1}).toArray(function(error, msgs) {
                if (error) {
                    console.log(error);
                } else {
                    io.emit('allMessages', msgs);
                }
            });
        });

        socket.on('getAllPosts', () => {
            console.log("< Get all posts requested >");
            hdb.collection("posts").find().sort({"_id": -1}).toArray(function(error, posts){
                if(error) {
                    console.log(error);
                } else {
                    // hdb.collection("posts").updateMany({}, {$set: { "group": -1 }}, function(error, post) {
                    //     console.log("done");
                    // });
                    io.emit('allPosts', posts);
                }
                
            });
        });

        socket.on('getAllPostsFeed', () => {
            console.log("< Get all posts requested >");
            hdb.collection("posts").find({"group": -1}).sort({"_id": -1}).toArray(function(error, posts){
                if(error) {
                    console.log(error);
                } else {
                    // hdb.collection("posts").updateMany({}, {$set: { "group": -1 }}, function(error, post) {
                    //     console.log("done");
                    // });
                    io.emit('allPostsFeed', posts);
                }
                
            });
        });

        socket.on('registerUser', (data) => {
            hdb.collection("users").insertOne(data, function(error, user) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('<- User Registered: '+user.ops[0].username+' ->');
                    io.emit('registerSuccess:'+`${user.ops[0].username}`);
                }
            });
        });

        // socket.on('addPost', (data) => {
        //     // console.log("Photo add requested: ");
        //     // console.log(data);
        // });

        socket.on('loginUser', (data) => {
            hdb.collection("users").findOne({"username": data.username}, function(error, user) {
                if (error) {
                    console.log(error);
                } 
                
                if (!user) {
                    console.log("<- Login Rejected: NO USER EXISTS ->");
                    io.emit('loginResult:'+data.username,{"type": 'User does not exist!'});
                }
                else {
                    bcrypt.compare(data.password, user.password, function(err, res) {
                        if (err) {
                            console.log("<- Login Error: "+err+" ->");
                        }

                        if (res) {
                            console.log('<- Login Successful: '+user.username+' ->');
                            io.emit('loginResult:'+user.username,{"type": "Success!","object": user});
                        }
                        else {
                            console.log("<- Login Failed: "+user.username+" ->");
                            io.emit('loginResult:'+user.username,{"type": "Incorrect Password!"});
                        }
                    });
                }
            });
        });
    });    
});
http.listen(socketPort, () => console.log('Socket listening on port '+socketPort+'...'));
app.listen(expressPort, () => console.log('Express listening on port '+expressPort+'...'));