require('dotenv').config();
var Botkit = require('botkit');
var Botkit_Redis_Storage = require('./botkit_redis_storage.js');

// make sure all env vars are set
if (!process.env.DOGBOT_SLACK_CLIENT_ID 
    || !process.env.DOGBOT_SLACK_CLIENT_SECRET 
    || !process.env.DOGBOT_SLACK_VERIFICATION_TOKEN 
    || !process.env.DOGBOT_SLACK_OAUTH_REDIRECT_URI 
    || !process.env.REDIS_URL 
    || !process.env.PORT) {
    console.log('Error: [DOGBOT_SLACK_CLIENT_ID, DOGBOT_SLACK_CLIENT_SECRET, DOGBOT_SLACK_VERIFICATION_TOKEN, DOGBOT_SLACK_OAUTH_REDIRECT_URI, REDIS_URL, PORT] env vars must all be set!');
    process.exit(1);
}
// connect to Redis
var redis = new Botkit_Redis_Storage({url: process.env.REDIS_URL});
// start up botkit controller with Redis as its persistence
var controller = Botkit.slackbot({
    storage: redis,
    interactive_replies: true,
}).configureSlackApp({
    clientId: process.env.DOGBOT_SLACK_CLIENT_ID,
    clientSecret: process.env.DOGBOT_SLACK_CLIENT_SECRET,
    redirectUri: process.env.DOGBOT_SLACK_OAUTH_REDIRECT_URI,
    scopes: ['bot','commands'],
});

// this simple webpage gives the entry point into the oAuth workflow
// for a user to add this bot to Slack
controller.setupWebserver(process.env.PORT, function(err, webserver) {

    webserver.get('/',function(req,res) {
	var oAuthPage = "<html>\
  <head>\
    <title>Dog Bot</title>\
    <meta id='viewport' name='viewport' content='width=device-width, initial-scale=1.0, overflow:hidden, user-scalable=no' />\
    <link href='https://fonts.googleapis.com/css?family=Unica+One|Lato:400,100,700' rel='stylesheet' type='text/css'>\
    <style>\
      .flexbox-container {\
          display: flex;\
          flex-direction: column;\
          align-items: center;\
          justify-content: center;\
          height: 100%;\
      }\
    </style>\
  </head>\
  <div class='flexbox-container'>\
    <div>\
      <a href='https://slack.com/oauth/authorize?scope=bot&client_id="+process.env.DOGBOT_SLACK_CLIENT_ID+"'><img alt='Add to Slack' height='40' width='139' src='https://\
platform.slack-edge.com/img/add_to_slack.png' srcset='https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_sla\
ck@2x.png 2x'></a>\
    </div>\
  </div>\
</html>";
	res.send(oAuthPage);
    });

    return controller
	.createWebhookEndpoints(controller.webserver)
	.createOauthEndpoints(controller.webserver, function(err, req, res) { 
	    if (err) {
		return res.status(500).send('Bad dog! '+err);
	    }
	    else {
		return res.send('Woof woof!  Dogbot has been added to your slack team!  Head back there to play with her!');
	    }
	});
});

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
// also, to track what teams are currently connected
var _bots = {};
function trackBot(bot) {
    return _bots[bot.config.token] = bot;
}

controller.storage.teams.all(function(err,teams) {
    if (err) {
	throw new Error(err);
    }

    // connect all teams with bots up to slack!
    for (var t  in teams) {
	if (teams[t].bot) {
	    controller.spawn(teams[t]).startRTM(function(err, bot) {
		if (err) {
		    return console.log('Error connecting bot to Slack:',err);
		} else {
		    return trackBot(bot);
		}
	    });
	}
    }
});

controller.on('create_bot',function(bot,config) {
    //if not already online, get online
    if (!_bots[bot.config.token]) {
	bot.startRTM(function(err) {
	    if (!err) {
		return trackBot(bot);
	    }

	    bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
		if (err) {
		    return console.log(err);
		} else {
		    return convo.say('Woof woof!  Dogbot at your service!\nPlease `/invite` me to your channel!');
		}
	    });
	});
    }
});

// generic error message reporter.  use for when you are in a bot workflow
// and something went wrong and you need to tell the user.  takes:
// err: the error detail you want thrown in the log
// bot: the bot that is talking to the user
// message: the message it is replying to (NOT the message you want to display)
// interactive: toggles whether this is replying to an interactive message or not
// the message displayed to the user is a static "Uh oh, something went wrong!"
function replyGenericError(err, bot, message, interactive) {
    console.log(err);
    if (interactive) {
	return bot.replyInteractive(message, 'Uh oh, something went wrong!');
    }
    else {
	return bot.replyPrivate(message, 'Uh oh, something went wrong!');
    }
}

// the following helper functions are used for generating options
// used in various interactive message dropdowns
function generateYearOptions() {
    var today = new Date();
    var thisYear = today.getFullYear();
    var yearOptions = [];
    for (var i=0; i < 30; i++) {
	yearOptions.push({
	    text: (thisYear - i).toString(),
	    value: (thisYear - i)+':'+(thisYear - i),
	});
    }
    return yearOptions;
}

