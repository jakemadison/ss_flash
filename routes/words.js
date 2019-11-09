/**
 * Created by Madison on 2017-09-09.
 */

/*
Okay, so places to go from here:

- Add a lock/unlock button that allows the routes to actually work on server side and otherwise just doesn't allow
the DB to get written to

- Allow for audio snippits.  Possibly a way to then take a movie and cut it up based on silences, import it into
the system in chunks and present that?  With english subtitles as the translation bit.

- Button to do text only vs the above.

- nice to have: github style calendar of the upcoming dates, with heatmap intensity by number of words on that day
- if it was at the bottom of the page (but hideable) and live updating, that would be really cool.

- make the above hideable.
- add another heatmap? some kind of style thing, where it just shows pending cards for today.  as like, little
consumeable blocks?

- under a certain time for correct answer, give a bonus of... something.  a day maybe.
- add a little bonus countdown wheel.  little circle thing would be nice
- make sure that we are adding them at times.. i think we are.
- are we adding based on current time? or are we adding based on original trigger time?
- still need to hook in the edit functionality again... oops.
- average number right/wrong? some kind of scoring thing?
- % correct today, % correct of all time. that would be badass.
---> probably a different table



--> with the heatmap, there's a difference:
- heatmap will colour in all things during this hour, but the stack itself
- looks at the actual time.  so, say it's 7:15, stack will be < 7:15, but
heatmap will be < 8.

- could make the stack push to the hour. makes more sense then pushing heatmap data around.

to do:
- no animation of bonus on no words found.
- make sure animation restart works

-- more stats I'd like to have:
- how many times has this word been right/wrong
- how many words right/wrong that day.




- add a dictionary lookup that also functions while typing that you can hover over and it will give
info on the word.

- same dictionary icon could be in the card for availability on hover.


- do focus properly on modal opens (edit/add)

- replace our ugly toggles with something.  http://www.bootstraptoggle.com/ ?


- this really needs a deploy pipeline.  What I want to set up is a way for commits to automatically update
- an existing page


- add a setting for audio but no text which then just plays clips

 */

var sound_db = require('./sound_db');
var sound_index = require('../public/sound_db/tag_index.json');
var express = require('express');
var moment = require('moment');
var fs = require('fs');
var router = express.Router();

var interval_amount = 86400; // day
// var interval_amount = 60; // minute



function shuffle(array) {
    var m = array.length, t, i;

    // While there remain elements to shuffle…
    while (m) {

        // Pick a remaining element…
        i = Math.floor(Math.random() * m--);

        // And swap it with the current element.
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }

    return array;
}




function check_sound_word_exists(sound_word) {

    /*
    receive a word/phrase and check if it exists in our sound DB.

    If it does not, return False
    If it does, return the value associated with it with some useful data (file location, for example).
     */

    if (sound_index[sound_word] === undefined) {
        return {
            found: false
        };
    }

    else {

        var fileId = sound_index[sound_word].filename;
        var location = './sounds/'+fileId+'.wav';

        return {
            found: true,
            filename: fileId,
            location: location,
            sound_req: sound_word
        };

    }

}



router.get('/sound', function (req, res, next) {

    /*
    Receives a sound to lookup.  Checks our index, grabs the file location and returns it.
    Needs to do some juggling to figure out which word to say.

    todo: Right now this is confused between whether the front end should send each word in sequence,
    or the backend should do some juggling, audio munging to get the correct sound file out.

    todo: recognition of verb conjugations here would be hard but possibly worth it.  At least as like a
    suggestion for add/edit.

    So, could return, "not found, but closest match: "
     */

    console.log('request for sound file...');
    var sound_req = req.query.sound;

    console.log('request for sound: ', sound_req);
    console.log(sound_index[sound_req]);

    var payload = {};

    if (sound_req === undefined) {
        payload.found = false;
        res.json(payload);
        return;
    }

    payload = check_sound_word_exists(sound_req);

    if (payload.found) {
        res.json(payload);
        return;
    }

    // if we can't find the whole phrase, try something else:
    var minor_articles = ['le', 'la', 'un', 'une', 'de', 'des', 'se'];

    // split into component words
    var lookup_array = sound_req.split(' ');

    // remove minor articles of speech
    var main_words = lookup_array.filter(function (e) {
        return this.indexOf(e)<0;
    }, minor_articles);

    // if we are only left with one word:
    if (main_words.length === 1) {

        var target_word = main_words[0];
        // check to see if it is a contraction:
        if (target_word.indexOf("'") > -1) {
            // split again on the apostraphe:
            lookup_array = sound_req.split("'");

            // take the element after the apostraphe:  --> what if num ' > 1?
            target_word = lookup_array[1];

        }


        payload = check_sound_word_exists(target_word);
        res.json(payload);
        return;
    }

    // if we still have more than one word, try the phrase as a whole again.  We should still have the same order of
    // words according to the js spec on `filter`.
    var main_phrase = main_words.join(' ');
    payload = check_sound_word_exists(main_phrase);
    res.json(payload);

});



