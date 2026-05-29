const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'poocoo-secret',
  resave: false,
  saveUninitialized: false
}));

// FILES
const usersFile = './database/users.json';
const postsFile = './database/posts.json';

// SAFE READ
function read(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return [];
  }
}

// HOME
app.get('/', (req, res) => {
  const posts = read(postsFile);

  res.render('index', {
    user: req.session.user,
    posts
  });
});

// REGISTER
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const users = read(usersFile);

  users.push({
    username: req.body.username,
    password: req.body.password
  });

  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  res.redirect('/login');
});

// LOGIN
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const users = read(usersFile);

  const user = users.find(u =>
    u.username === req.body.username &&
    u.password === req.body.password
  );

  if (user) {
    req.session.user = user.username;
    res.redirect('/');
  } else {
    res.send("Login Failed");
  }
});

// POST
app.post('/post', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const posts = read(postsFile);

  posts.unshift({
    id: Date.now(),
    username: req.session.user,
    content: req.body.content,
    time: new Date().toLocaleString(),
    likes: [],
    comments: []
  });

  fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
  res.redirect('/');
});

// LIKE
app.post('/like', (req, res) => {
  const posts = read(postsFile);

  posts.forEach(p => {
    if (p.id == req.body.id && !p.likes.includes(req.session.user)) {
      p.likes.push(req.session.user);
    }
  });

  fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
  res.redirect('/');
});

// COMMENT
app.post('/comment', (req, res) => {
  const posts = read(postsFile);

  posts.forEach(p => {
    if (p.id == req.body.id) {
      p.comments.push({
        user: req.session.user,
        text: req.body.comment
      });
    }
  });

  fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
  res.redirect('/');
});

// PROFILE
app.get('/profile/:user', (req, res) => {
  const posts = read(postsFile);

  const userPosts = posts.filter(p => p.username === req.params.user);

  res.render('profile', {
    user: req.params.user,
    posts: userPosts
  });
});

// LOGOUT
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Poocoo running on port " + PORT);
});