function generateMonthOptions() {
    return [
        {
            text: 'January',
            value: 1+':January',
        },
        {
            text: 'February',
            value: 2+':February',
        },
        {
            text: 'March',
            value: 3+':March',
        },
        {
            text: 'April',
            value: 4+':April',
        },
        {
            text: 'May',
            value: 5+':May',
        },
        {
            text: 'June',
            value: 6+':June',
        },
        {
            text: 'July',
            value: 7+':July',
        },
        {
            text: 'August',
            value: 8+':August',
        },
        {
            text: 'September',
            value: 9+':September',
	},
        {
            text: 'October',
            value: 10+':October',
        },
        {
            text: 'November',
            value: 11+':November',
        },
        {
            text: 'December',
            value: 12+':December',
        },
    ];
}

function generateDayOptions(monthName) {
    var monthToDay = {
	January: 31,
	February: 29,
	March: 31,
	April: 30,
	May: 31,
	June: 30,
	July: 31,
	August: 31,
	September: 30,
	October: 31,
	November: 30,
	December: 31,
    };
    var dayOptions = [];
    for (var i=1; i <= monthToDay[monthName]; i++) {
	dayOptions.push({
	    text: i.toString(),
	    value: i+':'+i,
	});
    }
    return dayOptions;
}

// this function controls the way fields look when displaying dog info
function generateDogFields(dogObject, displayAll) {
    var displayableFields = [
	'name',
	'good',
	'birthdate',
	'gender',
	'owner',
	'location',
	'schedule',
	'breed',
	'createdBy',
    ];
    var dogFields = [];
    for (var i=0; i < displayableFields.length; i++) {
	var field = displayableFields[i];
	switch (field) {
	case 'birthdate':
	    if (dogObject.birthMonth && dogObject.birthDay && dogObject.birthYear) {
		dogFields.push({
		    title: "Birthdate",
		    value: dogObject.birthMonth +'/'+ dogObject.birthDay +'/'+ dogObject.birthYear,
		    short: true,
		});
	    }
	    break;
	case 'gender':
	    if (dogObject.hasOwnProperty('gender')) {
		if (dogObject.gender != 0) {
		    dogFields.push({
			title: "Gender",
			value: "Male",
			short: true,
                    });
		}
		else {
                    dogFields.push({
			title: "Gender",
			value: "Female",
			short: true
                    });
		}
	    }
	    break;
	case 'owner':
	    if (dogObject.owner && displayAll) {
		dogFields.push({
                    title: "Owner",
                    value: '<@'+dogObject.owner +'>',
		    short: true,
		});
	    }
	    break;
	case 'good':
	    if (dogObject.isGood != 0) {
	        dogFields.push({
                    title: "Is good?",
                    value: 'Yes',
		    short: true,
                });
	    }
	    if (dogObject.isBad != 0) {
                dogFields.push({
                    title: "Is bad?",
                    value: 'Yes',
		    short: true,
                });
            }
	    break;
	case 'schedule':
	    if (dogObject.hasOwnProperty('isHereEveryday') && dogObject.isHereEveryday != 0 && displayAll) {
	        dogFields.push({
                    title: "Schedule",
                    value: 'Here everyday!',
                });
	    }
	    else {
		var possibleDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
		var days = [];
		for (var j=0; j < possibleDays.length; j++) {
		    if (dogObject.hasOwnProperty('isHere'+possibleDays[j]) && dogObject['isHere'+possibleDays[j]] != 0) {
			days.push(possibleDays[j]+'s');
		    }
		}
		if (days.length > 0) {
		    dogFields.push({
			title: "Schedule",
			value: days.join(),
		    });
		}
	    }
	    break;
	case 'createdBy':
	    if (dogObject.createdBy && displayAll) {
                dogFields.push({
                    title: "Created By",
                    value: '<@'+dogObject.createdBy +'>',
		    short: true,
                });
	    }
	    break;
	default:
	    // name, breed, location
	    if (dogObject.hasOwnProperty(field) && dogObject[field]) {
		dogFields.push({
		    title: field.charAt(0).toUpperCase()+field.slice(1),
		    value: dogObject[field],
		    short: ((field == 'name' || field == 'location') ? true : false),
		});
	    }
	}
    }
    return dogFields;
}