/* GET users listing. */
router.get('/get_word', function(req, res, next) {

    var db = req.db;
    var collection = db.get('wordcollection');

    var n_cards = parseInt(req.query.n_cards);
    var cur_ids = req.query.cur_ids || [];

    console.log('n_cards', n_cards);
    console.log('cur_ids', cur_ids);

    var current_unix_time = Math.floor(Date.now() / 1000);


    //Pimsleur:
    // The intervals published in Pimsleur's paper were:
    // 5 seconds, 25 seconds, 2 minutes, 10 minutes, 1 hour, 5 hours, 1 day, 5 days, 25 days, 4 months, and 2 years.
    // so this would go by "created" date, and we would need to track what stage the word is at.
    // every correct answer is basically, add this amount of time to our word's countdown timer


    //Leitner:
    // Suppose there are 3 boxes of cards called "Box 1", "Box 2" and "Box 3". The cards in Box 1 are the ones that
    // the learner often makes mistakes with, and Box 3 contains the cards that they know very well.
    // They might choose to study the Box 1 cards once a day, Box 2 every 3 days, and the Box 3 cards every 5 days.
    // If they look at a card in Box 1 and get the correct answer, they "promote" it to Box 2. A correct answer with
    // a card in Box 2 "promotes" that card to Box 3. If they make a mistake with a card in Box 2 or Box 3,
    // it gets "demoted" to the first box, which forces the learner to study that card more often.

    // Super-memo sm-2:
    // this one actually looks like the best.. so, each item gets an init time, then a formula determines the optimal
    // time to send it to the stack.  So here we only want to return all cards with trigger time > current time
    //
    // -->  https://www.wired.com/2008/04/ff-wozniak/?&currentPage=all
    //


    // right now this will just keep returning the same word until that word gets updated..
    collection.find(

        // {},  // <= gets everything
        { trigger_time: {$lt: current_unix_time} },

        {},

        function (e, docs) {
            var rando_docs = shuffle(docs);
            res.json(rando_docs);
        }
    );


});


router.get('/getschedule', function (req, res, next) {

    // get the entire schedule using moment to print things nicely:

    var db = req.db;
    var collection = db.get('wordcollection');

    // number to get from DB:
    var limit = req.query.limit || 30;
    // trigger_time we're already at:
    var most_recent = req.query.most_recent || 0;

    console.log('getting collection with ', limit, 'results later than ', most_recent);

    collection.find(

        // {},  // <= gets everything
        {trigger_time: {$gt: parseFloat(most_recent)}},

        {
            sort: {trigger_time: 1},
            limit: parseInt(limit)
        },

        function (e, docs) {

            console.log('retrieved ', docs.length, ' results');

            docs.forEach( function (d) {
                d.moment_time = moment(d.trigger_time, "X").fromNow();
            });

            res.json(docs);
        }
    );


});


router.get('/getHeatMapData', function (req, res, next) {
    // get the entire schedule using moment to print things nicely:

    console.log('getting heatmap data....');
    var db = req.db;
    var collection = db.get('wordcollection');

    var current_unix_time = Math.floor(Date.now() / 1000);

    collection.find(

        {},  // <= gets everything
        {trigger_time:1, _id:0},

        function (e, docs) {

            var final_data = {};

            docs.forEach( function (d) {

                var this_time;

                if (d.trigger_time < current_unix_time) {
                    this_time = current_unix_time;

                } else {
                    this_time = d.trigger_time;
                }
                if (! (this_time in final_data)) {
                    final_data[this_time] = 0;
                }

                final_data[this_time] += 1;

            });

            console.log('heatMap is done');
            res.json(final_data);
        }
    );


});


router.get('/getstats', function (req, res, next) {

    /*
    What kind of stats do we want?
    - Total Number cards
    - Total number correct? Incorrect?  Do we really care about that?
    - Total cards for today? - Total cards for tomorrow?
    - Total added today?

    Created today should probably be "since midnight" and not "over the past 24 hours"

     */

    console.log('get stats was called!');
    var db = req.db;
    var collection = db.get('wordcollection');

    var current_unix_time = Math.floor(Date.now() / 1000);
    var twenty_four_hours = 24 * 60 * 60;
    var time_threshold = current_unix_time - twenty_four_hours;

    var response_vals = {
        total: 0,
        total_created_today: 0
    };

    collection.count({},  function (e, docs) {

        response_vals.total = docs;

        collection.count( { created_time: { $gt: time_threshold } }, function (e, docs) {

            response_vals.total_created_today = docs;

            res.json(response_vals);

        });

    });

});




