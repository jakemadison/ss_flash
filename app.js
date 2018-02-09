/*
SS_Flash: Stupid Simple Flashcard app.

 Basic implementation, to learn node/jade/mongo/whatever
 - require/seed DB with min number of words
 - very simple, single page app
 - display a word, countdown timer, show definition.
 - two buttons, "got it" "not got it", not got it, show the word move on
 - got it, show the word, maybe a sec to change answer

 ---
 - editing side, add new word, add definition, save to DB

 ---
 - create a TTL based on right/wrong answers with something like an
 exponential backoff for correct answers.  Pimsleur method, whatever.


 Nice extra features:
 ---
 On enter a new word:
 -  grab a suggested definition -> not the word, grab some more to choose from or enter your own.
 -  grab a soundfile (wikipedia?)
 -  grab an example sentence or 5.
 -  grab/save n photos of the word?  select a photo to pair with word on initial entry?
 -  conjugation? --> it would be nice if this wasn't too tightly coupled to any one particular language



 Down the line:
 -> buzzstop, use websocket i.o. for realtime updates based on location
 and recalculation of whatever, while polling bus locations.


*/




var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

// Database
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/ss_db');


var index = require('./routes/index');
var users = require('./routes/users');
var words = require('./routes/words');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'sailing2.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/sounds', express.static(path.join(__dirname, 'public/sound_db/flac_bk/wavs')));


// Make our db accessible to our router
app.use(function(req,res,next){
    req.db = db;
    next();
});


app.use('/', index);
app.use('/words', words);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