/* getDefaultFieldAttachments
   note: you should have a good working understanding of Slack interactive attachments
   before trying to modify anything here.

   this function provides a data-driven way to interact with a user when asking them
   questions about their dog.  the main split is between the edit and show workflows.
   in the edit workflow, each field has a interactive (asking the question) and a stated
   (what happens when the question has been answered).  using this you can chain questions
   together and end the chain at any point.  the callback_id of the interactive portion
   determines the stated portion that gets called.  the easiest way to understand this is to
   take a look how the birthdate workflow behaves: the entry point (birthdate) asks about
   the year the dog was born, that calls back to the birthYear handler (which sets birthYear
   with the value the user choose) which asks about the birthMonth, which in turn asks about
   the birthDay, which ends the workflow.  note that the key you use for a step in the workflow
   should exactly match the a single dogObject field that you set in response to the workflow.
   this means you can only set one dogObject field in response to an answered question (this is
   why the entry point is named "birthdate" because it's just an entry point into a workflow and
   nothing is being set)
   parameters:
   action: "show" or "edit"
   field: the name of the worflow field you are entering (e.g. "birthdate").
   dog: a dogObject
   showInteractive: whether you want to trigger the "interactive" or "stated" workflow
   choiceText: the text of the choice that the user selected

   other things to note about the structure of the fieldAttachments data:
   callback_id should always valued as action:fieldname:dogObject.id
   the value field in your actions array of the attachment should be valued as "dbValue:displayValue"
   where dbValue is the data you actually want to store, and displayValue is what you want to show
   to the user as the representation of that value in a UI. (e.g. "10:October").
*/
function getDefaultFieldAttachments(action, field, dog, showInteractive, choiceText) {
    var fieldAttachments = {
	edit: {
	    birthdate: {
		interactive: [
                    {
			title: 'What year was '+dog.name+' born in?',
			callback_id: 'edit:birthYear:'+dog.id,
			attachment_type: 'default',
			actions: [
                            {
				name: dog.name,
				text: 'Pick a year...',
				type: 'select',
				options: generateYearOptions(),
                            },
			],
                    },
		],
		stated: [],
	    },
	    birthYear: {
		interactive: [],
		stated: [
                    {
			title: choiceText+'! What month was '+dog.name+' born in?',
			callback_id: 'edit:birthMonth:'+dog.id,
			attachment_type: 'default',
			actions: [
                            {
				name: dog.name,
				text: 'Pick a month...',
				type: 'select',
				options: generateMonthOptions(),
                            },
			],
                    },		    
		],		
	    },
	    birthMonth: {
		interactive: [],
		stated: [
                    {
			title: choiceText+'! What day was '+dog.name+' born on?',
			callback_id: 'edit:birthDay:'+dog.id,
			attachment_type: 'default',
			actions: [
                            {
				name: dog.name,
				text: 'Pick a day...',
				type: 'select',
				options: generateDayOptions(choiceText),
			    },
			],
		    },
		],
	    },
	    birthDay: {
		interactive: [],
		stated: [
                    {
			title: 'Got it!  I\'ve updated the birthdate for '+dog.name,
			attachment_type: 'default',
                    },
		    
		],
	    },
	    gender: {
		interactive: [
		    {
			title: 'Is '+ dog.name +' a boy or girl?',
			callback_id: 'edit:gender:'+dog.id,
			attachment_type: 'default',
			actions: [
			    {
				name: dog.name,
				text: "Boy",
				value: "1:boy",
				type: "button",
			    },
			    {
				name: dog.name,
				text: "Girl",
				value: "0:girl",
				type: "button",
			    },
			]
		    }
		],
		stated: [
		    {
			title: dog.name+ ' is a '+ choiceText + '!',
			attachment_type: 'default',
		    }
		],
	    },
            good: {
		interactive: [
                    {
			title: 'Is '+ dog.name +' a good dog (right now)?',
			callback_id: 'edit:good:'+dog.id,
			attachment_type: 'default',
			actions: [
                            {
				name: dog.name,
				text: "Yes",
				value: "1:good",
				type: "button",
                            },
                            {
				name: dog.name,
				text: "No",
				value: "0:bad",
				type: "button",
                            },
			]
                    }
		],
		stated: [
                    {
			title: dog.name+ ' is a '+ choiceText + ' dog!',
			attachment_type: 'default',
                    }
		],
            },
            here: {
		interactive: [
                    {
			title: 'Is '+ dog.name +' here today?',
			callback_id: 'edit:here:'+dog.id,
			attachment_type: 'default',
			actions: [
                            {
				name: dog.name,
				text: "Yes",
				value: "1:here",
				type: "button",
                            },
                            {
				name: dog.name,
				text: "No",
				value: "0:not here",
				type: "button",
                            },
			]
                    }
		],
		stated: [
                    {
			title: dog.name+ ' is '+ choiceText + ' today!',
			attachment_type: 'default',
                    }
		],
            },
	    owner: {
		interactive: [
		    {
			title: 'Who is the human for '+dog.name+'?',
			callback_id: 'edit:owner:'+dog.id,
			attachment_type: 'default',
			actions: [
			    {
				name: dog.name,
				text: 'Pick a human...',
				type: 'select',
				data_source: 'users',
			    },
			],
		    },
		],
		stated: [
		    {
			title: dog.name + ' loves <@'+choiceText+'>',
			attachment_type: 'default',
		    },
		],
	    },
	    schedule: {
		interactive: [
                    {
                        title: 'Is '+ dog.name +' here every day?',
                        callback_id: 'edit:schedule:'+dog.id,
                        attachment_type: 'default',
                        actions: [
                            {
                                name: dog.name,
                                text: "Yes",
                                value: "1:yes",
                                type: "button",
                            },
                            {
                                name: dog.name,
                                text: "No",
                                value: "0:no",
                                type: "button",
                            },
                        ]
                    }
		],
		stated: [
                    {
                        title: 'How about every Monday?',
                        callback_id: 'edit:scheduleM:'+dog.id,
                        attachment_type: 'default',
                        actions: [
                            {
                                name: dog.name,
                                text: "Yes",
                                value: "1:yes",
                                type: "button",
                            },
                            {
                                name: dog.name,
                                text: "No",
                                value: "0:no",
                                type: "button",
                            },
                        ]
                    }
		],
	    },
            scheduleM: {
                interactive: [],
                stated: [
                    {
                        title: 'Every Tuesday?',
                        callback_id: 'edit:scheduleT:'+dog.id,
                        attachment_type: 'default',
                        actions: [
                            {
                                name: dog.name,
                                text: "Yes",
                                value: "1:yes",
                                type: "button",
                            },
                            {
                                name: dog.name,
                                text: "No",
                                value: "0:no",
                                type: "button",
                            },
                        ]
                    }
		],
	    },
            scheduleT: {
                interactive: [],
                stated: [
                    {
                        title: 'Wednesday?',
                        callback_id: 'edit:scheduleW:'+dog.id,
                        attachment_type: 'default',
                        actions: [
                            {
                                name: dog.name,
                                text: "Yes",
                                value: "1:yes",
                                type: "button",
                            },
                            {
                                name: dog.name,
                                text: "No",
                                value: "0:no",
                                type: "button",
                            },
                        ]
                    }
                ],
            },
            scheduleW: {
                interactive: [],
                stated: [
                    {
                        title: 'Thursday?',
                        callback_id: 'edit:scheduleR:'+dog.id,
                        attachment_type: 'default',
                        actions: [
                            {
                                name: dog.name,
                                text: "Yes",
                                value: "1:yes",
                                type: "button",
                            },
                            {
                                name: dog.name,
                                text: "No",
                                value: "0:no",
                                type: "button",
                            },
                        ]
                    }
                ],
            },
            scheduleR: {
                interactive: [],
                stated: [
                    {
                        title: 'Friday?',
                        callback_id: 'edit:scheduleF:'+dog.id,
                        attachment_type: 'default',
                        actions: [
                            {
                                name: dog.name,
                                text: "Yes",
                                value: "1:yes",
                                type: "button",
                            },
                            {
                                name: dog.name,
                                text: "No",
                                value: "0:no",
                                type: "button",
                            },
                        ]
                    }
                ],
            },
            scheduleF: {
                interactive: [],
                stated: [
                    {
                        title: 'Phew! Ok, got it.',
                        attachment_type: 'default',
                    },
                ],
            },
	    scheduleEnd: {
		interactive: [],
		stated: [
		    {
			title: 'Ok, got it!',
			attachment_type: 'default',
		    },
		],
	    },
	    addpic: {
		interactive: [
		    {
			title: 'Do you want to add this pic for '+dog.name+'?',
			text: 'The picture should display properly if you planning on clicking Yes.',
			callback_id: 'edit:addpic:'+dog.id,
			image_url: choiceText,
			actions: [
                            {
                                name: dog.name,
                                text: 'Yes',
                                value: '1:'+choiceText,
                                type: "button",
                            },
                            {
                                name: dog.name,
                                text: 'No',
                                value: '0:nope',
                                type: "button",
                            },
			],
		    },
		],
		stated: [
		    {
			title: (choiceText == 'nope' ? 'Yea, I didn\'t like that pic either.' : 'OK, '+dog.name+' has a new pic!'),
			attachment_type: 'default',
		    },
		],
	    },
            delpic: {
                interactive: [
                    {
                        title: 'Do you want to remove this pic for '+dog.name+'?',
                        callback_id: 'edit:delpic:'+dog.id,
                        image_url: choiceText,
                        actions: [
                            {
                                name: dog.name,
                                text: 'Yes',
                                value: '1:'+choiceText,
                                type: "button",
                            },
                            {
                                name: dog.name,
                                text: 'No',
                                value: '0:nope',
                                type: "button",
                            },
                        ],
                    },
                ],
                stated: [
                    {
                        title: (choiceText == 'nope' ? 'Ok, I\'ll keep that one.' : 'Removed!'),
                        attachment_type: 'default',
                    },
                ],
            },
	},
	show: {
	    dog: {
		interactive: [
                    {
			title: dog.name+' (ID '+dog.id+')',
			callback_id: 'show:dog:'+dog.id,
			image_url: dog._imageURL,
			attachment_type: 'default',
			actions: [
                            {
				name: dog.name,
				text: 'Show',
				value: dog.id+':show',
				type: "button",
                            },
                            {
                                name: dog.name,
                                text: 'Cancel',
                                value: dog.id+':cancel',
                                type: "button",
                            },
			]
		    },
		],
		stated: [
                    {
                        title: dog.name+' (ID '+dog.id+')',
                        callback_id: 'show:dogchoice:'+dog.id,
			image_url: dog._imageURL,
                        attachment_type: 'default',
			text: 'Post this dog to the channel?',
			fields: generateDogFields(dog, true),
                        actions: [
                            {
                                name: dog.name,
                                text: 'Yes',
                                value: dog.id+':posted',
                                type: "button",
                            },
                            {
                                name: dog.name,
                                text: 'No',
                                value: dog.id+':did not post',
                                type: "button",
                            },
                        ]
                    },
		],
	    },
	    dogchoice: {
		interactive: [],
		stated: [
                    {
                        title: 'Hey look, it\'s '+dog.name+'!',
                        image_url: dog._imageURL,
                        attachment_type: 'default',
                        fields: generateDogFields(dog, false),
                    },
		],
	    },
	},
    };
    if (showInteractive) {
	return fieldAttachments[action][field]['interactive'];
    }
    else {
	return fieldAttachments[action][field]['stated'];
    }
}

