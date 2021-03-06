/**
 * Created by Madison on 2017-09-09.
 */

/*

Couple of small additions to make forward:
-> on save, spin up a job to try and find the audio file of the word.  Have an 'audio' button that auto-plays
the word on each successive card.  Could be useful for retaining more of the ennunciation of the words.

-> a overall metrics info point.  hover over it to get info on how many total cards, how many shown today, etc.
Eventually, we'll probably want to graph this out or something.  Could be cool to see for sure.



This needs to be implemented as a queue system.

On first load grab "n" items, keep in array.  On advance, update server, and grab a new one for the queue.

 */


// Userlist data array for filling in info box

// todo: there's a bug here when source is 1 card.
var card_stack = [];
var current_card;

var schedule_stack = [];
var schedule_retrieve_size = 20;
var most_recent = 0;

// max number of cards to add to a stack.  we'll use -1 to mean unlimited.
var max_stack_length = -1;

// default grades for fail and succeed.  Maybe change these based on response time?
var fail_grade = 1;
var succeed_grade = 4;

var enable_video_load = localStorage.getItem('videoEnabled') || 'true';
enable_video_load = 'false';
enable_video_load = (enable_video_load === 'true');
toggleVideo(enable_video_load);


var enable_audio_load = localStorage.getItem('audioEnabled') || 'true';

var global_data;

var bonus_ms_threshold = 2000; // the amt of time during which you can win a bonus in ms.
var page_start_ms_time = new Date().getTime();

// DOM Ready =============================================================
$(document).ready(function() {

    $('[data-toggle="tooltip"]').tooltip();
    // Populate the user table on initial page load
    initPage();

});


function get_stats_text() {

    return 'Total Cards in Deck: ' + '<b>' + global_data.total + '</b>' + '<br>' +
           'Cards Created Today: ' + '<b>' + global_data.total_created_today  + '</b>'

}


function toggleVideo(videoEnabled) {

    // enable_video_load = videoEnabled.toString();

    if (videoEnabled) {
        $('#vidContainer').show();
    } else {
        $('#vidContainer').hide();
    }

}



$('#videoOnOff').on('click', function(event){

    var video_on = $(this).prop('checked');
    localStorage.setItem('videoEnabled', video_on);

});


$('#audioOnOff').change(function(event){

    var audio_on = $(this).prop('checked');
    localStorage.setItem('audioEnabled', audio_on);
    enable_audio_load = audio_on.toString();

});





function updateGlobalData() {

    $.getJSON('words/getstats', function (resp) {

        console.log('received from get_stats: ', resp);

        global_data = resp;

        $('#info_button').attr('data-original-title', get_stats_text());

    });

}


/*
Heatmap calendar stuff:
 */

var cal;

function calculateCounts() {

    // try and get our data and calculate the counts per day for display
    // nb: should probably store the selection in global somewhee to avoid re-searching the DOM each time..

    d3.selectAll(".graph").selectAll(".graph-domain").each(function (d) {
        var day_group = d3.select(this);
        // console.log(day_group);
        // var text_thing = day_group.selectAll("");
        var day_elements = day_group.selectAll("svg g rect");
        // console.log(day_elements);

        var day_total = 0;
        day_elements.each(function (d) {
            day_total += d.v || 0;
        });


        // here we can set the text amount

        // this needs to parse out the existing text too...
        // console.log(day_group);

        var text_thing = day_group.selectAll("text")[0];
        // console.log(text_thing[0]);
        text_thing[0].textContent += ': ' + day_total.toString();
        // text_thing[0].setAttribute('style', 'white-space: pre;');
    });

    console.log('done calculating counts...');


}


function assignDateLabel(date) {

    /*
    If == today, return "today", tomorrow => "tomorrow" else, %a.
    Can probably use the d3 function itself here.
     */

    return date
}




