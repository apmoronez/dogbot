var redis = require('redis'); //https://github.com/NodeRedis/node_redis

/*
 * All optional
 *
 * config = {
 *  namespace: namespace,
 *  host: host,
 *  port: port
 * }
 * // see
 * https://github.com/NodeRedis/node_redis
 * #options-is-an-object-with-the-following-possible-properties for a full list of the valid options
 */
module.exports = function(config) {
    config = config || {};
    config.namespace = config.namespace || 'gomez-dogbot:store';

    var storage = {};
    var client = redis.createClient(config); // could pass specific redis config here
    var methods = [
	'teams',
	'users', 
	'channels'
    ];
    var validDogFields = [
	{
	    name: 'birthMonth',
	    setIndexed: true,
	    required: false,
	    treatAs: 'integer',
	},
	{
	    name: 'birthDay',
	    setIndexed: true,
	    required: false,
	    treatAs: 'integer',
	},
        {
            name: 'birthYear',
            setIndexed: true,
            required: false,
            treatAs: 'integer',
        },
	{
	    name: 'breed',
	    setIndexed: true,
	    required: false,
	    treatAs: 'string',
	},
	{
	    name: 'createdBy',
	    setIndexed: false,
	    required: false,
	    treatAs: 'string',
	},
	{
	    name: 'goneDate',
	    setIndexed: true,
	    required: false,
	    treatAs: 'datestring',
	},
	{
	    name: 'hereDate',
	    setIndexed: true,
	    required: false,
	    treatAs: 'datestring',
	},
	{
	    name: 'id',
	    setIndexed: false,
	    required: true,
	    treatAs: 'integer',
	},
	{
	    name: 'isGood',
	    setIndexed: true,
	    required: false,
	    treatAs: 'boolean',
	},
	{
	    name: 'isBad',
	    setIndexed: true,
	    required: false,
	    treatAs: 'boolean',
	},
	{
	    name: 'isHereEveryday',
	    setIndexed: true,
	    required: false,
	    treatAs: 'boolean',
	},
        {
            name: 'isHereMonday',
            setIndexed: true,
            required: false,
            treatAs: 'boolean',
        },
        {
            name: 'isHereTuesday',
            setIndexed: true,
            required: false,
            treatAs: 'boolean',
        },
        {
            name: 'isHereWednesday',
            setIndexed: true,
            required: false,
            treatAs: 'boolean',
        },
        {
            name: 'isHereThursday',
            setIndexed: true,
            required: false,
            treatAs: 'boolean',
        },
        {
            name: 'isHereFriday',
            setIndexed: true,
            required: false,
            treatAs: 'boolean',
        },
        {
            name: 'isHereSaturday',
            setIndexed: true,
            required: false,
            treatAs: 'boolean',
        },
        {
            name: 'isHereSunday',
            setIndexed: true,
            required: false,
            treatAs: 'boolean',
        },
	{
	    name: 'location',
	    setIndexed: true,
	    required: false,
	    treatAs: 'string',
	},
	{
	    name: 'name',
	    setIndexed: true,
	    required: true,
	    treatAs: 'string',
	},
	{
	    name: 'owner',
	    setIndexed: false,
	    required: false,
	    treatAs: 'string',
	},
	{
	    name: 'gender',
	    setIndexed: true,
	    required: false,
	    treatAs: 'boolean', // 1 = male, 0 = female
	},
    ];

    // Implements required slack botkit API methods and gomez-dogbot related API methods 
    for (var i = 0; i < methods.length; i++) {
        storage[methods[i]] = function(slackEntity) {
	    var slackDataNamespace = config.namespace + ':slackdata:' + slackEntity;
	    var dogNamespace = config.namespace + ':dogdata:' + slackEntity;
	    var specialDogIdSequenceKey = '__dogIdSequence';
	    var specialDogNameSetKey = '__dogsByName';
	    var dogPicsSetKey = '__dogPics';
            return {
                get: function(id, cb) {
                    client.hget(slackDataNamespace, id, function(err, res) {
                        cb(err, JSON.parse(res));
                    });
                },
                save: function(object, cb) {
                    if (!object.id) // Silently catch this error?
                        return cb(new Error('The given object must have an id property'), {});
                    client.hset(slackDataNamespace, object.id, JSON.stringify(object), cb);
                },
                all: function(cb, options) {
                    client.hgetall(slackDataNamespace, function(err, res) {
                        if (err)
                        return cb(err, {});

                        if (null === res)
                        return cb(err, res);

                        var parsed;
                        var array = [];

                        for (var i in res) {
                            parsed = JSON.parse(res[i]);
                            res[i] = parsed;
                            array.push(parsed);
                        }

                        cb(err, options && options.type === 'object' ? res : array);
                    });
                },
                allById: function(cb) {
                    this.all(cb, {type: 'object'});
                },
		makeDogKey: function(slackEntityId, type, key) {
		    return dogNamespace + ':' + slackEntityId + ':' + type + ':' + key;
		},
                getDog: function(dogObject, slackEntityId, cb) {
		    var localThis = this;
                    client.hgetall(localThis.makeDogKey(slackEntityId, 'data', dogObject.id), function(err, res) {
			if (err) {
			    return cb(new Error(err), {});
			}
			else {
			    var dog = res;
			    localThis.getRandPicForDog(dogObject, slackEntityId, function (err, res) {
				if (err) {
				    return cb(new Error(err), {});
				}
				else {
				    if (null !== res) {
					dog._imageURL = res;
				    }
				    return cb(null, dog);
				}
			    });
			}
		    });
                },
		cleanUpSpecialNameSet: function(name, slackEntityId, cb) {
                    var localThis = this;
		    if (null === name) {
			return cb(null, null);
		    }
		    client.smembers(localThis.makeDogKey(slackEntityId, 'sets', 'name:' + name), function (err, res) {
                        if (err) {
                            console.log(err);
                            return cb(new Error('Could not clean up special dog name set!'), {});
                        }
                        else {
                            if (res.length == 0) {
                                // nothing in that set, remove this extinct dog name from our specialset
                                client.srem(localThis.makeDogKey(slackEntityId, 'special', specialDogNameSetKey), name, cb);
                            }
			    else {
				// nothing to do!
				return cb(null, null);
			    }
                        }
                    });
		},
		saveDog: function(dogObject, slackEntityId, cb) {
		    var localThis = this;
		    // this function supports saving any number of fields.  if it's in the object
		    // it will be saved, if not in the object, it won't be touched.  if it's in the object
		    // but is null, it will be cleared.
		    if (!dogObject.id) {
			return cb(new Error('Dog does not have an ID! (use addDog for new dogs)'), {});
		    }
		    else {
			localThis.getDog(dogObject, slackEntityId, function(err, res) {
			    if (err) {
				console.log(err);
				return cb(new Error('Could not retrieve dog ID '+ dogObject.id), {});
			    }
			    else { //main save logic
				if (null === res && !dogObject._newDog) {
				    return cb(new Error('Dog ID "'+ dogObject.id + '" does not exist!'), {});
				}
				else if (null !== res && dogObject._newDog) {
				    return cb(new Error('Dog ID "'+ dogObject.id + '" is already in use!'), {});
				}
				else { // id checks out
				    var oldData = res;
				    var hmsetArray = [];
				    var hdelArray = [];
				    var setsToPopulate = [];
				    var setsToRemove = [];
				    for (var fieldIndex = 0; fieldIndex < validDogFields.length; fieldIndex++) {
					var field = validDogFields[fieldIndex];
					if (dogObject.hasOwnProperty(field.name)) {
					    // if the passed field exists but is null, 
					    // we want to clear that field
					    // otherwise, process as usual
					    if (null !== dogObject[field.name]) {
						// validate data conforms to expectations
						if (field.treatAs == 'boolean') {
						    // standardize to 1 or 0
						    if (dogObject[field.name] && dogObject[field.name] != 0) {
							dogObject[field.name] = 1;
						    }
						    else {
							dogObject[field.name] = 0;
						    }
						}
						else if (field.treatAs == 'integer') {
						    if (isNaN(dogObject[field.name])) {
							return cb(new Error(field.name + ' is not of type ' + field.treatAs), {});
						    }
						    else {
							dogObject[field.name] = parseInt(dogObject[field.name], 10);
						    }
						}
						else if (field.treatAs == 'datestring') {
						    // make sure string is parseable as date
						    // but null is explicitly allowed
						    var dts = Date.parse(dogObject[field.name]);
						    if (isNaN(dts)) {
							return cb(new Error(field.name + ' is not a parseable date string ('+dogObject[field.name]+')'), {});
						    }
						    else {
							// store all dates as ISO strings
							// this also means they will be returned as such
							var dt = new Date(dts);
							dogObject[field.name] = dt.toISOString();
						    }
						}
					    }
					    else {
						// if we are creating a new dog, we don't want nulls in the object at all (they serve no purpose)
						// and we don't need to bother trying to process it
						if (dogObject._newDog) {
						    delete dogObject[field.name];
						    continue;
						}
					    }
					    // only attempt to edit set data if something is changing (or is being populated)
					    if (dogObject._newDog ||
						(!oldData.hasOwnProperty(field.name) || 
						 (oldData.hasOwnProperty(field.name) && oldData[field.name] != dogObject[field.name]))) {
						if (null === dogObject[field.name]) {
						    hdelArray.push(field.name);
						}
						else {
						    hmsetArray.push(field.name, dogObject[field.name]);
						}
						if (field.setIndexed) {
						    if (!dogObject._newDog &&
							oldData.hasOwnProperty(field.name) && 
							(null !== oldData[field.name] && "undefined" !== typeof oldData[field.name])) {
							setsToRemove.push(field.name + ':' + oldData[field.name]);
						    }
						    if (null !== dogObject[field.name] && "undefined" !== typeof dogObject[field.name]) {
							setsToPopulate.push(field.name + ':' + dogObject[field.name]);
						    }
						    else {
							if (field.required) {
							    return cb(new Error(field.name + ' is required when saving dog data!'), {});
							}
						    }
						}
					    }
					}
					else {
					    if (field.required) {
						return cb(new Error(field.name + ' is required when saving dog data!'), {});
					    }
					}
				    }
				    var multi = client.multi();
				    var multiCommonError = function (err, res) {
					if (err) {
					    console.log('MULTI COMMAND FAIL');
					    console.log(err);
					    multi.discard();
					    return cb(new Error('Could not save dog data!'), {});
					}
				    };
				    if (hdelArray.length > 0) {
					multi.hdel(localThis.makeDogKey(slackEntityId, 'data', dogObject.id), hdelArray, multiCommonError);
				    }
				    if (hmsetArray.length > 0) {
					multi.hmset(localThis.makeDogKey(slackEntityId, 'data', dogObject.id), hmsetArray, multiCommonError);
				    }
				    for (var i = 0; i < setsToPopulate.length; i++) {
					multi.sadd(localThis.makeDogKey(slackEntityId, 'sets', setsToPopulate[i]), dogObject.id, multiCommonError);
				    }
				    for (var i = 0; i < setsToRemove.length; i++) {
					multi.srem(localThis.makeDogKey(slackEntityId, 'sets', setsToRemove[i]), dogObject.id, multiCommonError);
				    }
				    // special case, we want a set of extant dog names, so we can easily find what names
				    // exist in our database without having to run a 'keys *' command.
				    // by now, we have updated the set which maps name to dog ID.  if we are changing a dog
				    // name (or adding a new one), we should update this special set appropriately
				    // if the name is already there, that's fine, redis handles set uniqueness
				    multi.sadd(localThis.makeDogKey(slackEntityId, 'special', specialDogNameSetKey), dogObject.name, multiCommonError);
				    multi.exec();
				    
				    var nameToCleanUp = null;
				    if (oldData && oldData.name) {
					nameToCleanUp = oldData.name;
				    }
				    localThis.cleanUpSpecialNameSet(nameToCleanUp, slackEntityId, function(err, res) {
					if (err) {
					    console.log(err);
					    return cb(new Error('Could not clean up set data!'), {});
					}
					else {
					    return cb(null, dogObject);
					}
				    });
				}
			    }
			});
                    }
		},
                addDog: function(dogObject, slackEntityId, cb) {
		    var localThis = this;
                    if (!dogObject.id) {
                        client.incr(localThis.makeDogKey(slackEntityId, 'special', specialDogIdSequenceKey), function(err, res) {
                            if (err) {
                                console.log(err);
                                return cb(new Error('Could not get new ID for dog!'), {});
                            }
                            else {
                                dogObject.id = res;
				dogObject._newDog = true;
				// all dogs start as good if not otherwise specified
				if (!dogObject.isBad) {
				    dogObject.isGood = true;
				    dogObject.isBad = false;
				}
                                localThis.saveDog(dogObject, slackEntityId, function(err, res) {
				    if (err) {
					console.log(err);
					return cb(new Error('Could not get save dog!'), {});
				    }
				    else {
					console.log('Created dog '+res.id);
					return cb(null, res);
				    }
				});
                            }
                        });
                    }
                    else {
                        return cb(new Error('Dog already has an ID! (use saveDog for existing dogs)'), {});
                    }
                },
		deleteDog: function(dogObject, slackEntityId, cb) {
		    var localThis = this;
		    localThis.getDog(dogObject, slackEntityId, function(err, res) {
			if (err) {
			    console.log(err);
			    return cb(new Error('Could not delete dog data!'), {});
			}
			else {
			    if (null === res) {
				return cb(new Error('Dog ID "'+ dogObject.id + '" does not exist!'), {});
			    }
			    else {
				var dogToDelete = res;
			        var multi = client.multi();
				var multiCommonError = function (err, res) {
				    if (err) {
					console.log(err);
					multi.discard();
					return cb(new Error('Could not delete dog data!'), {});
				    }
				};
				multi.del(localThis.makeDogKey(slackEntityId, 'data', dogToDelete.id), multiCommonError);
				for (var fieldIndex = 0; fieldIndex < validDogFields.length; fieldIndex++) {
				    var field = validDogFields[fieldIndex];
				    if (field.setIndexed && dogToDelete[field.name]) {
					multi.srem(localThis.makeDogKey(slackEntityId, 'sets', field.name + ':' + dogToDelete[field.name]), dogToDelete.id, multiCommonError);
				    }
				}
				multi.del(localThis.makeDogKey(slackEntityId, 'sets', dogPicsSetKey + ':' + dogToDelete.id), multiCommonError);
				multi.exec(); //error handling?
				localThis.cleanUpSpecialNameSet(dogToDelete.name, slackEntityId, cb);
			    }
			}
		    }); 
		},
		addPicToDog: function(dogObject, imageURL, slackEntityId, cb) {
		    client.sadd(this.makeDogKey(slackEntityId, 'sets', dogPicsSetKey + ':' + dogObject.id), imageURL, cb);
		},
                deletePicForDog: function(dogObject, imageURL, slackEntityId, cb) {
                    client.srem(this.makeDogKey(slackEntityId, 'sets', dogPicsSetKey + ':' + dogObject.id), imageURL, cb);
                },
                checkPicForDog: function(dogObject, imageURL, slackEntityId, cb) {
		    client.sismember(this.makeDogKey(slackEntityId, 'sets', dogPicsSetKey + ':' + dogObject.id), imageURL, cb);
		},
		getPicsForDog: function(dogObject, slackEntityId, cb) {
                    client.smembers(this.makeDogKey(slackEntityId, 'sets', dogPicsSetKey + ':' + dogObject.id), cb);
                },
		getRandPicForDog: function(dogObject, slackEntityId, cb) {
		    client.srandmember(this.makeDogKey(slackEntityId, 'sets', dogPicsSetKey + ':' + dogObject.id), cb);
		},
		getDogsFromIdList: function(dogIds, slackEntityId, cb) {
		    var localThis = this;
                    if (dogIds.length > 0) {
                        var script = "local res={}; for i, name in ipairs(KEYS) do local dog = redis.call('hgetall','"+localThis.makeDogKey(slackEntityId, 'data', '')+"'..name); table.insert(res, dog); end return res;"
                        // current support for EVAL is pretty crap, have to use this syntax to get it to work
                        var args = [script, dogIds.length].concat(dogIds);
                        client.eval(args, function(err, res) {
                            if (err) {
                                console.log(err);
                                return cb(new Error('Could not get dogs from eval!'), {});
                            }
                            else {
                                // since we are using eval, we are getting back an array of arrays (of key value pairs)
                                // we want to convert to array of objects
                                var dogObjects = [];
                                for (var i=0; i < res.length; i++) {
                                    var dogArray = res[i];
                                    var dogObject = {};
                                    for (var j=0; j < dogArray.length; j+=2) {
                                        dogObject[dogArray[j].toString('binary')] = dogArray[j+1];
                                    }
                                    dogObjects.push(dogObject);
                                }
                                return cb(null, dogObjects);
                            }
                        });
                    }
                    else {
                        return cb(null, []);
                    }
		},
		getAllMatchingDogsBySetMultiple: function(setName, matchValues, slackEntityId, cb) {
		    var localThis = this;
                    if (matchValues && matchValues.length > 0) {
                        var unionKeys = [];
                        for (var i=0; i < matchValues.length; i++) {
                            unionKeys.push(localThis.makeDogKey(slackEntityId, 'sets', setName + ':' + matchValues[i]));
                        }
                        client.sunion(unionKeys, function(err, res) {
                            if (err) {
                                console.log(err);
                                return cb(new Error('Could not get set union!'), null);
                            }
                            else {
				return localThis.getDogsFromIdList(res, slackEntityId, cb);
                            }
                        });
                    }
		    else {
			return cb(null, []);
		    }		    
		},
		getAllMatchingDogsBySet: function(setName, matchValue, slackEntityId, cb) {
		    var localThis = this;
		    client.smembers(localThis.makeDogKey(slackEntityId, 'sets', setName + ':' + matchValue), function(err, res) {
			if (err) {
			    console.log(err);
                            return cb(new Error('Could not get dogs!'), {});			}
			else {
			    return localThis.getDogsFromIdList(res, slackEntityId, cb);
			}		    
		    });
		},
		getDogNames: function(slackEntityId, cb) {
		    client.smembers(this.makeDogKey(slackEntityId, 'special', specialDogNameSetKey), cb);
		},
		getRandDog: function(slackEntityId, filters, cb) {
		    localThis = this;
		    if (filters && filters.length > 0) {
			var interKeys = [];
			for (var i=0; i < filters.length; i++) {
			    interKeys.push(localThis.makeDogKey(slackEntityId, 'sets', filters[i].key + ':' + filters[i].value));
			}
			client.sinter(interKeys, function(err, res) {
			    if (err) {
				console.log(err);
				return cb(new Error('Could not get set intersection!'), null);
			    }
			    else {
				if (res.length > 0) {
				    var dogId = res[Math.floor(Math.random()*res.length)];
				    return localThis.getDog({id: dogId}, slackEntityId, cb);
				}
				else {
				    return cb(null, null);
				}
			    }
			});
		    }
		    else {
			// get any random dog
			localThis.getDogNames(slackEntityId, function(err, res) {
			    if (err) {
				console.log(err);
				return cb(new Error('Could not get dog names!'), null);
			    }
			    else {
				if (res.length > 0) {
				    var dogName = res[Math.floor(Math.random()*res.length)];
				    localThis.getAllMatchingDogsBySet('name', dogName, slackEntityId, function (err, res) {
					if (err) {
					    console.log(err);
					    return cb(new Error('Could not get dogs by name!'), null);
					}
					else {
					    if (res.length > 0) {
						var dog = res[Math.floor(Math.random()*res.length)];
						return cb(null, dog);
					    }
					    else {
						return cb(null, null);
					    }					    
					}
				    });
				}
				else {
				    return cb(null, null);
				}
			    }
			});
		    }
		},
		getDogsHereOnDate: function(slackEntityId, dt, cb) {
		    localThis = this;
		    dt.setHours(0,0,0,0);
		    var weekDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
		    // dogs that are here today are basically the union of:
		    // dogs here on this exact day,
		    // dogs here on this week day,
		    // dogs here every day
		    var hereKeys = [];
		    hereKeys.push(localThis.makeDogKey(slackEntityId, 'sets', 'hereDate:'+dt.toISOString()));
		    hereKeys.push(localThis.makeDogKey(slackEntityId, 'sets', 'isHere'+weekDays[dt.getDay()]+':1'));
		    hereKeys.push(localThis.makeDogKey(slackEntityId, 'sets', 'isHereEveryday:1'));
		    client.sunion(hereKeys, function(err, res) {
                        if (err) {
                            console.log(err);
                            return cb(new Error('Could not get dogs that are here!'), null);
                        }
                        else {
			    return localThis.getDogsFromIdList(res, slackEntityId, cb);
                        }
                    });
		}
            };
        }(methods[i]);
    }
    return storage;
};