// this function handles the logic around setting each individual dogObject field
function processDogEdit(slackTeamId, field, dogId, value, cb) {
    controller.storage.teams.getDog({id: dogId}, slackTeamId, function (err, res) {
	if (err) {
	    return cb(err, {});
	}
	else {
	    if (null === res) {
		return cb(new Error('Dog '+dogId+' does not exist!'), {});
	    }
	    else {
		var dogObject = res;
		if (field == 'here') {
		    var today = new Date();
		    today.setHours(0,0,0,0);
		    if (value != 0) {
			dogObject.hereDate = today.toISOString();
			dogObject.goneDate = null;
		    }
		    else {
                        dogObject.hereDate = null;
                        dogObject.goneDate = today.toISOString();
		    }
		}
                else if (field == 'good') {
                    if (value != 0) {
                        dogObject.isGood = true;
                        dogObject.isBad = false;
                    }
                    else {
                        dogObject.isGood = false;
                        dogObject.isBad = true;
                    }
                }
		else if (field == 'schedule') {
		    if (value != 0) {
			dogObject.isHereEveryday = true;
		    }
		    else {
			dogObject.isHereEveryday = false;
		    }
		}
		else if (field == 'scheduleM') {
		    if (value != 0) {
			dogObject.isHereMonday = true;
		    }
		    else {
			dogObject.isHereMonday = false;
		    }
		}
                else if (field == 'scheduleT') {
                    if (value != 0) {
                        dogObject.isHereTuesday = true;
                    }
                    else {
                        dogObject.isHereTuesday = false;
                    }
                }
                else if (field == 'scheduleW') {
                    if (value != 0) {
                        dogObject.isHereWednesday = true;
                    }
                    else {
                        dogObject.isHereWednesday = false;
                    }
                }
                else if (field == 'scheduleR') {
                    if (value != 0) {
                        dogObject.isHereThursday = true;
                    }
                    else {
                        dogObject.isHereThursday = false;
                    }
                }
                else if (field == 'scheduleF') {
                    if (value != 0) {
                        dogObject.isHereFriday = true;
                    }
                    else {
                        dogObject.isHereFriday = false;
                    }
                }
		else {
		    dogObject[field] = value;
		}
		return controller.storage.teams.saveDog(dogObject, slackTeamId, cb);
	    }
	}
    });
}