function initHeatMap() {

    cal = new CalHeatMap();

    cal.init({

        highlight: "now",
        itemNamespace: "cal-heatmap",
        tooltip: true,

        itemName: ["Card", "Cards"],

        domainGutter: 6,
        displayLegend: false,

        range: 10,  // six months
        domain: "day",

        onComplete: calculateCounts,

        domainLabelFormat: '%a',
        // domainLabelFormat: assignDateLabel,
        data: "http://localhost:3000/words/getHeatMapData"  // change this..

    });


    // cal.init({
    //
    //     highlight: "now",
    //     itemNamespace: "cal-heatmap",
    //     tooltip: true,
    //
    //     itemName: ["Card", "Cards"],
    //
    //     domainGutter: 6,
    //     displayLegend: false,
    //
    //     range: 10,  // six months
    //     domain: "day",
    //
    //     onComplete: calculateCounts,
    //
    //     data: "http://localhost:3000/words/getHeatMapData"  // change this..
    //
    // });


}


function updateHeatMap() {
    cal.update('http://localhost:3000/words/getHeatMapData');
    // todo: still not updating counts properly
    // calculateCounts();
    // cal_day.update('http://localhost:3000/words/getHeatMapData');
}


function initPage() {

    /*
     Set up everything for initial pageload.
     */

    // if (enable_video_load !== 'true') {
    //     document.getElementById('videoOnOff').click();
    // }


    if (enable_audio_load === 'true') {
        console.log('audio is on!');
    } else {
        console.log('audio is off!');
        $('#audioOnOff').bootstrapToggle('toggle');
        // document.getElementById('audioOnOff').click();
    }


    addCardsToStack();
    updateGlobalData();
    initHeatMap();
}

function addCardsToStack() {

    /*
    Adds cards to our current stack.
     */


    $.getJSON( '/words/get_word', {'max_cards': max_stack_length}, function( data ) {

        console.log('received from get_words: ', data);

        var update_page = (card_stack.length === 0);

        // must be a better way to do this:
        $.each(data, function () {
            card_stack.push(this);
        });

        if (update_page) {
            advance();
        }

        updateGlobalData();

    });
}

function toggleButtons() {

    $('#showWord').toggle();
    $('#right').toggle();

    $('#oops').toggle();
    $('#doubleright').toggle();

}


function resetBonus() {

    // resets the animation of the bonus counter thing

    $('.run_animation').css({ fill: "none", stroke: "grey"});
    $('.panel-heading').css("background-color", "#e6e9ed");

    var target = $("#animator");
    target.toggle().toggle();  // can't believe it took so long to find this.  wtf.

    page_start_ms_time = new Date().getTime();

}



function advance() {

    /*
    Advance forward, updating our current page.
     */

    var card_text_sel = $('.card_text');
    card_text_sel.removeClass('wrong');
    card_text_sel.addClass('text-muted');

    current_card = card_stack.shift();

    // in case we reached the end of the stack:
    if (current_card === undefined) {
        $('.controlBtns').prop('disabled', true);
        $('#french').text('No Words Found');
        $('#english').text('Consider Adding More');
        $('#start_edit').prop('disabled', true).addClass('disabled');
        resetBonus();
        var target = $("#animator");
        target.toggle();
        return;
    }

    updateCurrentPage();

    // reset our counter:
    resetBonus();

}


function updateVideo() {

    return;  // disabled for now.

    /*
    Update the video player with the most current card's data
     */
    console.log('updating video....');

    var video_location = current_card.video_location;
    // test vid
    if (video_location === "") {
        video_location = "/video/s/supercut.mp4"
    }

    var video = document.getElementById('vid');
    // var source = document.createElement('vidSource');

    video.setAttribute('src', video_location);
    // video.appendChild(source);

}



$('#vid').parent().click(function () {

    if($(this).children(".video").get(0).paused){
        $(this).children(".video").get(0).play();
        $(this).children(".playpause").fadeOut();
    }

    else{
        $(this).children(".video").get(0).pause();
        $(this).children(".playpause").fadeIn();
    }
});




