var express = require('express');
var router = express.Router();


/* GET Hello World page. */
router.get('/helloworld', function(req, res) {
    res.render('helloworld', { title: 'Hello, World!' });
});


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'ss_Flash' });
});

module.exports = router;