// when a user is presented with an interactive message (e.g. a question to answer) and responds,
// an interactive_message_callback event is generated.  this function handles the various types of
// interactive events dogbot offers (scheduling, adding pictures, setting birthday, etc)
controller.on('interactive_message_callback', function(bot, message) {
    var ids = message.callback_id.split(/\:/);
    var action = ids[0];
    var field = ids[1];
    var dogId = ids[2];
    var values;
    if (message.actions[0].type == 'button') {
	values = message.actions[0].value.split(/\:/);
    }
    else if (message.actions[0].type == 'select') {
	values = message.actions[0].selected_options[0].value.split(/\:/);
    }
    else {
	return replyGenericError('Interactive message not of type button or select ('+message.actions[0].type+')', bot, message, true);
    }
    var choiceValue = values[0];
    var choiceDisplayText = (values.slice(1).length > 0 ? values.slice(1).join(':') : values[0]);
    if ('edit' == action) {
	// YES message.team.id NOT message.team_id because interactive messages are
	// different that way (WHY)
	if ('addpic' == field) {
	    // bit of a hack, choice text contains the URL to add if user clicked yes
	    if (choiceValue == 1) {
		controller.storage.teams.addPicToDog({id: dogId}, choiceDisplayText, message.team.id, function (err, res) {
		    if (err) {
			return replyGenericError(err, bot, message, true);
		    }
		    else {
			return bot.replyInteractive(message, {
			    attachments: getDefaultFieldAttachments(action, field, {id: dogId, name: message.actions[0].name}, false, choiceDisplayText)
			});
		    }
		});
	    }
	    else {
		return bot.replyInteractive(message, {
                    attachments: getDefaultFieldAttachments(action, field, {id: dogId, name: message.actions[0].name}, false, choiceDisplayText)
                });
	    }
	}
	else if ('delpic' == field) {
            if (choiceValue == 1) {
                controller.storage.teams.deletePicForDog({id: dogId}, choiceDisplayText, message.team.id, function (err, res) {
                    if (err) {
                        return replyGenericError(err, bot, message, true);
                    }
                    else {
                        return bot.replyInteractive(message, {
                            attachments: getDefaultFieldAttachments(action, field, {id: dogId, name: message.actions[0].name}, false, choiceDisplayText)
                        });
                    }
                });
            }
            else {
                return bot.replyInteractive(message, {
                    attachments: getDefaultFieldAttachments(action, field, {id: dogId, name: message.actions[0].name}, false, choiceDisplayText)
                });
            }
	}
	else {
	    processDogEdit(message.team.id, field, dogId, choiceValue, function(err, res) {
		if (err) {
		    return replyGenericError(err, bot, message, true);
		}
		else {
		    // special case, if saving a schedule, and user chose that dog is here everyday,
		    // don't bother asking them about individual days
		    if ('schedule' == field && choiceValue == 1) {
			return bot.replyInteractive(message, {
                            attachments: getDefaultFieldAttachments(action, 'scheduleEnd', res, false, choiceDisplayText)
			});
		    }
		    else {
			return bot.replyInteractive(message, {
			    attachments: getDefaultFieldAttachments(action, field, res, false, choiceDisplayText)
			});
		    }
		}
	    });
	}
    }
    else if ('show' == action) {
	if (field == 'dog' && choiceDisplayText == 'cancel') {
	    return bot.replyInteractive(message, {
		attachments: [
		    {
			title: 'Ok, I didn\'t post anything.',
			attachment_type: 'default',
		    },
		],
	    });
	}
	else {
	    controller.storage.teams.getDog({id: values[0]}, message.team.id, function(err, res) {
		if (err) {
		    return replyGenericError(err, bot, message, true);
		}
		else {
		    var dog = res;
		    if (field == 'dogchoice') {
			if (choiceDisplayText == 'posted') {
			    bot.say({
				text: '',
				channel: message.channel,
				attachments: getDefaultFieldAttachments('show','dogchoice', dog, false, choiceDisplayText)
			    });
			    return bot.replyInteractive(message, {
				attachments: [
				    {
					title: 'Ok, I posted '+dog.name,
					attachment_type: 'default',
				    },
				],
			    });
			}
			else {
			    // dog data is stored case-sensitive
			    // but when searching for a dog, we want to do that in a case-insensitive way
			    // in order not to muck with the data, we get the set of all dog names that exist
			    // and check which ones match the search team, then return that set of names and get
			    // all dogs in those sets
			    controller.storage.teams.getDogNames(message.team.id, function(err, res) {
				if (err) {
				    return replyGenericError(err, bot, message, true);
				}
				else {
				    var dogNameList = res;
				    var matchingNames = []
				    for (var i=0; i < dogNameList.length; i++) {
					if (dog.name.toUpperCase() == dogNameList[i].toUpperCase()) {
					    matchingNames.push(dogNameList[i]);
					}
				    }
				    controller.storage.teams.getAllMatchingDogsBySetMultiple('name', matchingNames, message.team.id, function(err, res) {
					if (err) {
					    return replyGenericError(err, bot, message, true);
					}
					else {
					    if (res.length == 0) {
						return bot.replyInteractive(message, 'No dogs by that name!');
					    }
					    else {
						var dogs = res;
						var dogAttachments = [];
						for (var i=0; i < dogs.length; i++) {
						    var defaultAttachments = getDefaultFieldAttachments('show', 'dog', dogs[i], true, null)
						    dogAttachments = dogAttachments.concat(defaultAttachments);
						}
						return bot.replyInteractive(message, {
						    attachments: dogAttachments
						});
					    }
					}
				    });
				}
			    });
			}
		    }
		    else {
			return bot.replyInteractive(message, {
			    attachments: getDefaultFieldAttachments(action, field, dog, false, choiceDisplayText)
			});
		    }
		}
	    });
	}
    }
});