function updateCurrentPage() {

    /*
    Dummy function to test dev work.
     */

    var current_unix_time = Math.floor(Date.now() / 1000);

    updateVideo();

    $('#french').text(current_card.french);
    $('#english').text('_________');

    if (enable_audio_load === 'true') {
        console.log('i think audio is on, so i will play the word...');
        // say the word:
        lookup_play_word();
    } else {
        console.log('i dont think audio is on, so I will not play the word.');
    }




}



// Functions =============================================================

// Add Word
function addWord(event) {

    event.preventDefault();

    // Super basic validation - increase errorCount variable if any fields are blank
    var errorCount = 0;

    $('#addWord .inputCols input').each(function(index, val) {
        if ($(this).val() === '') {  errorCount++;  }
    });

    // Check and make sure errorCount's still at zero
    if (errorCount !== 0) {
        // If errorCount is more than 0, error out
        alert('Please fill in all fields');
        return false;
    }

    // compile all info into one object
    var newWord = {
        "french": $('#inputFrench').val(),
        "english": $('#inputEnglish').val()
    };

    console.log('attempting to add: ', newWord);

    // now post to server:
    $.post(
        '/words/addword',
        newWord
    ).done(
        function( response ) {
            // Check for unsuccessful (blank) response
            if (response.msg === '') {
                // Clear the form inputs
                $('#addWord .inputCols input').val('');
                alert('Response: ' + response.msg);
            }
            else {
                console.log('successfully added word');
                $('#addWord .inputCols input').val('');
                $('#inputFrench').focus();
                // If something goes wrong, alert the error message that our service returned
                updateHeatMap();
            }

            updateGlobalData();

        });

}

$('#startAddWordBtn').on('click', function () {

    $('#inputFrench').val('');
    var sound_found_sel = $('.soundFoundIndicator');

    sound_found_sel.removeClass('btn-success btn-danger glyphicon-volume-up glyphicon-volume-off');
    sound_found_sel.addClass('glyphicon-transfer');
    sound_found_sel.prop('disabled', true);

    // $('#inputFrench').focus();

} );




function updateWordData(word, grade, bonus) {

    // handle updating our server with the word's new grade
    // on the server side, this will update the word to the new trigger time.
    // once that has been done, we can update the heat map


    // todo: maybe we can just pass in the ID here and update based on that.
    // no one else uses this, so who cares safety-wise.

    if (bonus === undefined) {
        bonus = false;
    }


    $.post(
        '/words/updateword',
        {
            "french": word,
            "grade": grade,
            "bonus": bonus,
            "_id": current_card['_id']
        }
    ).done(
        function( response ) {
            console.log(response);
            // Check for unsuccessful (blank) response
            if (response.msg === '') {
                console.log('we totally failed!');
            }
            updateGlobalData();
            console.log('updating heatmap data...');
            updateHeatMap();

        });


}


function handleAnswer(answer_correct) {

    // user has answered.
//     if "give up" then:
    // show answer, wait 800ms, update server with score 1, advance to next card
    // otherwise, switch the buttons, tie those into new functions... etc

    console.log('ac', answer_correct);
    if (!answer_correct) {

        $('#english').text(current_card.english);

        var word = $('#french').text();
        updateWordData(word, fail_grade);

        // $('.card_text').toggleClass('text-muted', 'wrong');

        $('.card_text').addClass('wrong');
        $('.card_text').removeClass('text-muted');
        // setTimeout(advance, 800);
        setTimeout(advance, 1700);
        return;
    }

    // if the answer was correct, then this is our first pass.  just show the word for now.

    // Correct Answer:
    $('#english').text(current_card.english);

    // switch to second stage buttons:
    toggleButtons();



}








$('#btnAddWord').on('click', addWord);

$('#showWord').on('click', function(event) {
    event.preventDefault();
    handleAnswer(false);
});

$('#right').on('click', function(event) {
    event.preventDefault();
    handleAnswer(true);
});


