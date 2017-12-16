/**
 * Created by Madison on 2017-09-09.
 */

/*
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


// DOM Ready =============================================================
$(document).ready(function() {

    // Populate the user table on initial page load
    initPage();

});



function toggleVideo(videoEnabled) {

    enable_video_load = videoEnabled.toString();

    if (videoEnabled) {
        $('#vidContainer').show();
    } else {
        $('#vidContainer').hide();
    }

}



$('#videoOnOff').on('click', function(event){

    toggleVideo(this.checked);
    localStorage.setItem('videoEnabled', this.checked);

});


function initPage() {

    /*
     Set up everything for initial pageload.
     */

    if (enable_video_load !== 'true') {
        document.getElementById('videoOnOff').click();
    }


    addCardsToStack();
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

    });
}

function toggleButtons() {

    $('#showWord').toggle();
    $('#right').toggle();

    $('#oops').toggle();
    $('#doubleright').toggle();

}

function advance() {

    /*
    Advance forward, updating our current page.
     */

    current_card = card_stack.shift();

    // in case we reached the end of the stack:
    if (current_card === undefined) {
        $('.controlBtns').prop('disabled', true);
        $('#french').text('No Words Found');
        $('#english').text('Consider Adding More');
        return;
    }

    updateCurrentPage();
    $('.card_text').removeClass('wrong');
    $('.card_text').addClass('text-muted');



}


function updateVideo() {

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
            // Check for successful (blank) response
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


            }

        });


}


function updateWordData(word, grade) {

    // handle updating our server with the word's new grade

    $.post(
        '/words/updateword',
        {
            "french": word,
            "grade": grade
        }
    ).done(
        function( response ) {
            console.log(response);
            // Check for successful (blank) response
            if (response.msg === '') {
                console.log('whateverrrrrrrrrr');
            }
            // else {
            //     If something goes wrong, alert the error message that our service returned
                // alert('Response: ' + response.msg);
            //
            // }

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

    event.preventDefault();

    toggleButtons();

    var word = $('#french').text();
    updateWordData(word, succeed_grade);
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

    // console.log($("#wordList").scrollTop(), ($("#wordList").prop('scrollHeight')));

    // if we've scrolled more than 75% and aren't already getting data..
    if ( !getting_data &&
        ($("#wordList").scrollTop()/($("#wordList").prop('scrollHeight'))) >= .75) {
        getScheduleData();
    }
});