// this function handles all slash commands
controller.on('slash_command', function(bot, message) {
    if (message.token == process.env.DOGBOT_SLACK_VERIFICATION_TOKEN) {
	var command = message.text;
	var match1 = command.match(/^(list|help)$/);
	var match2 = command.match(/^(add|remove|show|here|good|gender|birthdate|owner|schedule|delpic)+ (.*)$/);
	var match3 = command.match(/^(addpic|name|breed|location)+ (.*)$/);

        if (match1) {
	    var action = match1[1];
	    if (action == 'list') {
		controller.storage.teams.getDogNames(message.team_id, function (err, res) {
		    if (err) {
			return replyGenericError(err, bot, message, false);
		    }
		    else {
			if (res.length > 0) {
			    res.sort();
			    var dogList = res.join(', ')
			    return bot.replyPrivate(message, dogList);
			}
			else {
			    return bot.replyPrivate(message, 'There are no dogs to show!');
			}
		    }
		});
	    }
	    else if (action == 'help') {
		return bot.replyPrivate(message, 'Hey there!  I\'m your friendly neighborhood dogbot!\n'
			+ 'If you haven\'t invited my bot user to the channel you want to post in, please do so!\n'
			+ 'To add a dog, use `add <dogname>`\n'
			+ 'I\'ll add that dog to the list and give you an ID.\n'
			+ 'Remember it!  You\'ll need it later.\n'
			+ 'If you forget your dog\'s ID, you can use `show <dogname>`\n'
			+ 'That will give you a list of dogs with that name.\n'
			+ 'You can also use `show` to post a particular dog to the channel if you want to show him/her off.\n'
			+ 'If you\'ve forgotten your dog\'s name (shame on you), use `list`\n'
			+ 'That will give you all the dog names I know.\n'
			+ 'To remove your dog from the list, use `remove <dogID>`\n'
			+ 'To edit your dog\'s info use `(here|good|gender|birthdate|owner|schedule) <dogID>`\n'
			+ 'Just follow the prompts!\n'
			+ 'For other fields, use `(name|breed|location) <dogID> <value>`\n'
			+ 'Use that command to change your dog\'s name, breed, or location to `<value>`\n'
			+ 'To add a pic for your dog, use `addpic <dogID> <url>`\n'
			+ 'To remove a pic for your dog, use `delpic <dogID>`\n'
			+ 'You can also use the `delpic` command to see all the available pictures for a dog...\n'
			+ 'Just don\'t delete any if you don\'t want to!\n'
			+ 'And, as always, I\'ll be listening for *who\'s a good|bad boy|girl|dog?* and *who\'s here today|tomorrow?*'
		);
	    }
	}
	else if (match2) {
	    var action = match2[1];
	    var arg = match2[2];
	    switch (action) {
		case 'add':
		     controller.storage.teams.addDog({name: arg, createdBy: message.user_id}, message.team_id, function(err, res) {
			 if (err) {
			     return replyGenericError(err, bot, message, false);
			 }
			 else {
			     return bot.replyPrivate(message, 'Saved '+res.name+'!  Your dog ID (you need this for editing later) is `'+res.id+'`');
			 }
		     });
		     break;
		case 'remove':
                     controller.storage.teams.deleteDog({id: arg}, message.team_id, function(err, res) {
                         if (err) {
			     return replyGenericError(err, bot, message, false);
                         }
                         else {
                             return bot.replyPrivate(message, 'Removed!');
                         }
                     });
		     break;
		case 'show':
                     // dog data is stored case-sensitive
                     // but when searching for a dog, we want to do that in a case-insensitive way
                     // in order not to muck with the data, we get the set of all dog names that exist
                     // and check which ones match the search team, then return that set of names and get
                     // all dogs in those sets
                     controller.storage.teams.getDogNames(message.team_id, function(err, res) {
                         if (err) {
                             return replyGenericError(err, bot, message, false);
                         }
                         else {
                             var dogNameList = res;
                             var matchingNames = []
                             for (var i=0; i < dogNameList.length; i++) {
                                 if (arg.toUpperCase() == dogNameList[i].toUpperCase()) {
                                     matchingNames.push(dogNameList[i]);
                                 }
                             }
                             controller.storage.teams.getAllMatchingDogsBySetMultiple('name', matchingNames, message.team_id, function(err, res) {
                                 if (err) {
                                     return replyGenericError(err, bot, message, false);
                                 }
                                 else {
                                     if (res.length == 0) {
                                         return bot.replyPrivate(message, 'No dogs by that name!');
                                     }
                                     else {
                                         var dogs = res;
                                         var dogAttachments = [];
                                         for (var i=0; i < dogs.length; i++) {
                                             var defaultAttachments = getDefaultFieldAttachments('show', 'dog', dogs[i], true, null)
                                             dogAttachments = dogAttachments.concat(defaultAttachments);
                                         }
                                         return bot.replyPrivate(message, {
                                             attachments: dogAttachments
                                         });
                                     }
                                 }
                             });
                         }
                     });
		     break;
		default:
		    // handles everything else
		    // this these cases, our action value is actually the field we want to edit
		    controller.storage.teams.getDog({id: arg}, message.team_id, function(err, res) {
                         if (err) {
			     return replyGenericError(err, bot, message, false);
                         }
                         else {
			     if (null === res) {
				 return bot.replyPrivate(message, 'Dog ID `'+arg+'` doesn\'t exist!');
			     }
			     else {
				 if (action == 'delpic') {
				     var dog = res;
				     controller.storage.teams.getPicsForDog(dog, message.team_id, function (err, res) {
					 if (err) {
                                             return replyGenericError(err, bot, message, false);
					 }
					 else {
                                             if (res.length > 0) {
						 var imageAttachments = [];
						 for (var i=0; i < res.length; i++) {
						     var defaultAttachments = getDefaultFieldAttachments('edit', action, dog, true, res[i]);
						     imageAttachments = imageAttachments.concat(defaultAttachments);
						 }
                                                 return bot.replyPrivate(message, {
                                                     attachments: imageAttachments
                                                 });
					     }
					     else {
						 return bot.replyPrivate(message, dog.name+' doesn\'t have any pictures to delete!');
					     }
                                        }
				     });
				 }
				 else {
				     return bot.replyPrivate(message, {
					 attachments: getDefaultFieldAttachments('edit', action, res, true, null)
				     });
				 }
			     }
                         }
                    });
		    break;
		// end switch(action)
	    }
	}
	else if (match3) {
	    // handles name, location, breed, addpic
	    var action = match3[1];
	    var dogIdAndValue = match3[2];
	    var match = dogIdAndValue.match(/^(\d+) (.*)$/);
	    if (match) {
		var dogId = match[1];
		var dogValue = match[2];
		controller.storage.teams.getDog({id: dogId}, message.team_id, function(err, res) {
		    if (err) {
			return replyGenericError(err, bot, message, false);
		    }
		    else {
			if (null === res) {
			    return bot.replyPrivate(message, 'Dog '+dogId+ ' does not exist!');
			}
			else {
			    var dog = res;
			    if (action == 'addpic') {
				return bot.replyPrivate(message, {
				    attachments: getDefaultFieldAttachments('edit', action, dog, true, dogValue)
				});
			    }
			    else {
				dog[action] = dogValue;
				controller.storage.teams.saveDog(dog, message.team_id, function(err, res) {
				    if (err) {
					return replyGenericError(err, bot, message, false);
				    }
				    else {
					return bot.replyPrivate(message, 'Changed '+action+' to '+dogValue+'!');
				    }
				});
			    }
			}
		    }
		});
	    }
	    else {
		return bot.replyPrivate(message, 'You need to enter `'+action+' [ID] [value]`'); 
	    }
	}
	else {
	    return bot.replyPrivate(message, 'Not sure what you meant there, try asking for `help`');
	}
    }
});