$('#oops').on('click', function(event) {
    event.preventDefault();
    toggleButtons();
    handleAnswer(false);
});




$('#doubleright').on('click', function(event) {

    /*
    running this means that we really were successful!

    See if we are eligible for a bonus, and notify the server.

     */

    event.preventDefault();

    // do some kind of thing here if we were within the bonus time
    var curr_ms_time = new Date().getTime();
    var ms_diff = curr_ms_time - page_start_ms_time;
    var bonus_achieved = ms_diff < bonus_ms_threshold;
    console.log('page success happened after ms: ', ms_diff, 'bonus achieved: ', bonus_achieved);
    if (bonus_achieved) {
        $('.run_animation').css({ fill: "lawngreen", stroke:"green" });
        $('.panel-heading').css("background-color", "green");
    }


    toggleButtons();

    var word = $('#french').text();

    updateWordData(word, succeed_grade, bonus_achieved);

    setTimeout(advance, 200);

});



// track if we already have a request out there to avoid hitting the DB over and over again:
var getting_data = false;
function getScheduleData() {

    /*
    Gets and adds schedule data for us.
     */

    var current_time = Math.floor(Date.now() / 1000);

    getting_data = true;

    $.getJSON('words/getschedule', {"most_recent": most_recent, "limit": schedule_retrieve_size},

        function (resp) {

            console.log('received from get_words: ', resp);

            $.each(resp, function () {

                var target_data = '<li class="list-group-item"><strong>' + this.french;
                target_data += '</strong><small class="text-muted"> - ' + this.english;

                var modifier_class;
                if (this.trigger_time < current_time) {
                    target_data += '</small><span class="badge schedulePast"><span class="glyphicon-star-empty glyphicon"></span> </span></li>';

                } else {

                    target_data += '</small><span class="badge scheduleForward">' + this.moment_time + '</span></li>';
                }


                $('#wordList').append(target_data);


                // update our var keeping track of the most_recent time:
                if (this.trigger_time > most_recent) { most_recent = this.trigger_time; }

            });

            getting_data = false;

    });


}



$('#scheduleView').on('click', function (event) {
    event.preventDefault();
    getScheduleData();
});


$('#showScheduleModal').on('hidden', function (event) {
   console.log('modal closed...');
    console.log('modal closed...');
    console.log('modal closed...');

});



$('#wordList').scroll(function () {

    // todo: add spinner here on waiting server call;

    // console.log($("#wordList").scrollTop(), ($("#wordList").prop('scrollHeight')));

    // if we've scrolled more than 75% and aren't already getting data..
    if ( !getting_data &&
        ($("#wordList").scrollTop()/($("#wordList").prop('scrollHeight'))) >= .75) {
        getScheduleData();
    }
});



// Functions for editing existing words:

var current_edit_french;
var current_edit_english;

$('#start_edit').on('click', function (event) {

    // english -> french is basically a many to many relationship.  We don't necessarily want to edit all
    // occurences of a french word, but rather, the specific french + english pair.

    // so, save the original french and english on modal open, use those for the lookup values on the server side
    // then reset those again on save, in case of multiple saves.

    console.log('edit word started...');

    current_edit_french = current_card.french;
    current_edit_english = current_card.english;

    $('#editFrench').val(current_edit_french);
    $('#editEnglish').val(current_edit_english);

    // do a quick lookup of the existing word to color the sound btn correctly:
    check_for_existing_sounds(current_edit_french.trim());


});



function saveEditedWord() {

    console.log('saving word edit....');
    console.log('lookup vals: ', current_edit_french, current_edit_english);

    var btn_edit_word_sel = $('#btnEditWord');
    btn_edit_word_sel.prop('disabled', true);

    var target_update_french =  $('#editFrench').val();
    var target_update_english =  $('#editEnglish').val();

    console.log('target update values: ', target_update_french, target_update_english);

    var payload = {

        lookup_french: current_edit_french,
        lookup_english: current_edit_english,

        target_french: target_update_french,
        target_english: target_update_english

    };

    // now post to server:
    $.post('/words/save_pair', payload).done(function(response) {

        // here on success update global edit vars too..
        console.log('save pair response: ', response);
        if (response.update_successful) {
            console.log('successful update!', response);
        } else {
            console.log('unsuccessful update?', response);
        }

        // the card's values are now set on DB side, so track them accordingly:
        current_edit_french = target_update_french;
        current_edit_english = target_update_english;

        // re-enable save
        btn_edit_word_sel.prop('disabled', false);


        });


}


