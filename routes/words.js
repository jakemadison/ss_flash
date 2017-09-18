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

 */

var express = require('express');
var moment = require('moment');
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




function determineTriggerTime(grade, easiness_factor, repetitions, interval) {

    // determine the next time that our word should trigger to get added to a stack,
    // this is basically the SM-2 algo.

    // EF:=EF+(0.1-(5-Grade)*(0.08+(5-Grade)*0.02));
    // if EF<1.3 then
    // EF:=1.3;

    var current_unix_time = Math.floor(Date.now() / 1000);

    var new_easiness = easiness_factor + (0.1 - (5.0 - grade) * (0.08 + (5.0 - easiness_factor) * 0.02));

    if (new_easiness < 1.3) { new_easiness = 1.3; }

    if (grade < 3) {
        repetitions = 0;
    }
    else {
        repetitions++;
    }

    if (repetitions === 1) {
        interval = 1;
    }
    else if (repetitions === 2) {
        interval = 6;
    }
    else {
        interval *= new_easiness;
    }

    var next_update_time = current_unix_time + (interval_amount * interval);

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

    if (grade > 5 || grade < 0) {
        console.log('bad grade value: ', grade);
        res.json({"msg": "There was a problem adding the information to the database."});
        return;
    }


    var collection = db.get('wordcollection');

    console.log('updating word: ', french);



    collection.find(
        { french: french },
        {}
            ).then(function(docs) {
         console.log('found these docs...', docs);
         docs.forEach(function (doc) {

             var newWordData = determineTriggerTime(grade, doc.easiness_factor, doc.repetitions, doc.interval);

             console.log('updating doc to:', newWordData);

             doc.easiness_factor = newWordData.easiness_factor;
             doc.repetitions = newWordData.repetitions;
             doc.trigger_time = newWordData.next_update_time;

             console.log('updating to:', doc);
             collection.update(
                 {french: french},
                 doc
             );

             console.log('done updating:', doc);
             res.json({"msg": "Things all sent off to the DB.."});
         })


        });
    //
    //     .then(function () {
    //
    //     res.json({"msg": "Things all sent off to the DB.."});
    // });




    // function (docs) {
    //
    //         docs.forEach( function (doc) {
    //
    //             console.log('here is a doc i found:', doc);
    //
    //             var newWordData = determineTriggerTime(grade, doc.easiness_factor, doc.repetitions, doc.interval);
    //
    //             console.log('updating doc to:', newWordData);
    //
    //             doc.easiness_factor = newWordData.easiness_factor;
    //             doc.repetitions = newWordData.repetitions;
    //             doc.trigger_time = newWordData.next_update_time;
    //
    //             console.log('updating to:', doc);
    //             collection.update(
    //                 {french: french},
    //                 doc
    //             );
    //
    //             console.log('done updating:', doc);
    //
    //
    //         });
    //
    //         console.log('all done?');
    //         res.json({"msg": "Things all sent off to the DB.."});
    //
    //
    //     }
    // );

    //
    //
    //
    // collection.find({ french: french }, { stream: true })
    //     .each(function(doc) {
    //
    //             console.log('here is a doc i found:', doc);
    //
    //             var newWordData = determineTriggerTime(grade, doc.easiness_factor, doc.repetitions, doc.interval);
    //
    //             console.log('updating doc to:', newWordData);
    //
    //             doc.easiness_factor = newWordData.easiness_factor;
    //             doc.repetitions = newWordData.repetitions;
    //             doc.trigger_time = newWordData.next_update_time;
    //
    //             console.log('updating to:', doc);
    //             collection.update(
    //                 {french: french},
    //                 doc
    //             );
    //
    //         console.log('done updating:', doc);
    //         });

    // TODO: i think this might just be stalling out and not finishing the process...
    // TODO: it's also definitely not updating all of the trigger dates.
    // for some reason, adding success/error here dies with 500
        //
        // .error(function(err) {
        //     console.log('something fucked up!', err);
        //     res.json({"msg": "There was a problem adding the information to the database."});
        // });


    // console.log('what?');




} );



module.exports = router;
