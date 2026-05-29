const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();

/* ================= CONFIG ================= */
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "poocoo-secret",
    resave: false,
    saveUninitialized: false,
  })
);

/* ================= FILES ================= */
const usersFile = "./database/users.json";
const postsFile = "./database/posts.json";
const notifFile = "./database/notifications.json";
const messagesFile = "./database/messages.json";
/* ================= HELPERS ================= */
function read(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function addNotification(to, from, message) {
  const notifications = read(notifFile);

  notifications.unshift({
    id: Date.now(),
    to: to,
    from: from,
    message: message,
    time: new Date().toLocaleString(),
    read: false
  });

  write(notifFile, notifications);
}

/* ================= HOME (SMART FEED) ================= */
app.get("/", (req, res) => {
  const posts = read(postsFile);
  const users = read(usersFile);

  const me = users.find(u => u.username === req.session.user);

  let feed = posts;

  if (me) {
    feed = posts.filter(post =>
      post.username === req.session.user ||
      (me.circles || []).includes(post.username)
    );
  }

  res.render("index", {
    user: req.session.user,
    posts: feed
  });
});

/* ================= REGISTER ================= */
app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  const users = read(usersFile);

  users.push({
    username: req.body.username,
    password: req.body.password,
    circles: [],
    profilePic: "/uploads/profile/default.png"
  });

  write(usersFile, users);
  res.redirect("/login");
});

/* ================= LOGIN ================= */
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const users = read(usersFile);

  const user = users.find(
    u =>
      u.username === req.body.username &&
      u.password === req.body.password
  );

  if (!user) return res.send("Login failed");

  req.session.user = user.username;

  res.redirect("/");
});

/* ================= POST (DROP + ANONYMOUS) ================= */
app.post("/post", (req, res) => {
  const posts = read(postsFile);

  let username = req.session.user;

  if (req.body.anonymous) {
    username = "Anonymous 👻";
  }

  posts.unshift({
    id: Date.now(),
    username: username,
    content: req.body.content,
    mood: req.body.mood,
    reactions: {
  echo: [],
  love: [],
  fire: [],
  laugh: [],
  wow: []
},
    comments: [],
    time: new Date().toLocaleString()
  });

  write(postsFile, posts);
  res.redirect("/");
});

/* ================= ECHO SYSTEM ================= */
app.post("/like", (req, res) => {
  const posts = read(postsFile);

  posts.forEach(post => {
    if (post.id == req.body.id) {
      if (!post.likes.includes(req.session.user)) {
        post.likes.push(req.session.user);

        if (post.username !== "Anonymous 👻") {
          addNotification(
            post.username,
            req.session.user,
            "echoed your drop ⚡"
          );
        }
      }    }
  });

  write(postsFile, posts);
  res.redirect("/");
});

/* ================= COMMENTS ================= */
app.post("/comment", (req, res) => {
  const posts = read(postsFile);

  posts.forEach(post => {
    if (post.id == req.body.id) {
      post.comments.push({
        user: req.session.user,
        text: req.body.comment
      });

      if (post.username !== "Anonymous 👻") {
        addNotification(
          post.username,
          req.session.user,
          "replied to your drop 💬"
        );
      }
    }
  });

  write(postsFile, posts);
  res.redirect("/");
});

/* ================= PROFILE ================= */
app.get("/profile/:username", (req, res) => {
  const users = read(usersFile);
  const posts = read(postsFile);

  const user = users.find(u => u.username === req.params.username);

  if (!user) return res.send("User not found");

  const userPosts = posts.filter(p => p.username === req.params.username);

  res.render("profile", {
    profileUser: user,
    posts: userPosts,
    user: req.session.user
  });
});

/* ================= ADD TO CIRCLE ================= */
app.post("/add-circle", (req, res) => {
  const users = read(usersFile);

  const me = users.find(u => u.username === req.session.user);
  const other = req.body.user;

  if (me && !me.circles.includes(other)) {
    me.circles.push(other);

    addNotification(
      other,
      req.session.user,
      "added you to their circle 🔗"
    );
  }

  write(usersFile, users);
  res.redirect("/profile/" + other);
});
app.get("/notifications", (req, res) => {
  const notifications = read(notifFile);

  const userNotifications = notifications.filter(
    n => n.to === req.session.user
  );

  res.render("notifications", {
    user: req.session.user,
    notifs: userNotifications
  });
});

/* ================= LOGOUT ================= */
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/messages", (req, res) => {
  const messages = read(messagesFile);

  const myMessages = messages.filter(
    message =>
      message.to === req.session.user ||
      message.from === req.session.user
  );

  res.render("messages", {
    user: req.session.user,
    messages: myMessages
  });
});

app.post("/message", (req, res) => {
  const messages = read(messagesFile);

  messages.push({
    id: Date.now(),
    from: req.session.user,
    to: req.body.to,
    text: req.body.text,
    time: new Date().toLocaleString()
  });

  write(messagesFile, messages);

  addNotification(
    req.body.to,
    req.session.user,
    "sent you a message 💬"
  );

  res.redirect("/messages");
});

app.get("/search", (req, res) => {
  const users = read(usersFile);

  const q = req.query.q || "";

  const results = users.filter(user =>
    user.username.toLowerCase().includes(q.toLowerCase())
  );

  res.render("search", {
    user: req.session.user,
    results,
    query: q
  });
});

app.get("/api/posts", (req, res) => {
  const posts = read(postsFile);
  res.json(posts);
});

app.post("/react", (req, res) => {
  const posts = read(postsFile);

  const { id, type } = req.body;

  posts.forEach(post => {
    if (post.id == id) {
      if (!post.reactions[type].includes(req.session.user)) {
        post.reactions[type].push(req.session.user);
      }
    }
  });

  write(postsFile, posts);
  res.redirect("/");
});

/* ================= START SERVER ================= */
const PORT = 3000;

app.listen(PORT, () => {
  console.log("⚡ Poocoo running on port " + PORT);
});