// this handles events that occur in response to chat messages
controller.hears(['^who.s a (good|bad) (boy|girl|dog)'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
    var temperment = message.match[1];
    var gender = message.match[2];
    var filters = [];
    if (temperment == 'bad') {
	filters.push({key: 'isBad', value: 1});
    }
    else {
	filters.push({key: 'isGood', value: 1});
    }
    
    if (gender == 'boy') {
	filters.push({key: 'gender', value: 1});
    }
    else if (gender == 'girl') {
	filters.push({key: 'gender', value: 0});
    }

    // YUP, message.team here.  not .team_id, not .team.id, just .team, because WHY would Slack be consistent?
    controller.storage.teams.getRandDog(message.team, filters, function (err, res) {
	if (err) {
	    return replyGenericError(err, bot, message, false);
	}
	else {
	    if (null === res) {
		return bot.say({
		    text: 'No one is.  There are no '+temperment+ ' '+gender+'s right now.',
		    channel: message.channel,
		});
	    }
	    else {
		return bot.say({
		    text: '',
		    channel: message.channel,
		    attachments: getDefaultFieldAttachments('show','dogchoice', res, false, 'posted')
		});
	    }
	}
    });
});

controller.hears(['^who.s here (today|tomorrow)'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
    var when = message.match[1];
    var dt = new Date();
    dt.setHours(0,0,0,0);
    if (when == 'tomorrow') {
	dt.setDate(dt.getDate() + 1);
    }
    controller.storage.teams.getDogsHereOnDate(message.team, dt, function (err, res) {
	if (err) {
	    return replyGenericError(err, bot, message, false);
	}
	else {
	    if (res.length > 0) {
		var hereArray = [];
		for (var i=0; i < res.length; i++) {
		    if (res[i].goneDate == dt.toISOString()) {
			// if dog has been explicitly marked as absent on this date,
			// don't include in the list
			continue;
		    }
		    var dogText = res[i].name;
		    if (res[i].location) {
			dogText += ' (in '+res[i].location+')';
		    }
		    if (res[i].owner) {
			dogText += ' (with <@'+res[i].owner+'>)';
		    }
		    hereArray.push(dogText);
		}
		return bot.say({
		    text: hereArray.join('\n'),
		    channel: message.channel,
		});
	    }
	    else {
		return bot.say({
		    text: 'No one is.  There are no dogs here today.  How depressing.',
		    channel: message.channel,
		});
	    }
	}
    });
});