$('#btnEditWord').on('click', saveEditedWord);



// todo: use this var to rate-limit checking the server for a found word, but do it in such a way
// that we definitely DO get the final keypress.  Maybe save it and fire one last time?
// actually, do we really care? it's only num calls == num key presses after all
var currently_checking_db_for_sound = false;
var sound_found;


function check_for_existing_sounds(lookup) {
    console.log('some sort of editing is in progress on the french side...');

    var sound_found_sel = $('.soundFoundIndicator');

    currently_checking_db_for_sound = true;
    sound_found_sel.removeClass('btn-success btn-danger glyphicon-volume-up glyphicon-volume-off');
    sound_found_sel.addClass('glyphicon-transfer');
    sound_found_sel.prop('disabled', true);

    //start spinner

    console.log('this is val: ', lookup);
    // start spinner, do check of DB for sound.  Fail: orange, green: found.  multiple options?

    $.get('/words/sound', {sound: lookup}, function (res, err) {
        // console.log('received from getting sound: ', res, err);

        if (res.found) {
            console.log('found a match!', res);
            sound_found_sel.addClass('btn-success glyphicon-volume-up');
            sound_found_sel.removeClass('btn-danger glyphicon-volume-off glyphicon-transfer');
            sound_found_sel.prop('disabled', false);
            sound_found = res;
        }
        else {
            console.log('unable to find a match :<');
            sound_found_sel.addClass('btn-danger glyphicon-volume-off');
            sound_found_sel.removeClass('btn-success glyphicon-volume-up glyphicon-transfer');
            sound_found_sel.prop('disabled', true);
        }

        currently_checking_db_for_sound = false;
        //end spinner


    });

}

// check for sounds on edit:
$('#editFrench').keyup(function() {
    var lookup = $('#editFrench').val().trim();
    check_for_existing_sounds(lookup);
});

// check for sounds on add:
$('#inputFrench').keyup(function () {
    var lookup = $('#inputFrench').val().trim();
    check_for_existing_sounds(lookup);
});


$('.soundFoundIndicator').on('click', function (e) {
    console.log('sounds selector was clicked');
    var audio = document.getElementById("audio");
    audio.src = sound_found.location;
    audio.play();
});




$('#info_button').tooltip({
    title: "Total Cards in Deck",
    placement: "bottom",
    html: true
});

$('#info_button').hover(function (event) {
   // console.log('oh chits mang, global data:', global_data);

    $('#info_button').tooltip();


});




function play_word(lookup_text) {

    /*
    Receives the full text for a lookup.  Server side will decide what to return as a proper match.
    This is probably duplicating the stuff in the edit/add buttons...  eh, i guess it's kind of different enough.
    The api call should be generalized somewhere though.
     */

    console.log('looking up', lookup_text);

    $.get('/words/sound', {sound: lookup_text}, function (res, err) {

        console.log('received from getting sound: ', res, err);

        if (res.found) {
            console.log('found a sound to play: ', res);
            var audio = document.getElementById("audio");
            audio.src = res.location;
            audio.play();

        } else {
            console.log('unable to find sound to play');
        }


    });

}



function lookup_play_word() {
    /*
    Looks up the current french word and plays it if we can find it.
     */

    var lookup = current_card.french;
    play_word(lookup);

}






// a dumb btn for testing things

$('#dumbBtn').on('click', function (e) {

    e.preventDefault();
    console.log('dumb button was pressed');
    lookup_play_word();

});