function determineTriggerTime(grade, easiness_factor, repetitions, interval, bonus) {

    // determine the next time that our word should trigger to get added to a stack,
    // this is basically the SM-2 algo.

    // EF:= EF+ (0.1 - (5-Grade)* (0.08 + (5-Grade) *0.02 ) );
    // if EF<1.3 then
    // EF:=1.3;

    // console.log('interval going in...', interval);

    var current_unix_time = Math.floor(Date.now() / 1000);

    var new_easiness = easiness_factor + (0.1 - (5.0 - grade) * (0.08 + (5.0 - easiness_factor) * 0.02));

    if (new_easiness < 1.3) { new_easiness = 1.3; }

    if (grade < 3) {
        repetitions = 0;
    }
    else {
        repetitions++;
    }

    if (repetitions <= 1) {
        interval = 1;
    }
    else if (repetitions === 2) {
        interval = 6;
    }
    else {
        // shouldn't interval here always be more than 6?
        interval *= new_easiness;
    }

    var next_update_time = current_unix_time + (interval_amount * interval);

    if (bonus) {
        // assing a random bonus amount from .5 to 1 * interval_amount (usually day)
        var bonus_amount = Math.random() * (interval_amount - (interval_amount/2));
        console.log('adding bonus of', bonus_amount);
        next_update_time += bonus_amount;
    }
    console.log(
        'easiness: ', easiness_factor,
        'new easiness: ', new_easiness,
        'interval: ', interval,
        'repetitions: ', repetitions,
        'grade:', grade,
        'bonus:', bonus,
        'interval amt:', interval_amount
    );
    console.log('this word will next update on:', moment(next_update_time, "X").fromNow());

    return {
        "interval": interval,
        "repetitions": repetitions,
        "next_update_time": next_update_time,
        "easiness_factor": new_easiness
    }


    
}


/* POST to Add Word Service */
router.post('/addword', function(req, res) {

    var initial_easiness = 2.5;

    // Set our internal DB variable
    var db = req.db;

    // Get our form values. These rely on the "name" attributes
    var french = req.body.french;
    var english = req.body.english;

    // Set our collection
    var collection = db.get('wordcollection');

    var current_unix_time = Math.floor(Date.now() / 1000);

    var payload = {
        "french" : french,
        "english" : english,
        "created_time": current_unix_time,
        "trigger_time": current_unix_time + interval_amount,
        "interval": 1,
        "easiness_factor": initial_easiness,
        "repetitions": 0
    };

    console.log('payload: ', payload);
    console.log('req: ', req.body);

    // Submit to the DB
    collection.insert(payload, function (err, doc) {

        if (err) {
            console.log('something fucked up!', err);
            // If it failed, return error
            res.json({"msg": "There was a problem adding the information to the database."});
        }
        else {
            // And forward to success page
            res.json({"msg": "saved successfully!"});
        }
    });
});


router.post('/updateword', function (req, res) {

    var db = req.db;
    var french = req.body.french;

    // grade represents how well we did on a 0-5 scale, 5 being best.
    var grade = parseInt(req.body.grade.trim()) || 3;

    var bonus = req.body.bonus;

    var id = req.body._id;

    console.log('update word received a bonus status of: ', bonus);

    if (grade > 5 || grade < 0) {
        console.log('bad grade value: ', grade);
        res.json({"msg": "There was a problem adding the information to the database."});
        return;
    }


    var collection = db.get('wordcollection');

    console.log('updating word: ', french, id);


    collection.find(
        // { french: french },
        { _id: id },

        {}
            ).then(function(docs) {

                console.log('found these docs...', docs);


                docs.forEach(function (doc) {

                     var newWordData = determineTriggerTime(grade, doc.easiness_factor, doc.repetitions, doc.interval, bonus);

                     console.log('updating doc to:', newWordData);

                     doc.easiness_factor = newWordData.easiness_factor;
                     doc.repetitions = newWordData.repetitions;
                     doc.trigger_time = newWordData.next_update_time;
                     doc.interval = newWordData.interval;

                     console.log('updating to:', doc);
                     collection.update(
                         {french: french, _id: id},
                         doc
                     );

                     console.log('done updating!!', doc);

             });
        console.log('all docs updated-d-d-d-d');
        res.json({"msg": "Things all sent off to the DB.."});


        });


} );



router.post('/save_pair', function (req, res) {

    console.log('requested to save word pair');

    var db = req.db;
    var collection = db.get('wordcollection');
    var targets = {
        lookup_french: req.body.lookup_french,
        lookup_english: req.body.lookup_english,
        target_french: req.body.target_french,
        target_english: req.body.target_english
    };

    console.log('requested info: ', targets);

    collection.update(
        { french: targets.lookup_french, english: targets.lookup_english },
        {
            $set: {
                french: targets.target_french,
                english: targets.target_english
            }
        }
    ).then(function(docs) {
        console.log('finished updating.. udpated: ', docs);
        res.json({"update_successful": true})
    });


});



module.exports = router;
